import { supabase, eom } from "@/lib/supabase";

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
    const freq = searchParams.get("frequency") || "daily";
    const selectCols = "*, work_log_templates(requires_value, value_label, value_min, value_max)";
    let { data: items } = await supabase.from("work_log_items").select(selectCols).eq("store_id", store_id).eq("date", date).eq("frequency", freq).order("created_at");

    // 如果當日還沒初始化，從模板建立
    if (!items || items.length === 0) {
      let tq = supabase.from("work_log_templates").select("*").eq("store_id", store_id).eq("is_active", true).order("sort_order");

      if (freq === "daily") {
        tq = tq.eq("frequency", "daily");
      } else if (freq === "weekly") {
        const dow = new Date(date).getDay();
        tq = tq.eq("frequency", "weekly").or(`weekday.eq.${dow},weekday.is.null`);
      } else if (freq === "monthly") {
        const dom = new Date(date).getDate();
        tq = tq.eq("frequency", "monthly").or(`month_day.eq.${dom},month_day.is.null`);
      }

      const { data: templates } = await tq;
      if (templates && templates.length > 0) {
        const cleanItems = templates.map(t => ({
          store_id, date, template_id: t.id, item_name: t.item, category: t.category,
          shift_type: t.shift_type || "opening", frequency: freq,
        }));
        const { data: created } = await supabase.from("work_log_items").insert(cleanItems).select(selectCols);
        items = created || [];
      }
    }

    // 展平 template 的 meta 欄位（requires_value 等），讓前端能正確渲染輸入框
    const flat = (items || []).map(i => {
      const t = i.work_log_templates || {};
      return {
        ...i,
        requires_value: t.requires_value || false,
        value_label: t.value_label || null,
        value_min: t.value_min ?? null,
        value_max: t.value_max ?? null,
        work_log_templates: undefined,
      };
    });

    const total = flat.length;
    const done = flat.filter(i => i.completed).length;
    const abnormal = flat.filter(i => i.is_abnormal).length;
    return Response.json({ data: flat, summary: { total, done, abnormal, percent: total > 0 ? Math.round(done / total * 100) : 0 } });
  }

  if (type === "log") {
    const { data } = await supabase.from("work_logs").select("*").eq("employee_id", employee_id).eq("date", date).single();
    return Response.json({ data });
  }

  // 清潔狀態：週/月清潔項目 + 本週/本月是否完成
  if (type === "cleaning_status") {
    const { data: templates } = await supabase.from("work_log_templates").select("*").eq("store_id", store_id).eq("is_active", true).in("frequency", ["weekly", "monthly"]).order("sort_order");
    
    // 本週範圍
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    const weekStart = new Date(d.getTime() - dayOfWeek * 86400000).toLocaleDateString("sv-SE");
    const weekEnd = new Date(d.getTime() + (6 - dayOfWeek) * 86400000).toLocaleDateString("sv-SE");
    // 本月範圍
    const monthStart = date.slice(0, 7) + "-01";
    const monthEnd = eom(date.slice(0, 7));

    const result = [];
    for (const t of templates || []) {
      const range = t.frequency === "weekly" ? [weekStart, weekEnd] : [monthStart, monthEnd];
      const { data: done } = await supabase.from("work_log_items").select("id, completed_by_name, completed_at").eq("store_id", store_id).eq("template_id", t.id).eq("completed", true).gte("date", range[0]).lte("date", range[1]).limit(1);
      result.push({
        id: t.id + "_" + t.frequency,
        template_id: t.id,
        item_name: t.item,
        category: t.category,
        frequency: t.frequency,
        completed_this_period: done && done.length > 0,
        last_done_by: done?.[0]?.completed_by_name || null,
        last_done_at: done?.[0]?.completed_at || null,
      });
    }
    return Response.json({ data: result });
  }

  // 盤點回報查詢
  if (type === "inventory") {
    let q = supabase.from("work_log_items")
      .select("date, store_id, item_name, category, value, completed_by_name, stores(name)")
      .in("category", ["庫存盤點", "冷藏盤點", "冷凍盤點", "盤點"])
      .not("value", "is", null)
      .order("date", { ascending: false });
    if (date) q = q.eq("date", date);
    if (store_id) q = q.eq("store_id", store_id);
    const { data } = await q.limit(200);
    const formatted = (data || []).map(d => ({
      date: d.date, store_name: d.stores ? d.stores.name : "", category: d.category,
      item: d.item_name, value: d.value, employee_name: d.completed_by_name || "",
    }));
    return Response.json({ data: formatted });
  }

  // 後台：每日完成度總覽
  let q = supabase.from("work_log_items").select("store_id, date, completed, completed_by_name").order("date", { ascending: false });
  if (store_id) q = q.eq("store_id", store_id);
  if (searchParams.get("month")) {
    const m = searchParams.get("month");
    q = q.gte("date", m + "-01").lte("date", eom(m));
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
    const { item_id, employee_id, employee_name, completed, value } = body;
    const updates = { completed };
    if (completed) { updates.completed_by = employee_id; updates.completed_by_name = employee_name; updates.completed_at = new Date().toISOString(); }
    else { updates.completed_by = null; updates.completed_by_name = null; updates.completed_at = null; }
    if (value !== undefined) {
      updates.value = value;
      // 取得模板的min/max判斷異常
      const { data: item } = await supabase.from("work_log_items").select("template_id").eq("id", item_id).single();
      if (item?.template_id) {
        const { data: tpl } = await supabase.from("work_log_templates").select("value_min, value_max").eq("id", item.template_id).single();
        if (tpl && (tpl.value_min !== null || tpl.value_max !== null)) {
          updates.is_abnormal = (tpl.value_min !== null && value < tpl.value_min) || (tpl.value_max !== null && value > tpl.value_max);
        }
      }
    }
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
    const { store_id, category, item, sort_order, role, shift_type, frequency, weekday, month_day, requires_value, value_label, value_min, value_max } = body;
    const { data } = await supabase.from("work_log_templates").insert({ store_id, category, item, sort_order: sort_order || 0, role: role || "all", shift_type: shift_type || "opening", frequency: frequency || "daily", weekday, month_day, requires_value: requires_value || false, value_label, value_min, value_max }).select().single();
    return Response.json({ data });
  }

  if (body.action === "report_incident") {
    const { store_id, employee_id, employee_name, type, description, image_url } = body;
    const { data, error } = await supabase.from("incident_reports").insert({ store_id, employee_id, employee_name, type, description, image_url }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    // 通知主管和總部
    const { data: mgrs } = await supabase.from("employees").select("line_uid").in("role", ["admin", "manager"]).eq("is_active", true);
    const { pushText } = await import("@/lib/line");
    if (mgrs) for (const m of mgrs) if (m.line_uid) await pushText(m.line_uid, "⚠️ 異常回報\n" + employee_name + "\n類型：" + type + "\n" + (description || "")).catch(() => {});
    return Response.json({ data });
  }

  if (body.action === "resolve_incident") {
    const { incident_id, resolution, resolved_by } = body;
    const { data } = await supabase.from("incident_reports").update({ status: "resolved", resolution, resolved_by, resolved_at: new Date().toISOString() }).eq("id", incident_id).select().single();
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

  // 清潔項目完成/取消
  if (body.action === "toggle_cleaning") {
    const { item_id, store_id, employee_id, employee_name, completed, frequency, date } = body;
    if (completed) {
      // 新增一筆完成記錄
      await supabase.from("work_log_items").insert({
        store_id, date, template_id: item_id, item_name: body.item_name || "",
        category: "清潔", shift_type: "during", frequency,
        completed: true, completed_by: employee_id, completed_by_name: employee_name,
        completed_at: new Date().toISOString(),
      });
    } else {
      // 取消：刪除本週/月的完成記錄
      const d = new Date(date);
      const dayOfWeek = d.getDay();
      const range = frequency === "weekly"
        ? [new Date(d.getTime() - dayOfWeek * 86400000).toLocaleDateString("sv-SE"), new Date(d.getTime() + (6 - dayOfWeek) * 86400000).toLocaleDateString("sv-SE")]
        : [date.slice(0, 7) + "-01", date.slice(0, 7) + "-31"];
      await supabase.from("work_log_items").delete().eq("store_id", store_id).eq("template_id", item_id).eq("completed", true).gte("date", range[0]).lte("date", range[1]);
    }
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
