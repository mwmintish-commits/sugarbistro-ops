import { supabase } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const client_id = searchParams.get("client_id");

  if (id) {
    const { data: product } = await supabase.from("products").select("*").eq("id", id).single();
    const { data: variants } = await supabase.from("product_variants").select("*")
      .eq("product_id", id).eq("is_active", true).order("sort_order");
    return Response.json({ data: { ...product, variants } });
  }

  // 產品列表含規格
  const { data: products } = await supabase.from("products").select("*")
    .eq("is_active", true).order("sort_order").order("name");
  const { data: allVariants } = await supabase.from("product_variants").select("*")
    .eq("is_active", true).order("sort_order");

  const result = (products || []).map(p => ({
    ...p,
    variants: (allVariants || []).filter(v => v.product_id === p.id),
  }));

  // 如果指定客戶，帶入特約價
  if (client_id) {
    const { data: prices } = await supabase.from("client_prices").select("*").eq("client_id", client_id);
    const priceMap = {};
    for (const p of prices || []) priceMap[p.variant_id] = p.special_price;
    for (const prod of result) {
      for (const v of prod.variants) {
        v.client_price = priceMap[v.id] || null;
      }
    }
  }

  return Response.json({ data: result });
}

export async function POST(request) {
  const body = await request.json();

  // 新增產品
  if (body.action === "create") {
    const { name, category, description } = body;
    const { data, error } = await supabase.from("products").insert({ name, category, description }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  // 更新產品
  if (body.action === "update") {
    const { product_id, ...updates } = body;
    delete updates.action;
    const { data } = await supabase.from("products").update(updates).eq("id", product_id).select().single();
    return Response.json({ data });
  }

  // 刪除產品（軟刪）
  if (body.action === "delete") {
    await supabase.from("products").update({ is_active: false }).eq("id", body.product_id);
    return Response.json({ success: true });
  }

  // 新增規格
  if (body.action === "add_variant") {
    const { product_id, spec_name, sku, unit, retail_price, wholesale_price, oem_price, cost_price, recipe_id, inventory_item_id } = body;
    const { data, error } = await supabase.from("product_variants").insert({
      product_id, spec_name, sku, unit,
      retail_price: retail_price || 0, wholesale_price: wholesale_price || 0,
      oem_price: oem_price || 0, cost_price: cost_price || 0,
      recipe_id, inventory_item_id,
    }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  // 更新規格
  if (body.action === "update_variant") {
    const { variant_id, ...updates } = body;
    delete updates.action;
    const { data } = await supabase.from("product_variants").update(updates).eq("id", variant_id).select().single();
    return Response.json({ data });
  }

  // 刪除規格
  if (body.action === "delete_variant") {
    await supabase.from("product_variants").update({ is_active: false }).eq("id", body.variant_id);
    return Response.json({ success: true });
  }

  // 設定客戶特約價
  if (body.action === "set_client_price") {
    const { client_id, variant_id, special_price } = body;
    const { data } = await supabase.from("client_prices").upsert({
      client_id, variant_id, special_price,
    }, { onConflict: "client_id,variant_id" }).select().single();
    return Response.json({ data });
  }

  // 刪除客戶特約價
  if (body.action === "delete_client_price") {
    await supabase.from("client_prices").delete().eq("id", body.price_id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
