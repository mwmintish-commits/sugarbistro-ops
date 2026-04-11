import { supabase } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const type = searchParams.get("type");
  const status = searchParams.get("status");

  let query = supabase.from("payments").select("*, stores(name), employees(name)").order("created_at", { ascending: false });
  if (month) query = query.eq("month_key", month);
  if (type) query = query.eq("type", type);
  if (status) query = query.eq("status", status);

  const { data, error } = await query.limit(200);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const pending = (data || []).filter(p => p.status === "pending").reduce((s, p) => s + Number(p.amount || 0), 0);
  const paid = (data || []).filter(p => p.status === "paid").reduce((s, p) => s + Number(p.amount || 0), 0);
  return Response.json({ data, summary: { pending, paid, total: pending + paid } });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "create") {
    const { type, reference_id, store_id, employee_id, amount, recipient, month_key, notes } = body;
    const { data, error } = await supabase.from("payments").insert({
      type, reference_id, store_id, employee_id, amount, recipient, month_key: month_key || new Date().toISOString().slice(0, 7), notes,
    }).select("*, stores(name), employees(name)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (body.action === "mark_paid") {
    const { payment_id, paid_date } = body;
    const { data, error } = await supabase.from("payments").update({
      status: "paid", paid_date: paid_date || new Date().toLocaleDateString("sv-SE"),
    }).eq("id", payment_id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (body.action === "delete") {
    await supabase.from("payments").delete().eq("id", body.payment_id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
