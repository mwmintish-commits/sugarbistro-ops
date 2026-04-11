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
    const { store_id, daily_target, monthly_target, latitude, longitude, radius_m } = body;
    const updates = {};
    if (daily_target !== undefined) updates.daily_target = daily_target;
    if (monthly_target !== undefined) updates.monthly_target = monthly_target;
    if (latitude !== undefined) updates.latitude = latitude;
    if (longitude !== undefined) updates.longitude = longitude;
    if (radius_m !== undefined) updates.radius_m = radius_m;
    const { data, error } = await supabase.from("stores").update(updates).eq("id", store_id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }
  return Response.json({ error: "Unknown" }, { status: 400 });
}
