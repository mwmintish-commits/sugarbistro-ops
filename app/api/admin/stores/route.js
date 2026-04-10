import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();
  if (body.action === "update_targets") {
    const { store_id, daily_target, monthly_target } = body;
    const { data, error } = await supabase.from("stores").update({
      daily_target: daily_target || 0, monthly_target: monthly_target || 0,
    }).eq("id", store_id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }
  return Response.json({ error: "Unknown" }, { status: 400 });
}
