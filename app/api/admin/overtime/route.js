import { supabase, eom } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const store_id = searchParams.get("store_id");
  const employee_id = searchParams.get("employee_id");

  let query = supabase.from("overtime_records")
    .select("*, employees(name, store_id), stores(name)")
    .order("date", { ascending: false });
  if (year) {
    query = query.gte("date", year + "-01-01").lte("date", year + "-12-31");
  } else if (month) {
    query = query.gte("date", month + "-01").lte("date", eom(month));
  }
  if (store_id) query = query.eq("store_id", store_id);
  if (employee_id) query = query.eq("employee_id", employee_id);

  const { data, error } = await query.limit(200);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const totalMinutes = (data || []).reduce((s, r) => s + (r.overtime_minutes || 0), 0);
  const totalAmount = (data || []).filter(r => r.comp_type !== "comp")
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const compHours = (data || []).filter(r => r.comp_type === "comp" && !r.comp_used && !r.comp_converted)
    .reduce((s, r) => s + Number(r.comp_hours || 0), 0);

  return Response.json({
    data,
    summary: { totalMinutes, totalAmount, compHours, count: (data || []).length }
  });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "create") {
    const { employee_id, store_id, date, overtime_minutes, overtime_type, notes } = body;
    const rates = {
      weekday_1: 1.34, weekday_2: 1.67,
      rest_1: 1.34, rest_2: 1.67, rest_3: 2.67, holiday: 2
    };
    const rate = rates[overtime_type] || 1.34;
    const { data: emp } = await supabase.from("employees")
      .select("hourly_rate, monthly_salary").eq("id", employee_id).single();
    const hourlyRate = emp?.hourly_rate ||
      (emp?.monthly_salary ? Math.round(emp.monthly_salary / 30 / 8) : 190);
    const amount = Math.round(hourlyRate * (overtime_minutes / 60) * rate);

    const { data, error } = await supabase.from("overtime_records").insert({
      employee_id, store_id, date, overtime_minutes, overtime_type,
      rate, amount, notes, status: "pending", comp_type: "pending",
    }).select("*, employees(name), stores(name)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (body.action === "review") {
    const { record_id, status, comp_type } = body;
    const updates = { status };

    if (status === "approved" && comp_type) {
      updates.comp_type = comp_type;
      if (comp_type === "comp") {
        const { data: rec } = await supabase.from("overtime_records")
          .select("overtime_minutes, date").eq("id", record_id).single();
        updates.comp_hours = Math.round((rec?.overtime_minutes || 0) / 60 * 10) / 10;
        const expiry = new Date(rec?.date || Date.now());
        expiry.setMonth(expiry.getMonth() + 6);
        updates.comp_expiry_date = expiry.toLocaleDateString("sv-SE");
        updates.comp_used = false;
        updates.comp_converted = false;
        updates.amount = 0;
      } else {
        updates.comp_hours = 0;
      }
    }

    const { data, error } = await supabase.from("overtime_records")
      .update(updates).eq("id", record_id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (body.action === "use_comp") {
    const { record_id } = body;
    await supabase.from("overtime_records")
      .update({ comp_used: true }).eq("id", record_id);
    return Response.json({ success: true });
  }

  if (body.action === "convert_expired") {
    const today = new Date().toLocaleDateString("sv-SE");
    const { data: expired } = await supabase.from("overtime_records")
      .select("id, employee_id, overtime_minutes, rate")
      .eq("comp_type", "comp").eq("comp_used", false).eq("comp_converted", false)
      .lte("comp_expiry_date", today);

    let converted = 0;
    for (const rec of expired || []) {
      const { data: emp } = await supabase.from("employees")
        .select("hourly_rate, monthly_salary").eq("id", rec.employee_id).single();
      const hr = emp?.hourly_rate || (emp?.monthly_salary ? Math.round(emp.monthly_salary / 30 / 8) : 190);
      const amt = Math.round(hr * (rec.overtime_minutes / 60) * (rec.rate || 1.34));
      await supabase.from("overtime_records").update({
        comp_converted: true, comp_type: "pay", amount: amt,
      }).eq("id", rec.id);
      converted++;
    }
    return Response.json({ success: true, converted });
  }

  if (body.action === "get_comp_balance") {
    const { employee_id } = body;
    const today = new Date().toLocaleDateString("sv-SE");
    const { data: avail } = await supabase.from("overtime_records")
      .select("id, date, comp_hours, comp_expiry_date")
      .eq("employee_id", employee_id).eq("status", "approved")
      .eq("comp_type", "comp").eq("comp_used", false).eq("comp_converted", false)
      .gte("comp_expiry_date", today).order("comp_expiry_date");
    const totalH = (avail || []).reduce((s, r) => s + Number(r.comp_hours || 0), 0);
    const { data: used } = await supabase.from("overtime_records")
      .select("comp_hours").eq("employee_id", employee_id)
      .eq("comp_type", "comp").eq("comp_used", true);
    const usedH = (used || []).reduce((s, r) => s + Number(r.comp_hours || 0), 0);
    return Response.json({ available: avail || [], totalHours: totalH, usedHours: usedH });
  }

  if (body.action === "delete") {
    await supabase.from("overtime_records").delete().eq("id", body.record_id);
    return Response.json({ success: true });
  }

  // 手動調整補休餘額
  if (body.action === "adjust_comp") {
    const { employee_id, store_id, hours, notes } = body;
    const today = new Date().toLocaleDateString("sv-SE");
    const expiry = new Date(Date.now() + 180 * 86400000).toLocaleDateString("sv-SE");
    if (hours > 0) {
      // 新增補休
      await supabase.from("overtime_records").insert({
        employee_id, store_id: store_id || null,
        date: today, overtime_minutes: hours * 60,
        comp_type: "comp", comp_hours: hours, comp_expiry_date: expiry,
        status: "approved", notes: "總部手動調整：" + (notes || ""),
      });
    } else if (hours < 0) {
      // 扣減補休：標記已使用
      let remain = Math.abs(hours);
      const { data: avail } = await supabase.from("overtime_records")
        .select("id, comp_hours").eq("employee_id", employee_id)
        .eq("comp_type", "comp").eq("comp_used", false).eq("comp_converted", false)
        .gte("comp_expiry_date", today).order("comp_expiry_date");
      for (const r of avail || []) {
        if (remain <= 0) break;
        if (Number(r.comp_hours) <= remain) {
          await supabase.from("overtime_records").update({ comp_used: true }).eq("id", r.id);
          remain -= Number(r.comp_hours);
        } else {
          await supabase.from("overtime_records").update({ comp_hours: Number(r.comp_hours) - remain }).eq("id", r.id);
          remain = 0;
        }
      }
    }
    return Response.json({ success: true });
  }

  // 部分補休轉現金（指定時數）+ 自動寫入薪資
  if (body.action === "convert_partial") {
    const { employee_id, store_id, hours } = body;
    if (!hours || hours <= 0) return Response.json({ error: "Invalid hours" }, { status: 400 });
    const { data: emp } = await supabase.from("employees")
      .select("hourly_rate, monthly_salary, name").eq("id", employee_id).single();
    const hr = emp?.hourly_rate || (emp?.monthly_salary ? Math.round(emp.monthly_salary / 30 / 8) : 190);
    const amount = Math.round(hr * hours * 1.34);

    let remain = hours;
    const today = new Date().toLocaleDateString("sv-SE");
    const { data: avail } = await supabase.from("overtime_records")
      .select("id, comp_hours, date").eq("employee_id", employee_id)
      .eq("comp_type", "comp").eq("comp_used", false).eq("comp_converted", false)
      .gte("comp_expiry_date", today).order("comp_expiry_date");
    for (const r of avail || []) {
      if (remain <= 0) break;
      if (Number(r.comp_hours) <= remain) {
        await supabase.from("overtime_records").update({ comp_converted: true, amount: Math.round(hr * Number(r.comp_hours) * 1.34) }).eq("id", r.id);
        remain -= Number(r.comp_hours);
      } else {
        const keepH = Number(r.comp_hours) - remain;
        await supabase.from("overtime_records").update({ comp_hours: keepH }).eq("id", r.id);
        await supabase.from("overtime_records").insert({
          employee_id, store_id, date: r.date || today,
          overtime_minutes: remain * 60, comp_type: "comp", comp_hours: remain,
          comp_converted: true, amount: Math.round(hr * remain * 1.34),
          status: "approved", notes: "部分轉現金",
        });
        remain = 0;
      }
    }
    // 自動寫入當月薪資加項
    const [y, m] = today.slice(0, 7).split("-").map(Number);
    const { data: pr } = await supabase.from("payroll_records")
      .select("id, allowance, allowance_note").eq("employee_id", employee_id).eq("year", y).eq("month", m).single()
      .catch(() => ({ data: null }));
    if (pr) {
      await supabase.from("payroll_records").update({
        allowance: Number(pr.allowance || 0) + amount,
        allowance_note: (pr.allowance_note ? pr.allowance_note + "、" : "") + "補休轉現金" + hours + "hr",
      }).eq("id", pr.id);
    }
    return Response.json({ success: true, converted_hours: hours, amount });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
