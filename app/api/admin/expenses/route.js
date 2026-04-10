import { supabase } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // vendor, petty_cash, or all
  const store_id = searchParams.get("store_id");
  const month = searchParams.get("month");
  const status = searchParams.get("status");

  if (searchParams.get("categories")) {
    const { data } = await supabase.from("expense_categories").select("*").eq("is_active", true).order("sort_order");
    return Response.json({ data });
  }

  let q = supabase.from("expenses").select("*, stores(name), expense_categories(name, type), employees:submitted_by(name)").order("date", { ascending: false });
  if (type && type !== "all") q = q.eq("expense_type", type);
  if (store_id) q = q.eq("store_id", store_id);
  if (month) q = q.eq("month_key", month);
  if (status) q = q.eq("status", status);
  const { data } = await q.limit(200);

  // 小計
  const total = (data || []).reduce((s, e) => s + Number(e.amount || 0), 0);
  const byCategory = {};
  for (const e of data || []) {
    const cat = e.expense_categories?.name || "未分類";
    byCategory[cat] = (byCategory[cat] || 0) + Number(e.amount || 0);
  }

  return Response.json({ data, total, byCategory });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "create") {
    const { store_id, category_id, expense_type, date, amount, vendor_name, description, image_url, ai_raw_data, submitted_by } = body;
    const monthKey = date?.slice(0, 7);
    const { data, error } = await supabase.from("expenses").insert({
      store_id, category_id, expense_type, date, amount, vendor_name, description,
      image_url, ai_raw_data, submitted_by, month_key: monthKey,
    }).select("*, expense_categories(name)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (body.action === "review") {
    const { expense_id, status, reviewed_by } = body;
    const { data } = await supabase.from("expenses").update({
      status, reviewed_by, reviewed_at: new Date().toISOString(),
    }).eq("id", expense_id).select().single();
    return Response.json({ data });
  }

  return Response.json({ error: "Unknown" }, { status: 400 });
}
