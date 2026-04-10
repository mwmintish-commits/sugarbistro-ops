import { supabase } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const store_id = searchParams.get("store_id");
  const employee_id = searchParams.get("employee_id");
  const date = searchParams.get("date");

  if (type === "templates") {
    let q = supabase.from("work_log_templates").select("*").eq("is_active", true).order("sort_order");
    if (store_id) q = q.eq("store_id", store_id);
    const { data } = await q;
    return Response.json({ data });
  }

  if (type === "log") {
    const { data } = await supabase.from("work_logs").select("*").eq("employee_id", employee_id).eq("date", date).single();
    return Response.json({ data });
  }

  // 列表
  let q = supabase.from("work_logs").select("*, employees(name), stores(name)").order("date", { ascending: false });
  if (store_id) q = q.eq("store_id", store_id);
  if (searchParams.get("month")) {
    const m = searchParams.get("month");
    q = q.gte("date", `${m}-01`).lte("date", `${m}-31`);
  }
  const { data } = await q.limit(100);
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "submit") {
    const { employee_id, store_id, date, items, notes } = body;
    const { data, error } = await supabase.from("work_logs").upsert({
      employee_id, store_id, date, items, notes, submitted_at: new Date().toISOString(),
    }, { onConflict: "employee_id,date" }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  // 管理模板
  if (body.action === "add_template") {
    const { store_id, category, item, sort_order } = body;
    const { data } = await supabase.from("work_log_templates").insert({ store_id, category, item, sort_order: sort_order || 0 }).select().single();
    return Response.json({ data });
  }

  if (body.action === "delete_template") {
    await supabase.from("work_log_templates").update({ is_active: false }).eq("id", body.template_id);
    return Response.json({ success: true });
  }

  if (body.action === "copy_to_store") {
    const { from_store_id, to_store_id } = body;
    const { data: templates } = await supabase.from("work_log_templates").select("*").eq("store_id", from_store_id).eq("is_active", true);
    if (!templates || templates.length === 0) return Response.json({ error: "來源門市無模板" }, { status: 400 });
    const copies = templates.map(t => ({ store_id: to_store_id, category: t.category, item: t.item, sort_order: t.sort_order, role: t.role, shift_type: t.shift_type }));
    const { data, error } = await supabase.from("work_log_templates").insert(copies).select();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data, count: copies.length });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
