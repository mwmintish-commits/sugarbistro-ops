import { supabase, eom } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const store_id = searchParams.get("store_id");

  let query = supabase
    .from("deposits")
    .select("*, stores(name)")
    .order("deposit_date", { ascending: false });

  if (month) {
    query = query.gte("deposit_date", `${month}-01`).lte("deposit_date", `${eom(month)}`);
  }
  if (store_id) {
    query = query.eq("store_id", store_id);
  }

  const { data, error } = await query.limit(100);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "update") {
    const { deposit_id, difference_explanation } = body;
    const updates = {};
    if (difference_explanation !== undefined) updates.difference_explanation = difference_explanation;
    const { data, error } = await supabase.from("deposits")
      .update(updates).eq("id", deposit_id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
