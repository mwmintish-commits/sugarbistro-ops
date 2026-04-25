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

  // 叫貨單列表
  if (type === "orders") {
    const status = searchParams.get("status"); // pending|received|cancelled，留空=全部
    let q = supabase.from("purchase_orders")
      .select("*, inventory_items(name, unit, zone, category, supplier_name), stores(name)")
      .order("requested_at", { ascending: false });
    if (store_id) q = q.eq("store_id", store_id);
    if (status) q = q.eq("status", status);
    const { data } = await q.limit(200);
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
    const { name, sku, type, category, unit, safe_stock, cost_per_unit, store_id, supplier_name, expiry_days, notes, zone } = body;
    const { data, error } = await supabase.from("inventory_items").insert({ name, sku, type, category, unit, safe_stock, cost_per_unit, store_id, supplier_name, expiry_days, notes, zone }).select().single();
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

  // 叫貨：建立訂單
  if (body.action === "order_create") {
    const { item_id, quantity, store_id, unit, unit_cost, supplier_name, expected_date, notes, requested_by, requested_by_name } = body;
    if (!item_id || !quantity) return Response.json({ error: "缺少品項或數量" }, { status: 400 });
    // 自動帶出 unit/cost/supplier（若未指定）
    const { data: it } = await supabase.from("inventory_items").select("unit, cost_per_unit, supplier_name, store_id").eq("id", item_id).single();
    const { data, error } = await supabase.from("purchase_orders").insert({
      item_id, quantity: Number(quantity),
      store_id: store_id || it?.store_id || null,
      unit: unit || it?.unit, unit_cost: unit_cost ?? it?.cost_per_unit,
      supplier_name: supplier_name || it?.supplier_name,
      expected_date: expected_date || null, notes: notes || null,
      requested_by, requested_by_name, status: "pending",
    }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  // 叫貨：收貨（自動入庫 + 更新單價）
  if (body.action === "order_receive") {
    const { order_id, received_qty, received_by, received_by_name, unit_cost } = body;
    const { data: po } = await supabase.from("purchase_orders").select("*").eq("id", order_id).single();
    if (!po) return Response.json({ error: "訂單不存在" }, { status: 404 });
    if (po.status !== "pending") return Response.json({ error: "訂單已處理" }, { status: 400 });
    const qty = Number(received_qty ?? po.quantity);
    const cost = unit_cost ?? po.unit_cost;
    // 寫入 movement + 更新庫存（沿用既有邏輯）
    await supabase.from("inventory_movements").insert({
      item_id: po.item_id, type: "in", quantity: qty, unit_cost: cost,
      reference_type: "purchase_order", reference_id: order_id,
      to_store_id: po.store_id, operated_by: received_by, operated_by_name: received_by_name,
      notes: "叫貨收貨：" + (po.supplier_name || ""),
    });
    const { data: item } = await supabase.from("inventory_items").select("current_stock").eq("id", po.item_id).single();
    const newStock = Number(item?.current_stock || 0) + qty;
    const updates = { current_stock: Math.max(0, newStock) };
    if (cost) updates.cost_per_unit = cost;
    await supabase.from("inventory_items").update(updates).eq("id", po.item_id);
    // 更新訂單
    await supabase.from("purchase_orders").update({
      status: "received", received_qty: qty, received_by, received_by_name,
      received_at: new Date().toISOString(), unit_cost: cost,
    }).eq("id", order_id);
    return Response.json({ success: true, new_stock: newStock });
  }

  // 叫貨：取消
  if (body.action === "order_cancel") {
    const { order_id, cancelled_reason } = body;
    await supabase.from("purchase_orders").update({
      status: "cancelled", cancelled_reason: cancelled_reason || "",
    }).eq("id", order_id);
    return Response.json({ success: true });
  }

  if (body.action === "delete") {
    await supabase.from("inventory_items").update({ is_active: false }).eq("id", body.item_id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown" }, { status: 400 });
}
