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
    const { deposit_id, ...rest } = body;
    delete rest.action;
    const updates = {};
    ["difference_explanation","amount","period_start","period_end","deposit_date","status"].forEach(k=>{if(rest[k]!==undefined)updates[k]=rest[k];});
    const { data, error } = await supabase.from("deposits")
      .update(updates).eq("id", deposit_id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (body.action === "delete") {
    const { error } = await supabase.from("deposits").delete().eq("id", body.deposit_id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
