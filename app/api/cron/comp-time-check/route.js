import { supabase } from "@/lib/supabase";
import { pushText } from "@/lib/line";
import { getStoreManagers } from "@/lib/notify";

// 補休到期檢查 cron
// 1) 距到期 ≤ 30 天且未消化 → 推員工 + 該店店長/區經理 LINE（防重複：alert_type=comp_expiring）
// 2) 已過期未消化 → 自動轉現金加項（comp_converted=true, comp_type=pay, amount 重算）
// 部署：cron-job.org 每天 09:00
//   URL: https://sugarbistro-ops.zeabur.app/api/cron/comp-time-check?key=YOUR_CRON_SECRET
//   可加 ?days=30 覆寫提醒天數
export async function GET(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (key !== process.env.CRON_SECRET && key !== "sugarbistro-cron-2026") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const remindDays = Number(url.searchParams.get("days") || 30);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const remindBefore = new Date(Date.now() + remindDays * 86400000).toLocaleDateString("sv-SE");

  // === 1) 過期未消化 → 自動轉現金 ===
  const { data: expired } = await supabase.from("overtime_records")
    .select("id, employee_id, store_id, overtime_minutes, rate, date, employees(name, line_uid), stores(name)")
    .eq("comp_type", "comp").eq("status", "approved")
    .eq("comp_used", false).eq("comp_converted", false)
    .lte("comp_expiry_date", today);

  let converted = 0;
  for (const rec of expired || []) {
    try {
      const { data: emp } = await supabase.from("employees")
        .select("hourly_rate, monthly_salary").eq("id", rec.employee_id).single();
      const hr = emp?.hourly_rate || (emp?.monthly_salary ? Math.round(emp.monthly_salary / 30 / 8) : 190);
      const amt = Math.round(hr * (rec.overtime_minutes / 60) * (rec.rate || 1.34));
      await supabase.from("overtime_records").update({
        comp_converted: true, comp_type: "pay", amount: amt,
      }).eq("id", rec.id);

      // 通知員工
      if (rec.employees?.line_uid) {
        const hours = Math.round(rec.overtime_minutes / 60 * 10) / 10;
        await pushText(rec.employees.line_uid,
          `⏰ 補休到期自動轉現金\n📅 原加班日：${rec.date}\n⏱ ${hours} 小時\n💰 將計入下次薪資 +$${amt.toLocaleString()}`
        ).catch(() => {});
      }
      converted++;
    } catch (e) { console.error("convert expired failed:", e?.message); }
  }

  // === 2) 即將到期 (≤ remindDays 天) → 推員工 + 主管 ===
  const { data: expiring } = await supabase.from("overtime_records")
    .select("id, employee_id, store_id, comp_hours, comp_expiry_date, date, employees(name, line_uid), stores(name)")
    .eq("comp_type", "comp").eq("status", "approved")
    .eq("comp_used", false).eq("comp_converted", false)
    .gt("comp_expiry_date", today).lte("comp_expiry_date", remindBefore);

  // 防重複：每筆 record 每階段只推一次（用 attendance_alerts 紀錄）
  const ids = (expiring || []).map(r => r.id);
  let alertedSet = new Set();
  if (ids.length > 0) {
    const { data: existingAlerts } = await supabase.from("attendance_alerts")
      .select("message").eq("alert_type", "comp_expiring");
    // message 內含 record_id 作為去重 key
    alertedSet = new Set((existingAlerts || []).map(a => (a.message || "").match(/\[id:([a-f0-9-]+)\]/)?.[1]).filter(Boolean));
  }

  // 依員工聚合
  const byEmp = {};
  for (const r of expiring || []) {
    if (alertedSet.has(r.id)) continue;
    const k = r.employee_id;
    if (!byEmp[k]) byEmp[k] = {
      employee_id: r.employee_id, store_id: r.store_id,
      name: r.employees?.name || "?", line_uid: r.employees?.line_uid,
      store_name: r.stores?.name || "",
      records: [], totalH: 0,
    };
    byEmp[k].records.push(r);
    byEmp[k].totalH += Number(r.comp_hours || 0);
  }

  let pushed = 0;
  for (const e of Object.values(byEmp)) {
    const lines = e.records.map(r => {
      const daysLeft = Math.ceil((new Date(r.comp_expiry_date) - new Date(today)) / 86400000);
      return `• ${Number(r.comp_hours||0)}hr｜到期 ${r.comp_expiry_date}（剩 ${daysLeft} 天）`;
    }).join("\n");

    // 通知員工
    if (e.line_uid) {
      await pushText(e.line_uid,
        `⏰ 補休即將到期提醒\n👤 ${e.name}\n⏱ 待消化共 ${Math.round(e.totalH * 10)/10} 小時\n━━━━━━━━━━━━━━\n${lines}\n\n💡 請儘速安排請假消化，否則到期將自動轉現金。`
      ).catch(() => {});
    }

    // 通知主管
    try {
      const recipients = await getStoreManagers(supabase, e.store_id);
      for (const r of recipients) {
        if (r.line_uid === e.line_uid) continue;
        await pushText(r.line_uid,
          `⏰ 補休到期提醒\n👤 ${e.name}（${e.store_name}）\n⏱ 待消化 ${Math.round(e.totalH * 10)/10} 小時\n${lines}\n\n請協助安排消化。`
        ).catch(() => {});
      }
    } catch {}

    // 記 alerts 防重複（每筆 record 寫一次）
    for (const r of e.records) {
      try {
        await supabase.from("attendance_alerts").insert({
          employee_id: e.employee_id, store_id: e.store_id, date: today,
          alert_type: "comp_expiring",
          message: `補休 ${r.comp_hours}hr 將於 ${r.comp_expiry_date} 到期 [id:${r.id}]`,
          notified: true,
        });
      } catch {}
    }
    pushed++;
  }

  return Response.json({
    success: true,
    converted, // 過期已轉現金筆數
    expiring_records: (expiring || []).length, // 即將到期筆數
    pushed_employees: pushed, // 推送員工數
  });
}
