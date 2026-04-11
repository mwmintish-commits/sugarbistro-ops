import { supabase } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const status = searchParams.get("status");
  const type = searchParams.get("type");

  if (id) {
    const { data: order } = await supabase.from("client_orders").select("*, clients(name, contact_person, phone, address)").eq("id", id).single();
    const { data: items } = await supabase.from("client_order_items").select("*").eq("order_id", id).order("id");
    return Response.json({ data: { ...order, items } });
  }

  let q = supabase.from("client_orders").select("*, clients(name)").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  if (type) q = q.eq("type", type);
  const { data } = await q.limit(200);

  const unpaid = (data || []).filter(o => o.payment_status !== "paid").reduce((s, o) => s + Number(o.total_amount || 0) - Number(o.paid_amount || 0), 0);
  return Response.json({ data, summary: { count: (data || []).length, unpaid } });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "create") {
    const { client_id, type, delivery_date, shipping_address, shipping_method, notes, items } = body;
    const prefix = type === "oem" ? "OEM" : "B2B";
    const num = prefix + "-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
    const total = (items || []).reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);

    const { data: order, error } = await supabase.from("client_orders").insert({
      order_number: num, client_id, type, delivery_date, shipping_address, shipping_method, notes, total_amount: total,
    }).select("*, clients(name)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });

    if (items?.length) {
      const orderItems = items.map(i => ({ order_id: order.id, recipe_id: i.recipe_id, item_id: i.item_id, product_name: i.product_name, quantity: i.quantity, unit: i.unit, unit_price: i.unit_price, total_price: Number(i.quantity) * Number(i.unit_price) }));
      await supabase.from("client_order_items").insert(orderItems);
    }
    return Response.json({ data: order });
  }

  if (body.action === "update_status") {
    const { order_id, status, shipped_date, delivered_date, tracking_number, invoice_number, paid_amount, paid_date } = body;
    const updates = { status };
    if (shipped_date) updates.shipped_date = shipped_date;
    if (delivered_date) updates.delivered_date = delivered_date;
    if (tracking_number) updates.tracking_number = tracking_number;
    if (invoice_number) updates.invoice_number = invoice_number;
    if (paid_amount !== undefined) { updates.paid_amount = paid_amount; updates.paid_date = paid_date || new Date().toLocaleDateString("sv-SE"); updates.payment_status = "paid"; }
    const { data } = await supabase.from("client_orders").update(updates).eq("id", order_id).select("*, clients(name)").single();
    return Response.json({ data });
  }

  if (body.action === "delete") {
    await supabase.from("client_order_items").delete().eq("order_id", body.order_id);
    await supabase.from("client_orders").delete().eq("id", body.order_id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown" }, { status: 400 });
}
