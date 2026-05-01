import { supabase } from "@/lib/supabase";

// GET /api/employee/announcements?eid=xxx
// 回傳員工可見的有效公告（依門市篩選），附帶是否已讀
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const eid = searchParams.get("eid");
  if (!eid) return Response.json({ error: "缺少 eid" }, { status: 400 });

  // 取員工的 store_id
  const { data: emp } = await supabase.from("employees").select("store_id").eq("id", eid).single();
  const storeId = emp?.store_id || null;

  // 取有效公告（全體 or 該門市）
  const today = new Date().toLocaleDateString("sv-SE");
  let q = supabase.from("announcements").select("*")
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${today}`)
    .or(`expires_at.is.null,expires_at.gte.${today}`)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (storeId) {
    q = q.or(`store_id.is.null,store_id.eq.${storeId}`);
  }

  const { data: anns, error } = await q;
  if (error) return Response.json({ error: error.message, data: [] });
  if (!anns || anns.length === 0) return Response.json({ data: [] });

  // 取此員工的已讀紀錄
  const annIds = anns.map(a => a.id);
  const { data: reads } = await supabase.from("announcement_reads")
    .select("announcement_id")
    .eq("employee_id", eid)
    .in("announcement_id", annIds);

  const readSet = new Set((reads || []).map(r => r.announcement_id));
  const result = anns.map(a => ({ ...a, is_read: readSet.has(a.id) }));

  return Response.json({ data: result });
}

// POST /api/employee/announcements
// action: "read" → 標記已讀
export async function POST(request) {
  const body = await request.json();
  if (body.action === "read") {
    const { announcement_id, employee_id } = body;
    if (!announcement_id || !employee_id) return Response.json({ error: "缺少參數" }, { status: 400 });
    // UPSERT 避免重複
    const { error } = await supabase.from("announcement_reads")
      .upsert({ announcement_id, employee_id }, { onConflict: "announcement_id,employee_id" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
