import { supabase } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const store_id = searchParams.get("store_id");
  const month = searchParams.get("month");

  let q = supabase.from("production_orders").select("*, stores(name)").order("production_date", { ascending: false });
  if (status) q = q.eq("status", status);
  if (store_id) q = q.eq("store_id", store_id);
  if (month) q = q.gte("production_date", month + "-01").lte("production_date", month + "-31");
  const { data } = await q.limit(200);

  const totalPlanned = (data || []).reduce((s, o) => s + Number(o.planned_qty || 0), 0);
  const totalActual = (data || []).reduce((s, o) => s + Number(o.actual_qty || 0), 0);
  const avgYield = totalPlanned > 0 ? Math.round(totalActual / totalPlanned * 100) : 0;
  return Response.json({ data, summary: { count: (data || []).length, totalPlanned, totalActual, avgYield } });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "create") {
    const { recipe_id, recipe_name, planned_qty, store_id, production_date, order_type, client_order_id, assigned_to, assigned_name, notes } = body;
    const num = "PO-" + (production_date || new Date().toISOString().slice(0, 10)).replace(/-/g, "") + "-" + String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
    const { data, error } = await supabase.from("production_orders").insert({
      order_number: num, recipe_id, recipe_name, planned_qty, store_id, production_date: production_date || new Date().toLocaleDateString("sv-SE"), order_type: order_type || "stock", client_order_id, assigned_to, assigned_name, notes,
    }).select("*, stores(name)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (body.action === "start") {
    const { order_id } = body;
    const { data } = await supabase.from("production_orders").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", order_id).select().single();

    // 自動領料（依配方扣庫存）
    const po = data;
    if (po?.recipe_id) {
      const { data: ings } = await supabase.from("recipe_ingredients").select("item_id, quantity").eq("recipe_id", po.recipe_id);
      const { data: recipe } = await supabase.from("recipes").select("yield_qty").eq("id", po.recipe_id).single();
      const ratio = recipe?.yield_qty > 0 ? po.planned_qty / recipe.yield_qty : 1;
      for (const ing of ings || []) {
        const useQty = Number(ing.quantity) * ratio;
        await supabase.from("inventory_movements").insert({ item_id: ing.item_id, type: "out", quantity: useQty, reference_type: "production", reference_id: po.id, notes: "生產領料 " + po.order_number });
        const { data: item } = await supabase.from("inventory_items").select("current_stock").eq("id", ing.item_id).single();
        await supabase.from("inventory_items").update({ current_stock: Math.max(0, Number(item?.current_stock || 0) - useQty) }).eq("id", ing.item_id);
      }
    }
    return Response.json({ data });
  }

  if (body.action === "complete") {
    const { order_id, actual_qty, waste_qty, notes } = body;
    const planned = (await supabase.from("production_orders").select("planned_qty, recipe_id, recipe_name").eq("id", order_id).single()).data;
    const yieldRate = planned?.planned_qty > 0 ? Math.round((actual_qty || 0) / planned.planned_qty * 100) : 0;
    const { data } = await supabase.from("production_orders").update({ status: "completed", actual_qty, waste_qty: waste_qty || 0, yield_rate: yieldRate, completed_at: new Date().toISOString(), notes }).eq("id", order_id).select().single();

    // 成品入庫
    if (actual_qty > 0 && planned?.recipe_id) {
      const { data: existing } = await supabase.from("inventory_items").select("id, current_stock").eq("sku", "FG-" + planned.recipe_id.slice(0, 8)).single();
      if (existing) {
        await supabase.from("inventory_items").update({ current_stock: Number(existing.current_stock) + actual_qty }).eq("id", existing.id);
        await supabase.from("inventory_movements").insert({ item_id: existing.id, type: "in", quantity: actual_qty, reference_type: "production", reference_id: order_id, notes: "生產入庫 " + (data?.order_number || "") });
      }
    }
    return Response.json({ data });
  }

  if (body.action === "cancel") {
    await supabase.from("production_orders").update({ status: "cancelled" }).eq("id", body.order_id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown" }, { status: 400 });
}
