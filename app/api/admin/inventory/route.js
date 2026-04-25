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

  // 全域品項主檔；庫存若有 inventory_stock 表就用，否則 fallback 到 current_stock
  let q = supabase.from("inventory_items").select("*").eq("is_active", true).order("category").order("name");
  if (searchParams.get("type_filter")) q = q.eq("type", searchParams.get("type_filter"));
  const { data: items } = await q;

  let stocks = null;
  try {
    const r = await supabase.from("inventory_stock").select("*");
    if (!r.error) stocks = r.data;
  } catch (e) { stocks = null; }

  // 去重：同名只顯示一筆（保留 store_id=NULL 那筆，否則隨機留一筆）
  const byName = new Map();
  for (const it of items || []) {
    const k = it.name;
    if (!byName.has(k)) byName.set(k, it);
    else {
      const cur = byName.get(k);
      // 優先全域 store_id=NULL
      if (cur.store_id && !it.store_id) byName.set(k, it);
    }
  }
  const uniqItems = Array.from(byName.values());

  let data;
  if (stocks) {
    const stockBy = new Map();
    for (const s of stocks) {
      if (!stockBy.has(s.item_id)) stockBy.set(s.item_id, []);
      stockBy.get(s.item_id).push(s);
    }
    // 同名所有 inventory_items.id 都映射到 keeper
    const aliasGroups = new Map(); // name -> [ids]
    for (const it of items || []) {
      if (!aliasGroups.has(it.name)) aliasGroups.set(it.name, []);
      aliasGroups.get(it.name).push(it.id);
    }
    data = uniqItems.map(i => {
      const allIds = aliasGroups.get(i.name) || [i.id];
      const ss = allIds.flatMap(id => stockBy.get(id) || []);
      const filtered = store_id ? ss.filter(s => s.store_id === store_id) : ss;
      const current = filtered.reduce((sum, s) => sum + Number(s.current_stock || 0), 0);
      const stocksByStore = ss.reduce((acc, s) => {
        acc[s.store_id] = (acc[s.store_id] || 0) + Number(s.current_stock || 0);
        return acc;
      }, {});
      return { ...i, current_stock: current, stocks_by_store: stocksByStore };
    });
  } else {
    // Fallback：直接用 inventory_items.current_stock，同名加總
    data = uniqItems.map(i => {
      const same = (items || []).filter(x => x.name === i.name);
      const total = same.reduce((s, x) => s + Number(x.current_stock || 0), 0);
      return { ...i, current_stock: total, stocks_by_store: {} };
    });
  }
  const total = data.reduce((s, i) => s + Number(i.current_stock || 0) * Number(i.cost_per_unit || 0), 0);
  return Response.json({ data, summary: { count: data.length, totalValue: total } });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "create") {
    const { name, sku, type, category, unit, safe_stock, cost_per_unit, supplier_name, expiry_days, notes, zone, par_level, alert_threshold, is_key_item } = body;
    // 全域品項：store_id 強制 NULL
    const { data, error } = await supabase.from("inventory_items").insert({
      name, sku, type: type || "raw_material", category, unit, safe_stock, cost_per_unit,
      store_id: null, supplier_name, expiry_days, notes, zone,
      par_level, alert_threshold: alert_threshold || 2, is_key_item: !!is_key_item, is_active: true,
    }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    // 為所有啟用門市建立 inventory_stock（若表存在）
    try {
      const { data: stores } = await supabase.from("stores").select("id").eq("is_active", true);
      if (stores?.length) {
        await supabase.from("inventory_stock").insert(stores.map(s => ({ item_id: data.id, store_id: s.id, current_stock: 0 })));
      }
    } catch (e) {}
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
    const { item_id, type, quantity, unit_cost, reference_type, reference_id, batch_number, expiry_date, from_store_id, to_store_id, store_id, operated_by, operated_by_name, notes } = body;
    await supabase.from("inventory_movements").insert({ item_id, type, quantity, unit_cost, reference_type, reference_id, batch_number, expiry_date, from_store_id, to_store_id, store_id, operated_by, operated_by_name, notes });
    const delta = type === "in" || type === "adjust" ? quantity : -quantity;
    const sid = to_store_id || store_id || from_store_id;
    let written = false;
    if (sid) {
      try {
        const { data: cur, error: e1 } = await supabase.from("inventory_stock").select("current_stock").eq("item_id", item_id).eq("store_id", sid).maybeSingle();
        if (!e1) {
          const newStock = Number(cur?.current_stock || 0) + delta;
          const { error: e2 } = await supabase.from("inventory_stock").upsert({
            item_id, store_id: sid, current_stock: Math.max(0, newStock), updated_at: new Date().toISOString(),
          }, { onConflict: "item_id,store_id" });
          if (!e2) written = true;
        }
      } catch (e) {}
    }
    if (!written) {
      // Fallback：寫到 inventory_items.current_stock
      const { data: item } = await supabase.from("inventory_items").select("current_stock").eq("id", item_id).single();
      const newStock = Number(item?.current_stock || 0) + delta;
      await supabase.from("inventory_items").update({ current_stock: Math.max(0, newStock) }).eq("id", item_id);
    }
    if (unit_cost) await supabase.from("inventory_items").update({ cost_per_unit: unit_cost }).eq("id", item_id);
    return Response.json({ success: true });
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
      notes: "總部叫貨收貨",
    });
    let written = false;
    if (po.store_id) {
      try {
        const { data: cur, error: e1 } = await supabase.from("inventory_stock").select("current_stock").eq("item_id", po.item_id).eq("store_id", po.store_id).maybeSingle();
        if (!e1) {
          const newStock = Number(cur?.current_stock || 0) + qty;
          const { error: e2 } = await supabase.from("inventory_stock").upsert({
            item_id: po.item_id, store_id: po.store_id, current_stock: Math.max(0, newStock), updated_at: new Date().toISOString(),
          }, { onConflict: "item_id,store_id" });
          if (!e2) written = true;
        }
      } catch (e) {}
    }
    if (!written) {
      const { data: item } = await supabase.from("inventory_items").select("current_stock").eq("id", po.item_id).single();
      await supabase.from("inventory_items").update({ current_stock: Math.max(0, Number(item?.current_stock || 0) + qty) }).eq("id", po.item_id);
    }
    if (cost) await supabase.from("inventory_items").update({ cost_per_unit: cost }).eq("id", po.item_id);
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
