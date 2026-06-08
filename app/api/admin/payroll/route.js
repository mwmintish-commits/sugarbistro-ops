import { supabase, auditLog } from "@/lib/supabase";
import { pushText } from "@/lib/line";
import { fmt } from "@/lib/hr-utils";
import { regeneratePayroll } from "@/lib/payroll-calc";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const store_id = searchParams.get("store_id");

  if (!month) return Response.json({ error: "需指定月份" }, { status: 400 });
  const [y, m] = month.split("-").map(Number);

  let q = supabase.from("payroll_records")
    .select("*, employees(name, line_uid), stores(name)")
    .eq("year", y).eq("month", m).order("employees(name)");
  if (store_id) q = q.eq("store_id", store_id);
  const { data } = await q;
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();

  // 結算薪資
  if (body.action === "generate") {
    const { year, month, store_id } = body;
    const { results } = await regeneratePayroll(year, month, { store_id });
    await auditLog(null, null, "payroll_generate", "payroll", null, { year, month, store_id, count: results.length });
    return Response.json({ success: true, data: results });
  }

  // LINE發送薪資條
  if (body.action === "send_line") {
    const { year, month } = body;
    const mk = year + "-" + String(month).padStart(2, "0");
    const { data: records } = await supabase.from("payroll_records")
      .select("*, employees(name, line_uid)")
      .eq("year", year).eq("month", month);

    let sent = 0;
    for (const r of records || []) {
      if (!r.employees?.line_uid) continue;
      const msg = "💰 " + mk + " 薪資條\n━━━━━━━━━━━━\n👤 " + r.employees.name +
        "\n📅 出勤 " + r.work_days + " 天" +
        "\n💵 底薪 " + fmt(r.base_salary) +
        (r.overtime_pay > 0 ? "\n⏱ 加班費 +" + fmt(r.overtime_pay) : "") +
        (r.comp_hours > 0 ? "\n🔄 補休 " + r.comp_hours + "hr" : "") +
        (r.labor_self > 0 ? "\n🛡 勞保 -" + fmt(r.labor_self) : "") +
        (r.health_self > 0 ? "\n🏥 健保 -" + fmt(r.health_self) : "") +
        (r.supplementary_health > 0 ? "\n🏥 補充保費 -" + fmt(r.supplementary_health) : "") +
        "\n━━━━━━━━━━━━\n💰 實發 " + fmt(r.net_salary);
      try {
        await pushText(r.employees.line_uid, msg);
        sent++;
        await supabase.from("payroll_records").update({ sent_via_line: true })
          .eq("id", r.id);
      } catch (e) {}
    }
    return Response.json({ success: true, sent });
  }

  // 薪資調整（加項/扣項/獎金）
  if (body.action === "adjust") {
    const { payroll_id, allowance, allowance_note, other_deduction, deduction_note, bonus_amount, bonus_note } = body;
    const { data: rec } = await supabase.from("payroll_records").select("*").eq("id", payroll_id).single();
    if (!rec) return Response.json({ error: "Not found" }, { status: 404 });
    const net = Number(rec.base_salary||0) + Number(rec.overtime_pay||0)
      + Number(rec.holiday_pay||0) + Number(rec.rest_day_pay||0)
      - Number(rec.labor_self||0) - Number(rec.health_self||0) - Number(rec.supplementary_health||0)
      - Number(rec.leave_deduction||0)
      + Number(allowance||0) - Number(other_deduction||0) + Number(bonus_amount||0);
    const { data } = await supabase.from("payroll_records").update({
      allowance: allowance||0, allowance_note,
      other_deduction: other_deduction||0, deduction_note,
      bonus_amount: bonus_amount||0, bonus_note,
      net_salary: net,
    }).eq("id", payroll_id).select().single();
    return Response.json({ data });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
