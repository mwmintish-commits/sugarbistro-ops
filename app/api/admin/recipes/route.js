import { supabase } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const { data: recipe } = await supabase.from("recipes").select("*").eq("id", id).single();
    const { data: ingredients } = await supabase.from("recipe_ingredients").select("*, inventory_items(name, unit, cost_per_unit)").eq("recipe_id", id).order("sort_order");
    const totalCost = (ingredients || []).reduce((s, i) => s + Number(i.quantity || 0) * Number(i.inventory_items?.cost_per_unit || 0), 0);
    const costPerUnit = recipe?.yield_qty > 0 ? Math.round(totalCost / recipe.yield_qty * 100) / 100 : 0;
    return Response.json({ data: { ...recipe, ingredients, totalCost, costPerUnit } });
  }

  const { data } = await supabase.from("recipes").select("*, stores(name)").eq("is_active", true).order("category").order("name");
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "create") {
    const { name, sku, category, type, yield_qty, yield_unit, labor_minutes, instructions, selling_price, wholesale_price, store_id } = body;
    const { data, error } = await supabase.from("recipes").insert({ name, sku, category, type, yield_qty, yield_unit, labor_minutes, instructions, selling_price, wholesale_price, store_id }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (body.action === "update") {
    const { recipe_id, ...updates } = body;
    delete updates.action;
    const { data } = await supabase.from("recipes").update(updates).eq("id", recipe_id).select().single();
    return Response.json({ data });
  }

  if (body.action === "add_ingredient") {
    const { recipe_id, item_id, item_name, quantity, unit, sort_order } = body;
    const { data } = await supabase.from("recipe_ingredients").insert({ recipe_id, item_id, item_name, quantity, unit, sort_order }).select().single();
    // 重算成本
    const { data: ings } = await supabase.from("recipe_ingredients").select("quantity, inventory_items(cost_per_unit)").eq("recipe_id", recipe_id);
    const { data: recipe } = await supabase.from("recipes").select("yield_qty, selling_price, wholesale_price").eq("id", recipe_id).single();
    const tc = (ings || []).reduce((s, i) => s + Number(i.quantity || 0) * Number(i.inventory_items?.cost_per_unit || 0), 0);
    const cpu = recipe?.yield_qty > 0 ? Math.round(tc / recipe.yield_qty * 100) / 100 : 0;
    const margin = recipe?.selling_price > 0 ? Math.round((1 - cpu / recipe.selling_price) * 10000) / 100 : 0;
    await supabase.from("recipes").update({ cost_per_unit: cpu, margin_percent: margin }).eq("id", recipe_id);
    return Response.json({ data, cost_per_unit: cpu });
  }

  if (body.action === "remove_ingredient") {
    await supabase.from("recipe_ingredients").delete().eq("id", body.ingredient_id);
    return Response.json({ success: true });
  }

  if (body.action === "delete") {
    await supabase.from("recipes").update({ is_active: false }).eq("id", body.recipe_id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown" }, { status: 400 });
}
