import { supabase } from "@/lib/supabase";
import { pushText } from "@/lib/line";

export async function GET() {
  const { data } = await supabase.from("system_reminders")
    .select("*").eq("notified", false).order("due_date").limit(50);
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();

  // 產生提醒
  if (body.action === "generate") {
    const today = new Date().toLocaleDateString("sv-SE");
    const reminders = [];
    const { data: emps } = await supabase.from("employees")
      .select("id, name, hire_date, probation_end_date, probation_status, contract_type, contract_end_date, birthday, line_uid")
      .eq("is_active", true);

    for (const e of emps || []) {
      // 試用期到期(7天內)
      if (e.probation_status === "in_probation" && e.probation_end_date) {
        const diff = (new Date(e.probation_end_date) - new Date(today)) / 86400000;
        if (diff >= 0 && diff <= 7) {
          reminders.push({ type: "probation_expiry", target_id: e.id, target_name: e.name,
            message: "⏳ " + e.name + " 試用期將於 " + e.probation_end_date + " 到期", due_date: e.probation_end_date });
        }
      }
      // 合約到期(14天內)
      if (e.contract_type === "fixed" && e.contract_end_date) {
        const diff = (new Date(e.contract_end_date) - new Date(today)) / 86400000;
        if (diff >= 0 && diff <= 14) {
          reminders.push({ type: "contract_expiry", target_id: e.id, target_name: e.name,
            message: "📋 " + e.name + " 合約將於 " + e.contract_end_date + " 到期", due_date: e.contract_end_date });
        }
      }
      // 生日(當天)
      if (e.birthday) {
        const bd = e.birthday.slice(5); // MM-DD
        if (today.slice(5) === bd) {
          reminders.push({ type: "birthday", target_id: e.id, target_name: e.name,
            message: "🎂 今天是 " + e.name + " 的生日！", due_date: today });
        }
      }
    }

    // 庫存低於安全量
    const { data: lowStock } = await supabase.from("inventory")
      .select("name, quantity, safety_stock, stores(name)")
      .not("safety_stock", "is", null);
    for (const inv of (lowStock || []).filter(i => i.quantity <= i.safety_stock)) {
      reminders.push({ type: "stock_low", target_name: inv.name,
        message: "⚠️ " + (inv.stores?.name || "") + " " + inv.name + " 庫存" + inv.quantity + "（安全量" + inv.safety_stock + "）",
        due_date: today });
    }

    // 寫入（去重）
    let inserted = 0;
    for (const r of reminders) {
      const { data: existing } = await supabase.from("system_reminders")
        .select("id").eq("type", r.type).eq("target_name", r.target_name).eq("due_date", r.due_date).limit(1);
      if (!existing?.length) {
        await supabase.from("system_reminders").insert(r);
        inserted++;
      }
    }
    return Response.json({ success: true, generated: inserted });
  }

  // 標記已通知
  if (body.action === "dismiss") {
    await supabase.from("system_reminders").update({ notified: true }).eq("id", body.reminder_id);
    return Response.json({ success: true });
  }

  // LINE推送所有未通知提醒給admin
  if (body.action === "push_all") {
    const { data: pending } = await supabase.from("system_reminders")
      .select("*").eq("notified", false).order("due_date").limit(20);
    if (!pending?.length) return Response.json({ success: true, sent: 0 });

    const { data: admins } = await supabase.from("employees")
      .select("line_uid").eq("role", "admin").eq("is_active", true);
    const msg = "🔔 系統提醒\n━━━━━━━━━━\n" + pending.map(r => r.message).join("\n");
    let sent = 0;
    for (const a of admins || []) {
      if (a.line_uid) { await pushText(a.line_uid, msg).catch(() => {}); sent++; }
    }
    await supabase.from("system_reminders").update({ notified: true }).in("id", pending.map(r => r.id));
    return Response.json({ success: true, sent });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
