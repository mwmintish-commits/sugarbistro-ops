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

  // 協作日誌：取得某門市某日的所有項目狀態
  if (type === "collab") {
    let { data: items } = await supabase.from("work_log_items").select("*").eq("store_id", store_id).eq("date", date).order("created_at");
    
    // 如果當日還沒初始化，從模板建立
    if (!items || items.length === 0) {
      const { data: templates } = await supabase.from("work_log_templates").select("*").eq("store_id", store_id).eq("is_active", true).order("sort_order");
      if (templates && templates.length > 0) {
        const newItems = templates.map(t => ({
          store_id, date, template_id: t.id, item_name: t.item, category: t.category, shift_type: t.shift_type || "opening",
        }));
        const { data: created } = await supabase.from("work_log_items").insert(newItems).select();
        items = created || [];
      }
    }

    const total = (items || []).length;
    const done = (items || []).filter(i => i.completed).length;
    return Response.json({ data: items, summary: { total, done, percent: total > 0 ? Math.round(done / total * 100) : 0 } });
  }

  if (type === "log") {
    const { data } = await supabase.from("work_logs").select("*").eq("employee_id", employee_id).eq("date", date).single();
    return Response.json({ data });
  }

  // 後台：每日完成度總覽
  let q = supabase.from("work_log_items").select("store_id, date, completed, completed_by_name").order("date", { ascending: false });
  if (store_id) q = q.eq("store_id", store_id);
  if (searchParams.get("month")) {
    const m = searchParams.get("month");
    q = q.gte("date", m + "-01").lte("date", m + "-31");
  }
  const { data: allItems } = await q.limit(2000);

  // 彙總每日完成度
  const byDay = {};
  for (const item of allItems || []) {
    const k = item.date + "|" + item.store_id;
    if (!byDay[k]) byDay[k] = { date: item.date, store_id: item.store_id, total: 0, done: 0, people: new Set() };
    byDay[k].total++;
    if (item.completed) { byDay[k].done++; if (item.completed_by_name) byDay[k].people.add(item.completed_by_name); }
  }
  const summary = Object.values(byDay).map(d => ({ ...d, people: [...d.people], percent: d.total > 0 ? Math.round(d.done / d.total * 100) : 0 })).sort((a, b) => b.date.localeCompare(a.date));
  return Response.json({ data: summary });
}

export async function POST(request) {
  const body = await request.json();

  // 協作：勾選/取消勾選單一項目
  if (body.action === "toggle_item") {
    const { item_id, employee_id, employee_name, completed } = body;
    const updates = { completed };
    if (completed) { updates.completed_by = employee_id; updates.completed_by_name = employee_name; updates.completed_at = new Date().toISOString(); }
    else { updates.completed_by = null; updates.completed_by_name = null; updates.completed_at = null; }
    const { data, error } = await supabase.from("work_log_items").update(updates).eq("id", item_id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  // 協作：新增備註
  if (body.action === "add_note") {
    const { item_id, notes } = body;
    const { data } = await supabase.from("work_log_items").update({ notes }).eq("id", item_id).select().single();
    return Response.json({ data });
  }

  if (body.action === "submit") {
    const { employee_id, store_id, date, items, notes } = body;
    const { data, error } = await supabase.from("work_logs").upsert({
      employee_id, store_id, date, items, notes, submitted_at: new Date().toISOString(),
    }, { onConflict: "employee_id,date" }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (body.action === "add_template") {
    const { store_id, category, item, sort_order, role, shift_type } = body;
    const { data } = await supabase.from("work_log_templates").insert({ store_id, category, item, sort_order: sort_order || 0, role: role || "all", shift_type: shift_type || "opening" }).select().single();
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
