import { supabase } from "@/lib/supabase";
import { pushText } from "@/lib/line";

export async function GET() {
  const { data } = await supabase.from("announcements").select("*, employees:created_by(name)").eq("is_active", true).order("created_at", { ascending: false }).limit(20);
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();
  if (body.action === "create") {
    const { title, content, store_id, priority, created_by, expires_at, push_line } = body;
    const { data } = await supabase.from("announcements").insert({ title, content, store_id, priority: priority || "normal", created_by, expires_at }).select().single();

    // ✦31 LINE推播
    if (push_line) {
      let eq = supabase.from("employees").select("line_uid").eq("is_active", true).not("line_uid", "is", null);
      if (store_id) eq = eq.eq("store_id", store_id);
      const { data: targets } = await eq;
      const emoji = priority === "urgent" ? "🔴" : "📢";
      const msg = emoji + " 公告：" + title + "\n━━━━━━━━━━\n" + content;
      let sent = 0;
      for (const t of targets || []) {
        if (t.line_uid) { await pushText(t.line_uid, msg).catch(() => {}); sent++; }
      }
      return Response.json({ data, line_sent: sent });
    }
    return Response.json({ data });
  }
  if (body.action === "delete") {
    await supabase.from("announcements").update({ is_active: false }).eq("id", body.announcement_id);
    return Response.json({ success: true });
  }
  return Response.json({ error: "Unknown" }, { status: 400 });
}
