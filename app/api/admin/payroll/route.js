import { supabase, eom } from "@/lib/supabase";
import { pushText } from "@/lib/line";

const LABOR_SELF = [659,691,727,763,799,835,871,917,962,1008,1054,1100,1157,1214,1272,1330,1387,1459,1531,1603];
const HEALTH_SELF = [424,445,468,491,515,538,561,590,620,649,679,708,745,782,819,856,893,940,986,1032];
const fmt = n => "$" + Number(n||0).toLocaleString();

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
    const mk = year + "-" + String(month).padStart(2, "0");
    let empQ = supabase.from("employees")
      .select("id, name, store_id, monthly_salary, hourly_rate, labor_tier, health_tier, employment_type, line_uid")
      .eq("is_active", true);
    if (store_id) empQ = empQ.eq("store_id", store_id);
    const { data: emps } = await empQ;

    const results = [];
    for (const emp of emps || []) {
      // 出勤天數
      const { data: records } = await supabase.from("attendances")
        .select("type").eq("employee_id", emp.id).eq("type", "clock_in")
        .gte("timestamp", mk + "-01T00:00:00").lte("timestamp", eom(mk) + "T23:59:59");
      const workDays = (records || []).length;

      // 底薪
      const base = emp.monthly_salary ? Number(emp.monthly_salary)
        : (emp.hourly_rate ? Number(emp.hourly_rate) * workDays * 8 : 0);

      // 加班費（只算選加班費的）
      const { data: ot } = await supabase.from("overtime_records")
        .select("amount, comp_type, comp_hours, comp_converted")
        .eq("employee_id", emp.id).eq("status", "approved")
        .gte("date", mk + "-01").lte("date", eom(mk));
      const otPay = (ot || []).filter(r => r.comp_type === "pay" || r.comp_converted)
        .reduce((s, r) => s + Number(r.amount || 0), 0);
      const compH = (ot || []).filter(r => r.comp_type === "comp" && !r.comp_used && !r.comp_converted)
        .reduce((s, r) => s + Number(r.comp_hours || 0), 0);

      // 勞健保
      const ls = emp.labor_tier ? LABOR_SELF[emp.labor_tier - 1] || 0 : 0;
      const hs = emp.health_tier ? HEALTH_SELF[emp.health_tier - 1] || 0 : 0;

      // ✦08 二代健保（兼職單次>基本工資27470）
      const suppHealth = emp.employment_type === "parttime" && base > 27470
        ? Math.round(base * 0.0211) : 0;

      const net = base + otPay - ls - hs - suppHealth;

      await supabase.from("payroll_records").upsert({
        employee_id: emp.id, store_id: emp.store_id,
        year, month, base_salary: base, work_days: workDays,
        hourly_rate: emp.hourly_rate || 0,
        overtime_pay: otPay, comp_hours: compH,
        labor_self: ls, health_self: hs,
        supplementary_health: suppHealth,
        net_salary: net,
      }, { onConflict: "employee_id,year,month" });

      results.push({ name: emp.name, base, otPay, ls, hs, suppHealth, net, workDays });
    }
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
      - Number(rec.labor_self||0) - Number(rec.health_self||0) - Number(rec.supplementary_health||0)
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
