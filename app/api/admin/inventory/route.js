import { supabase } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const store_id = searchParams.get("store_id");

  if (type === "movements") {
    const item_id = searchParams.get("item_id");
    let q = supabase.from("inventory_movements").select("*").order("created_at", { ascending: false });
    if (item_id) q = q.eq("item_id", item_id);
    const { data } = await q.limit(100);
    return Response.json({ data });
  }

  if (type === "low_stock") {
    const { data } = await supabase.from("inventory_items").select("*").eq("is_active", true).order("name");
    const low = (data || []).filter(i => i.safe_stock > 0 && i.current_stock <= i.safe_stock);
    return Response.json({ data: low });
  }

  let q = supabase.from("inventory_items").select("*").eq("is_active", true).order("category").order("name");
  if (store_id) q = q.eq("store_id", store_id);
  if (searchParams.get("type_filter")) q = q.eq("type", searchParams.get("type_filter"));
  const { data } = await q;
  const total = (data || []).reduce((s, i) => s + Number(i.current_stock || 0) * Number(i.cost_per_unit || 0), 0);
  return Response.json({ data, summary: { count: (data || []).length, totalValue: total } });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "create") {
    const { name, sku, type, category, unit, safe_stock, cost_per_unit, store_id, supplier_name, expiry_days, notes } = body;
    const { data, error } = await supabase.from("inventory_items").insert({ name, sku, type, category, unit, safe_stock, cost_per_unit, store_id, supplier_name, expiry_days, notes }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (body.action === "update") {
    const { item_id, ...updates } = body;
    delete updates.action;
    const { data, error } = await supabase.from("inventory_items").update(updates).eq("id", item_id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (body.action === "movement") {
    const { item_id, type, quantity, unit_cost, reference_type, reference_id, batch_number, expiry_date, from_store_id, to_store_id, operated_by, operated_by_name, notes } = body;
    await supabase.from("inventory_movements").insert({ item_id, type, quantity, unit_cost, reference_type, reference_id, batch_number, expiry_date, from_store_id, to_store_id, operated_by, operated_by_name, notes });
    // 更新庫存
    const delta = type === "in" || type === "adjust" ? quantity : -quantity;
    const { data: item } = await supabase.from("inventory_items").select("current_stock").eq("id", item_id).single();
    const newStock = Number(item?.current_stock || 0) + delta;
    await supabase.from("inventory_items").update({ current_stock: Math.max(0, newStock), cost_per_unit: unit_cost || undefined }).eq("id", item_id);
    return Response.json({ success: true, new_stock: newStock });
  }

  if (body.action === "delete") {
    await supabase.from("inventory_items").update({ is_active: false }).eq("id", body.item_id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown" }, { status: 400 });
}
