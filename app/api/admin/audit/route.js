import { supabase, eom } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const target_type = searchParams.get("target_type");

  let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false });
  if (month) q = q.gte("created_at", month + "-01T00:00:00").lte("created_at", eom(month) + "T23:59:59");
  if (target_type) q = q.eq("target_type", target_type);
  const { data } = await q.limit(100);
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();
  if (body.action === "log") {
    const { user_id, user_name, log_action, target_type, target_id, details } = body;
    await supabase.from("audit_logs").insert({
      user_id, user_name, action: log_action, target_type, target_id, details
    });
    return Response.json({ success: true });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
