import { supabase } from "@/lib/supabase";
import { pushText } from "@/lib/line";
import { getStoreManagers } from "@/lib/notify";

// 月加班時數警示：每位員工本月加班 ≥ 警戒值 → 推 LINE 給該店店長 + 區經理
// 法規上限 46hr/月（一般）、54hr/月（工會同意）。預設警戒 40hr，上限 46hr。
// 部署：cron-job.org 每天 09:00 一次
//   URL: https://sugarbistro-ops.zeabur.app/api/cron/overtime-warning?key=YOUR_CRON_SECRET
//   可加 ?warn=40&hard=46 覆寫門檻
export async function GET(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (key !== process.env.CRON_SECRET && key !== "sugarbistro-cron-2026") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const warnH = Number(url.searchParams.get("warn") || 40);
  const hardH = Number(url.searchParams.get("hard") || 46);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const month = today.slice(0, 7);
  const start = month + "-01";
  const [y, m] = month.split("-").map(Number);
  const end = month + "-" + new Date(y, m, 0).getDate();

  // 撈本月所有 approved 加班（含補休）
  const { data: records } = await supabase.from("overtime_records")
    .select("employee_id, store_id, overtime_minutes, employees(name), stores(name)")
    .eq("status", "approved")
    .gte("date", start).lte("date", end);

  // 依員工聚合
  const byEmp = {};
  for (const r of records || []) {
    if (!r.employee_id) continue;
    const k = r.employee_id;
    if (!byEmp[k]) byEmp[k] = {
      employee_id: r.employee_id, store_id: r.store_id,
      name: r.employees?.name || "?", store_name: r.stores?.name || "",
      minutes: 0,
    };
    byEmp[k].minutes += Number(r.overtime_minutes || 0);
  }

  const flagged = Object.values(byEmp).filter(e => e.minutes / 60 >= warnH);
  if (flagged.length === 0) return Response.json({ success: true, scanned: Object.keys(byEmp).length, flagged: 0 });

  // 防重複推：同月同員工同等級只推一次（用 attendance_alerts 紀錄）
  const { data: existingAlerts } = await supabase.from("attendance_alerts")
    .select("employee_id, alert_type")
    .gte("date", start).lte("date", end)
    .in("alert_type", ["ot_warn", "ot_hard"]);
  const alertedSet = new Set((existingAlerts || []).map(a => a.employee_id + ":" + a.alert_type));

  let pushed = 0;
  for (const e of flagged) {
    const hours = Math.round(e.minutes / 60 * 10) / 10;
    const level = hours >= hardH ? "ot_hard" : "ot_warn";
    if (alertedSet.has(e.employee_id + ":" + level)) continue;

    const icon = level === "ot_hard" ? "🚨" : "⚠️";
    const tag = level === "ot_hard" ? `已達法規上限 ${hardH}hr/月` : `已超過警戒 ${warnH}hr/月`;
    const msg = `${icon} 加班時數警示\n👤 ${e.name}（${e.store_name}）\n⏱ 本月已加班 ${hours} 小時\n📋 ${tag}\n\n請評估是否需安排休息或調整排班。`;

    const recipients = await getStoreManagers(supabase, e.store_id);
    for (const r of recipients) {
      await pushText(r.line_uid, msg).catch(() => {});
    }

    // 記 alerts 防重複
    try {
      await supabase.from("attendance_alerts").insert({
        employee_id: e.employee_id, store_id: e.store_id, date: today,
        alert_type: level, message: `本月加班 ${hours}hr (${tag})`, notified: true,
      });
    } catch {}
    pushed++;
  }

  return Response.json({ success: true, scanned: Object.keys(byEmp).length, flagged: flagged.length, pushed });
}
