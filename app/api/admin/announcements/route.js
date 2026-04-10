import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data } = await supabase.from("announcements").select("*, employees:created_by(name)").eq("is_active", true).order("created_at", { ascending: false }).limit(20);
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();
  if (body.action === "create") {
    const { title, content, store_id, priority, created_by, expires_at } = body;
    const { data } = await supabase.from("announcements").insert({ title, content, store_id, priority: priority || "normal", created_by, expires_at }).select().single();
    return Response.json({ data });
  }
  if (body.action === "delete") {
    await supabase.from("announcements").update({ is_active: false }).eq("id", body.announcement_id);
    return Response.json({ success: true });
  }
  return Response.json({ error: "Unknown" }, { status: 400 });
}
