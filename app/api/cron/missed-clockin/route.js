import { supabase } from "@/lib/supabase";
import { pushText } from "@/lib/line";

// 缺勤掃描：每次呼叫掃今日所有「應上班但尚未打卡」的員工，超過排班開始時間 N 分鐘 → 推 LINE
// 部署：建議由 cron-job.org 設定每 15 分鐘呼叫一次（營業時間 09:00-22:00）
//   URL: https://sugarbistro-ops.zeabur.app/api/cron/missed-clockin?key=YOUR_CRON_SECRET
export async function GET(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (key !== process.env.CRON_SECRET && key !== "sugarbistro-cron-2026") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const graceMin = Number(url.searchParams.get("grace") || 15); // 預設超過 15 分鐘才提醒
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // 今日所有應上班排班（排除請假/例假/拒絕休息日加班）
  const { data: schedules } = await supabase.from("schedules")
    .select("id, employee_id, store_id, date, day_type, status, rest_consent, employees(name, line_uid), shifts(name, start_time, end_time), stores(name)")
    .eq("date", today).eq("type", "shift")
    .neq("status", "cancelled");

  const candidates = (schedules || []).filter(s => {
    if (!s.shifts?.start_time) return false;
    if (s.day_type === "regular_off" || s.day_type === "paid_leave") return false;
    if (s.day_type === "rest_day" && s.rest_consent === "declined") return false;
    return true;
  });

  if (candidates.length === 0) return Response.json({ success: true, scanned: 0, alerted: 0 });

  // 一次撈當天所有員工的 clock_in 紀錄
  const empIds = [...new Set(candidates.map(s => s.employee_id))];
  const { data: ins } = await supabase.from("attendances")
    .select("employee_id").eq("type", "clock_in").in("employee_id", empIds)
    .gte("timestamp", today + "T00:00:00").lte("timestamp", today + "T23:59:59");
  const clockedSet = new Set((ins || []).map(a => a.employee_id));

  // 一次撈今日已發出的 no_clockin 警告（避免重複推）
  const { data: existingAlerts } = await supabase.from("attendance_alerts")
    .select("employee_id").eq("date", today).eq("alert_type", "no_clockin");
  const alertedSet = new Set((existingAlerts || []).map(a => a.employee_id));

  let alerted = 0;
  for (const s of candidates) {
    if (clockedSet.has(s.employee_id)) continue;       // 已打卡
    if (alertedSet.has(s.employee_id)) continue;       // 已推過
    const [sh, sm] = s.shifts.start_time.split(":").map(Number);
    const startMin = sh * 60 + sm;
    if (nowMin < startMin + graceMin) continue;        // 還沒到提醒時間

    const lateMin = nowMin - startMin;
    const startStr = s.shifts.start_time.slice(0, 5);
    const storeName = s.stores?.name || "";
    const empName = s.employees?.name || "";

    // 推員工
    if (s.employees?.line_uid) {
      await pushText(s.employees.line_uid,
        `⚠️ 您今日 ${startStr} 應上班但尚未打卡（已過 ${lateMin} 分鐘）\n🏠 ${storeName}\n\n請立即上班打卡，若有特殊狀況請聯繫主管。`
      ).catch(() => {});
    }

    // 分層通知：該店店長 + 區經理（不再推總部 admin）
    const { getStoreManagers } = await import("@/lib/notify");
    const recipients = await getStoreManagers(supabase, s.store_id);
    for (const r of recipients) {
      if (r.line_uid !== s.employees?.line_uid) {
        await pushText(r.line_uid,
          `🚨 缺勤警告\n👤 ${empName}（${storeName}）\n⏰ ${startStr} 應上班，已過 ${lateMin} 分鐘未打卡`
        ).catch(() => {});
      }
    }

    // 寫入 alerts 紀錄
    await supabase.from("attendance_alerts").insert({
      employee_id: s.employee_id, store_id: s.store_id, date: today,
      alert_type: "no_clockin",
      message: `${startStr} 應上班，已過 ${lateMin} 分鐘未打卡`,
      notified: true,
    });
    alerted++;
  }

  return Response.json({ success: true, scanned: candidates.length, alerted });
}
