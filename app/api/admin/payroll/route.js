import { supabase, eom } from "@/lib/supabase";
import { pushText } from "@/lib/line";

const LABOR_SELF = [738,758,795,833,870,908,955,1002,1050,1098,1145,1145,1145,1145,1145,1145,1145,1145,1145,1145];
const HEALTH_SELF = [458,470,493,516,540,563,592,622,651,681,710,748,785,822,859,896,943,990,1036,1083];
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
      .select("id, name, store_id, monthly_salary, hourly_rate, labor_tier, health_tier, employment_type, line_uid, default_allowance, default_allowance_note, default_deduction, default_deduction_note")
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

      // 二代健保（兼職單次>基本工資29500）
      const suppHealth = emp.employment_type === "parttime" && base > 29500
        ? Math.round(base * 0.0211) : 0;

      // 加扣項（從員工預設帶入）
      const allow = Number(emp.default_allowance || 0);
      const deduct = Number(emp.default_deduction || 0);

      // 請假扣款（月薪制才需要；時薪制已反映在出勤天數）
      let leaveDeduct = 0, leaveHours = 0, leaveDetail = "";
      if (emp.monthly_salary) {
        const { data: leaves } = await supabase.from("leave_requests")
          .select("leave_type, start_date, end_date, half_day, status")
          .eq("employee_id", emp.id).eq("status", "approved")
          .gte("start_date", mk + "-01").lte("start_date", eom(mk));
        const dailyRate = Number(emp.monthly_salary) / 30;
        const deductRates = { sick: 0.5, personal: 1, menstrual: 0.5, family_care: 1 };
        // 特休/補休/婚假/喪假/陪產假/公假/公傷假 = 有薪，不扣
        for (const l of leaves || []) {
          const days = l.half_day ? 0.5 : (Math.ceil((new Date(l.end_date) - new Date(l.start_date)) / 86400000) + 1);
          const hrs = days * 8;
          leaveHours += hrs;
          const rate = deductRates[l.leave_type] || 0;
          if (rate > 0) {
            const amt = Math.round(dailyRate * days * rate);
            leaveDeduct += amt;
            leaveDetail += (leaveDetail ? "、" : "") + ({ sick:"病假", personal:"事假", menstrual:"生理假", family_care:"家庭照顧" }[l.leave_type] || l.leave_type) + days + "天";
          }
        }
      }

      const net = base + otPay - ls - hs - suppHealth + allow - deduct - leaveDeduct;

      await supabase.from("payroll_records").upsert({
        employee_id: emp.id, store_id: emp.store_id,
        year, month, base_salary: base, work_days: workDays,
        hourly_rate: emp.hourly_rate || 0,
        overtime_pay: otPay, comp_hours: compH,
        labor_self: ls, health_self: hs,
        supplementary_health: suppHealth,
        allowance: allow, allowance_note: emp.default_allowance_note || "",
        other_deduction: deduct, deduction_note: emp.default_deduction_note || "",
        leave_deduction: leaveDeduct, leave_hours: leaveHours, leave_detail: leaveDetail,
        net_salary: net,
      }, { onConflict: "employee_id,year,month" });

      results.push({ name: emp.name, base, otPay, ls, hs, suppHealth, allow, deduct, net, workDays });
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
