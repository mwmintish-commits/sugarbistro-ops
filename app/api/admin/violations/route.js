import { supabase, eom } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const employee_id = searchParams.get("employee_id");
  const store_id = searchParams.get("store_id");
  const quarter_key = searchParams.get("quarter_key");

  let q = supabase.from("violations").select("*, employees:employee_id(name), stores:store_id(name)").order("created_at", { ascending: false });
  if (employee_id) q = q.eq("employee_id", employee_id);
  if (store_id) q = q.eq("store_id", store_id);
  if (quarter_key) q = q.eq("quarter_key", quarter_key);
  const { data } = await q.limit(100);
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "create") {
    const { employee_id, store_id, level, category, description, action_taken, reported_by } = body;
    const now = new Date();
    const qk = now.getFullYear() + "-Q" + Math.ceil((now.getMonth() + 1) / 3);
    const { data, error } = await supabase.from("violations").insert({
      employee_id, store_id, level, category, description, action_taken, reported_by, quarter_key: qk
    }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (body.action === "delete") {
    await supabase.from("violations").delete().eq("id", body.violation_id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
