import { supabase } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const store_id = searchParams.get("store_id");
  let query = supabase.from("shifts").select("*, stores(name)").eq("is_active", true).order("start_time");
  if (store_id) query = query.eq("store_id", store_id);
  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();
  const { action } = body;

  if (action === "create") {
    const { store_id, name, start_time, end_time, break_minutes, work_hours, role, color } = body;
    const { data, error } = await supabase.from("shifts").insert({
      store_id, name, start_time, end_time,
      break_minutes: break_minutes || 60,
      work_hours: work_hours || 8,
      role: role || "全場",
      color: color || "#0a7c42",
    }).select("*, stores(name)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (action === "update") {
    const { shift_id, ...updates } = body;
    delete updates.action;
    const { data, error } = await supabase.from("shifts").update(updates).eq("id", shift_id).select("*, stores(name)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (action === "delete") {
    const { shift_id } = body;
    await supabase.from("shifts").update({ is_active: false }).eq("id", shift_id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
