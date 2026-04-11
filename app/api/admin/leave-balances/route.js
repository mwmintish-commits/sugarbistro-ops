import { supabase, eom } from "@/lib/supabase";

function calcAnnualLeave(hireDate) {
  if (!hireDate) return 0;
  const now = new Date();
  const hire = new Date(hireDate);
  const months = (now.getFullYear() - hire.getFullYear()) * 12 + now.getMonth() - hire.getMonth();
  if (months < 6) return 0;
  if (months < 12) return 3;
  const years = Math.floor(months / 12);
  if (years < 2) return 7;
  if (years < 3) return 10;
  if (years < 5) return 14;
  if (years < 10) return 15;
  return Math.min(15 + (years - 10), 30);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const employee_id = searchParams.get("employee_id");
  const year = searchParams.get("year") || new Date().getFullYear();
  const store_id = searchParams.get("store_id");

  if (employee_id) {
    // 單一員工
    const { data: emp } = await supabase.from("employees").select("hire_date").eq("id", employee_id).single();
    let { data: balance } = await supabase.from("leave_balances").select("*").eq("employee_id", employee_id).eq("year", year).single();
    
    if (!balance) {
      const annualDays = calcAnnualLeave(emp?.hire_date);
      const { data: created } = await supabase.from("leave_balances").upsert({
        employee_id, year: Number(year), annual_total: annualDays,
      }, { onConflict: "employee_id,year" }).select().single();
      balance = created;
    }

    // 計算已用天數
    const { data: leaves } = await supabase.from("leave_requests").select("*")
      .eq("employee_id", employee_id).eq("status", "approved")
      .gte("start_date", year + "-01-01").lte("start_date", year + "-12-31");

    const used = { annual: 0, sick: 0, personal: 0, menstrual: 0 };
    for (const l of leaves || []) {
      const days = l.half_day ? 0.5 : (Math.ceil((new Date(l.end_date) - new Date(l.start_date)) / 86400000) + 1);
      if (used[l.leave_type] !== undefined) used[l.leave_type] += days;
    }

    // 加班補休時數
    const { data: otComp } = await supabase.from("overtime_records").select("comp_hours")
      .eq("employee_id", employee_id).eq("status", "approved").eq("comp_type", "comp");
    const compTotal = (otComp || []).reduce((s, r) => s + Number(r.comp_hours || 0), 0);

    return Response.json({
      data: {
        ...balance,
        annual_used: used.annual,
        annual_remaining: (balance?.annual_total || 0) - used.annual,
        sick_used: used.sick,
        sick_remaining: 30 - used.sick,
        personal_used: used.personal,
        personal_remaining: 14 - used.personal,
        menstrual_used: used.menstrual,
        overtime_comp_total: compTotal,
      }
    });
  }

  // 全員假勤總覽
  const { data: emps } = await supabase.from("employees").select("id, name, hire_date, store_id, stores(name)").eq("is_active", true).order("name");
  const filtered = store_id ? (emps || []).filter(e => e.store_id === store_id) : emps;

  const results = [];
  for (const emp of filtered || []) {
    // 優先使用手動設定的特休天數，否則依到職日計算
    const { data: balRec } = await supabase.from("leave_balances")
      .select("annual_total").eq("employee_id", emp.id).eq("year", year).single()
      .catch(() => ({ data: null }));
    const annualDays = balRec?.annual_total ?? calcAnnualLeave(emp.hire_date);
    const { data: leaves } = await supabase.from("leave_requests").select("leave_type, start_date, end_date, half_day")
      .eq("employee_id", emp.id).eq("status", "approved")
      .gte("start_date", year + "-01-01").lte("start_date", year + "-12-31");

    const used = { annual: 0, sick: 0, personal: 0, menstrual: 0 };
    for (const l of leaves || []) {
      const days = l.half_day ? 0.5 : (Math.ceil((new Date(l.end_date) - new Date(l.start_date)) / 86400000) + 1);
      if (used[l.leave_type] !== undefined) used[l.leave_type] += days;
    }

    // 補休餘額
    const today = new Date().toLocaleDateString("sv-SE");
    const { data: compAvail } = await supabase.from("overtime_records")
      .select("comp_hours").eq("employee_id", emp.id).eq("status", "approved")
      .eq("comp_type", "comp").eq("comp_used", false).eq("comp_converted", false)
      .gte("comp_expiry_date", today);
    const compHours = (compAvail || []).reduce((s, r) => s + Number(r.comp_hours || 0), 0);
    const { data: compUsed } = await supabase.from("overtime_records")
      .select("comp_hours").eq("employee_id", emp.id)
      .eq("comp_type", "comp").eq("comp_used", true);
    const compUsedH = (compUsed || []).reduce((s, r) => s + Number(r.comp_hours || 0), 0);

    results.push({
      employee_id: emp.id, name: emp.name, store_name: emp.stores?.name || "總部",
      annual_total: annualDays, annual_used: used.annual, annual_remaining: annualDays - used.annual,
      sick_used: used.sick, sick_remaining: 30 - used.sick,
      personal_used: used.personal, personal_remaining: 14 - used.personal,
      comp_available: compHours, comp_used: compUsedH,
    });
  }

  return Response.json({ data: results });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "set_annual") {
    const { employee_id, annual_total } = body;
    const year = new Date().getFullYear();
    const { data, error } = await supabase.from("leave_balances").upsert({
      employee_id, year, annual_total,
    }, { onConflict: "employee_id,year" }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
