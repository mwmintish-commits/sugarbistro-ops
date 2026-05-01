import { supabase } from "@/lib/supabase";
import { pushText } from "@/lib/line";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tag = searchParams.get("tag");
  let q = supabase.from("announcements").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(50);
  if (tag) q = q.eq("tag", tag);
  if (searchParams.get("active_only") === "1") {
    const today = new Date().toLocaleDateString("sv-SE");
    q = q.or(`starts_at.is.null,starts_at.lte.${today}`).or(`expires_at.is.null,expires_at.gte.${today}`);
  }
  const { data, error: getErr } = await q;
  if (getErr) return Response.json({ error: getErr.message, data: [] });
  if (!data || data.length === 0) return Response.json({ data: [] });

  // 取各公告的已讀人數
  const ids = data.map(a => a.id);
  const { data: reads } = await supabase.from("announcement_reads")
    .select("announcement_id")
    .in("announcement_id", ids);
  const countMap = {};
  for (const r of reads || []) {
    countMap[r.announcement_id] = (countMap[r.announcement_id] || 0) + 1;
  }
  const result = data.map(a => ({ ...a, read_count: countMap[a.id] || 0 }));
  return Response.json({ data: result });
}

export async function POST(request) {
  const body = await request.json();
  if (body.action === "create") {
    const { title, content, store_id, priority, created_by, starts_at, expires_at, tag, push_line } = body;
    const { data, error: insErr } = await supabase.from("announcements").insert({
      title, content,
      store_id: store_id || null,
      priority: priority || "normal",
      created_by: created_by || null,
      starts_at: starts_at || null,
      expires_at: expires_at || null,
      tag: tag || null,
    }).select().single();
    if (insErr) return Response.json({ error: insErr.message }, { status: 500 });

    if (push_line) {
      let eq = supabase.from("employees").select("line_uid").eq("is_active", true).not("line_uid", "is", null);
      if (store_id) eq = eq.eq("store_id", store_id);
      const { data: targets } = await eq;
      const emoji = priority === "urgent" ? "🔴" : "📢";
      const tagStr = tag ? `[${tag}] ` : "";
      const msg = emoji + " 公告：" + tagStr + title + "\n━━━━━━━━━━\n" + content;
      let sent = 0;
      for (const t of targets || []) {
        if (t.line_uid) { await pushText(t.line_uid, msg).catch(() => {}); sent++; }
      }
      return Response.json({ data, line_sent: sent });
    }
    return Response.json({ data });
  }
  if (body.action === "update") {
    const { announcement_id, title, content, store_id, priority, starts_at, expires_at, tag } = body;
    const patch = {};
    if (title !== undefined) patch.title = title;
    if (content !== undefined) patch.content = content;
    if (store_id !== undefined) patch.store_id = store_id || null;
    if (priority !== undefined) patch.priority = priority;
    if (starts_at !== undefined) patch.starts_at = starts_at || null;
    if (expires_at !== undefined) patch.expires_at = expires_at || null;
    if (tag !== undefined) patch.tag = tag || null;
    const { data, error } = await supabase.from("announcements").update(patch).eq("id", announcement_id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }
  if (body.action === "delete") {
    await supabase.from("announcements").update({ is_active: false }).eq("id", body.announcement_id);
    return Response.json({ success: true });
  }
  return Response.json({ error: "Unknown" }, { status: 400 });
}
