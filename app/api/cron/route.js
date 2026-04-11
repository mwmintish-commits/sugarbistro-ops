import { supabase } from "@/lib/supabase";
import { pushText } from "@/lib/line";

export async function GET(request) {
  const key = new URL(request.url).searchParams.get("key");
  if (key !== process.env.CRON_SECRET && key !== "sugarbistro-cron-2026") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toLocaleDateString("sv-SE");
  const reminders = [];
  const { data: emps } = await supabase.from("employees")
    .select("id, name, hire_date, probation_end_date, probation_status, contract_end_date, contract_type, birthday, line_uid, store_id")
    .eq("is_active", true);

  for (const e of emps || []) {
    if (e.probation_status === "in_probation" && e.probation_end_date) {
      const diff = (new Date(e.probation_end_date) - new Date(today)) / 86400000;
      if (diff >= 0 && diff <= 7) reminders.push("⏳ " + e.name + " 試用期 " + e.probation_end_date + " 到期");
    }
    if (e.contract_type === "fixed" && e.contract_end_date) {
      const diff = (new Date(e.contract_end_date) - new Date(today)) / 86400000;
      if (diff >= 0 && diff <= 14) reminders.push("📋 " + e.name + " 合約 " + e.contract_end_date + " 到期");
    }
    if (e.birthday && today.slice(5) === e.birthday.slice(5)) reminders.push("🎂 今天是 " + e.name + " 的生日！");
  }

  // 補休即將到期
  const nextWeek = new Date(Date.now() + 7 * 86400000).toLocaleDateString("sv-SE");
  const { data: expiring } = await supabase.from("overtime_records")
    .select("employees:employee_id(name), comp_hours, comp_expiry_date")
    .eq("comp_type", "comp").eq("comp_used", false).eq("comp_converted", false)
    .lte("comp_expiry_date", nextWeek).gte("comp_expiry_date", today);
  for (const r of expiring || []) {
    reminders.push("🔄 " + (r.employees?.name || "") + " 補休 " + r.comp_hours + "hr 將於 " + r.comp_expiry_date + " 到期");
  }

  // 庫存低於安全量
  const { data: lowStock } = await supabase.from("inventory_items")
    .select("name, current_stock, safe_stock, stores:store_id(name)")
    .not("safe_stock", "is", null);
  for (const i of (lowStock || []).filter(x => x.current_stock <= x.safe_stock && x.safe_stock > 0)) {
    reminders.push("⚠️ " + (i.stores?.name || "") + " " + i.name + " 庫存" + i.current_stock + "（安全量" + i.safe_stock + "）");
  }

  if (reminders.length === 0) return Response.json({ success: true, reminders: 0 });

  // 推送給 admin
  const { data: admins } = await supabase.from("employees").select("line_uid").eq("role", "admin").eq("is_active", true);
  const msg = "🔔 每日系統提醒\n━━━━━━━━━━\n" + reminders.join("\n");
  let sent = 0;
  for (const a of admins || []) {
    if (a.line_uid) { await pushText(a.line_uid, msg).catch(() => {}); sent++; }
  }

  return Response.json({ success: true, reminders: reminders.length, sent });
}
