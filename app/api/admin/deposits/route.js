import { supabase } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const store_id = searchParams.get("store_id");

  let query = supabase
    .from("deposits")
    .select("*, stores(name)")
    .order("deposit_date", { ascending: false });

  if (month) {
    query = query.gte("deposit_date", `${month}-01`).lte("deposit_date", `${month}-31`);
  }
  if (store_id) {
    query = query.eq("store_id", store_id);
  }

  const { data, error } = await query.limit(100);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}
