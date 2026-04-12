import { supabase, eom } from "@/lib/supabase";

function calcAnnualLeave(hireDate) {
  if (!hireDate) return 0;
  const now = new Date();
  const hire = new Date(hireDate);
  // 以月份計算年資
  const months = (now.getFullYear() - hire.getFullYear()) * 12 + now.getMonth() - hire.getMonth();
  // 如果當月日期還沒到到職日，扣回1個月
  const adjusted = now.getDate() < hire.getDate() ? months - 1 : months;
  if (adjusted < 6) return 0;        // 未滿6個月
  if (adjusted < 12) return 3;       // 滿6個月未滿1年
  const years = Math.floor(adjusted / 12);
  if (years < 2) return 7;           // 滿1年
  if (years < 3) return 10;          // 滿2年
  if (years < 5) return 14;          // 滿3年
  if (years < 10) return 15;         // 滿5年
  return Math.min(15 + (years - 10), 30); // 滿10年起+1
}

// 計算到達下一個門檻的日期
function nextMilestone(hireDate) {
  if (!hireDate) return null;
  const hire = new Date(hireDate);
  const now = new Date();
  const months = (now.getFullYear() - hire.getFullYear()) * 12 + now.getMonth() - hire.getMonth();
  const adjusted = now.getDate() < hire.getDate() ? months - 1 : months;
  const milestones = [6, 12, 24, 36, 60, 120];
  for (const m of milestones) {
    if (adjusted < m) {
      const d = new Date(hire);
      d.setMonth(d.getMonth() + m);
      return { months: m, date: d.toLocaleDateString("sv-SE"), days_left: Math.ceil((d - now) / 86400000) };
    }
  }
  return null;
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
  const { data: emps } = await supabase.from("employees")
    .select("id, name, hire_date, store_id, role, stores(name)")
    .eq("is_active", true).order("name");
  const filtered = store_id ? (emps || []).filter(e => e.store_id === store_id) : emps;
  const today = new Date().toLocaleDateString("sv-SE");

  const results = [];
  for (const emp of filtered || []) {
    if (emp.role === "admin") continue;

    // 優先手動設定，否則自動計算
    const { data: balRec } = await supabase.from("leave_balances")
      .select("*").eq("employee_id", emp.id).eq("year", year).single()
      .catch(() => ({ data: null }));
    const autoAnnual = calcAnnualLeave(emp.hire_date);
    const annualDays = balRec?.annual_total ?? autoAnnual;
    const isOverridden = balRec?.annual_total !== null && balRec?.annual_total !== undefined && balRec?.annual_total !== autoAnnual;
    const milestone = nextMilestone(emp.hire_date);

    // 已用天數
    const { data: leaves } = await supabase.from("leave_requests")
      .select("leave_type, start_date, end_date, half_day")
      .eq("employee_id", emp.id).eq("status", "approved")
      .gte("start_date", year + "-01-01").lte("start_date", year + "-12-31");
    const used = { annual: 0, sick: 0, personal: 0, menstrual: 0, comp_time: 0 };
    for (const l of leaves || []) {
      const days = l.half_day ? 0.5 : (Math.ceil((new Date(l.end_date) - new Date(l.start_date)) / 86400000) + 1);
      if (used[l.leave_type] !== undefined) used[l.leave_type] += days;
    }

    // 加班紀錄（全部）
    const { data: otAll } = await supabase.from("overtime_records")
      .select("id, date, hours, amount, comp_type, comp_hours, comp_used, comp_converted, comp_expiry_date, status")
      .eq("employee_id", emp.id).eq("status", "approved")
      .gte("date", year + "-01-01").lte("date", year + "-12-31")
      .order("date", { ascending: false });

    // 補休可用（未過期+未使用+未轉換）
    const compAvail = (otAll || []).filter(r =>
      r.comp_type === "comp" && !r.comp_used && !r.comp_converted &&
      r.comp_expiry_date && r.comp_expiry_date >= today
    );
    const compHours = compAvail.reduce((s, r) => s + Number(r.comp_hours || 0), 0);

    // 補休已使用
    const compUsedH = (otAll || []).filter(r => r.comp_type === "comp" && r.comp_used)
      .reduce((s, r) => s + Number(r.comp_hours || 0), 0);

    // 補休已轉現金
    const compConverted = (otAll || []).filter(r => r.comp_type === "comp" && r.comp_converted)
      .reduce((s, r) => s + Number(r.comp_hours || 0), 0);

    // 即將到期（14天內）
    const soon = new Date(Date.now() + 14 * 86400000).toLocaleDateString("sv-SE");
    const compExpiring = compAvail.filter(r => r.comp_expiry_date <= soon);
    const expiringHours = compExpiring.reduce((s, r) => s + Number(r.comp_hours || 0), 0);

    // 加班費總額
    const otPayTotal = (otAll || []).filter(r => r.comp_type === "pay")
      .reduce((s, r) => s + Number(r.amount || 0), 0);

    // 年度加班總時數
    const otTotalHours = (otAll || []).reduce((s, r) => s + Number(r.hours || 0), 0);

    // 可轉現金的補休IDs
    const convertibleIds = compAvail.map(r => r.id);

    results.push({
      employee_id: emp.id, name: emp.name, store_name: emp.stores?.name || "總部",
      hire_date: emp.hire_date, role: emp.role,
      // 特休
      annual_auto: autoAnnual, annual_total: annualDays, annual_overridden: isOverridden,
      annual_used: used.annual, annual_remaining: annualDays - used.annual,
      next_milestone: milestone,
      // 病假/事假
      sick_used: used.sick, sick_remaining: 30 - used.sick,
      personal_used: used.personal, personal_remaining: 14 - used.personal,
      // 加班補休整合
      ot_total_hours: otTotalHours, ot_pay_total: otPayTotal,
      comp_available: compHours, comp_used: compUsedH, comp_converted: compConverted,
      comp_expiring: expiringHours, comp_expiring_count: compExpiring.length,
      convertible_ids: convertibleIds,
      // 補休休假已用
      comp_leave_used: used.comp_time,
    });
  }

  return Response.json({ data: results });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "set_annual" || body.action === "update_balance") {
    const { employee_id, annual_total, sick_total, personal_total, notes } = body;
    const year = body.year || new Date().getFullYear();
    const updates = { employee_id, year };
    if (annual_total !== undefined) updates.annual_total = annual_total;
    if (sick_total !== undefined) updates.sick_total = sick_total;
    if (personal_total !== undefined) updates.personal_total = personal_total;
    if (notes !== undefined) updates.notes = notes;
    updates.modified_at = new Date().toISOString();
    const { data, error } = await supabase.from("leave_balances").upsert(
      updates, { onConflict: "employee_id,year" }
    ).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  // 補休轉現金
  if (body.action === "convert_to_cash") {
    const { employee_id, record_ids } = body;
    if (!record_ids?.length) return Response.json({ error: "No records" }, { status: 400 });
    let totalHours = 0, totalAmount = 0;
    for (const id of record_ids) {
      const { data: rec } = await supabase.from("overtime_records").select("comp_hours, amount")
        .eq("id", id).eq("comp_used", false).eq("comp_converted", false).single();
      if (rec) {
        await supabase.from("overtime_records").update({ comp_converted: true }).eq("id", id);
        totalHours += Number(rec.comp_hours || 0);
        totalAmount += Number(rec.amount || 0);
      }
    }
    return Response.json({ success: true, converted_hours: totalHours, amount: totalAmount });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
