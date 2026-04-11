import { supabase } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const store_id = searchParams.get("store_id");
  const employee_id = searchParams.get("employee_id");

  let query = supabase.from("overtime_records").select("*, employees(name, store_id), stores(name)").order("date", { ascending: false });
  if (month) query = query.gte("date", month + "-01").lte("date", month + "-31");
  if (store_id) query = query.eq("store_id", store_id);
  if (employee_id) query = query.eq("employee_id", employee_id);

  const { data, error } = await query.limit(200);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const totalMinutes = (data || []).reduce((s, r) => s + (r.overtime_minutes || 0), 0);
  const totalAmount = (data || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  return Response.json({ data, summary: { totalMinutes, totalAmount, count: (data || []).length } });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "create") {
    const { employee_id, store_id, date, overtime_minutes, overtime_type, notes } = body;
    const rates = { weekday_1: 1.34, weekday_2: 1.67, rest_1: 1.34, rest_2: 1.67, rest_3: 2.67, holiday: 2 };
    const rate = rates[overtime_type] || 1.34;
    const { data: emp } = await supabase.from("employees").select("hourly_rate, monthly_salary").eq("id", employee_id).single();
    const hourlyRate = emp?.hourly_rate || (emp?.monthly_salary ? Math.round(emp.monthly_salary / 30 / 8) : 190);
    const amount = Math.round(hourlyRate * (overtime_minutes / 60) * rate);

    const { data, error } = await supabase.from("overtime_records").insert({
      employee_id, store_id, date, overtime_minutes, overtime_type, rate, amount, notes,
    }).select("*, employees(name), stores(name)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (body.action === "review") {
    const { record_id, status, comp_type } = body;
    const updates = { status };
    if (comp_type) updates.comp_type = comp_type;
    if (comp_type === "comp") {
      const rec = await supabase.from("overtime_records").select("overtime_minutes").eq("id", record_id).single();
      updates.comp_hours = Math.round((rec.data?.overtime_minutes || 0) / 60 * 10) / 10;
    }
    const { data, error } = await supabase.from("overtime_records").update(updates).eq("id", record_id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (body.action === "delete") {
    await supabase.from("overtime_records").delete().eq("id", body.record_id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
