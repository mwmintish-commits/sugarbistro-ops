import { supabase } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const store_id = searchParams.get("store_id");
  const date = searchParams.get("date");
  const month = searchParams.get("month");

  // 盤點品項清單
  if (type === "items") {
    let q = supabase.from("stock_items").select("*").eq("is_active", true).order("category").order("sort_order").order("name");
    if (store_id) q = q.eq("store_id", store_id);
    const { data } = await q;
    return Response.json({ data });
  }

  // 某日盤點紀錄
  if (type === "counts") {
    let q = supabase.from("stock_counts").select("*, stock_count_lines(*)").order("date", { ascending: false });
    if (store_id) q = q.eq("store_id", store_id);
    if (date) q = q.eq("date", date);
    if (month) q = q.gte("date", month + "-01").lte("date", month + "-31");
    const { data } = await q.limit(60);
    return Response.json({ data });
  }

  // 進貨紀錄
  if (type === "deliveries") {
    let q = supabase.from("stock_deliveries").select("*").order("date", { ascending: false });
    if (store_id) q = q.eq("store_id", store_id);
    if (date) q = q.eq("date", date);
    if (month) q = q.gte("date", month + "-01").lte("date", month + "-31");
    const { data } = await q.limit(200);
    return Response.json({ data });
  }

  // 差異報告（某日某店）
  if (type === "variance" && store_id && date) {
    const { data: items } = await supabase.from("stock_items").select("*").eq("store_id", store_id).eq("is_active", true).order("category").order("sort_order");
    const { data: morning } = await supabase.from("stock_counts").select("*, stock_count_lines(*)").eq("store_id", store_id).eq("date", date).eq("period", "morning").maybeSingle();
    const { data: evening } = await supabase.from("stock_counts").select("*, stock_count_lines(*)").eq("store_id", store_id).eq("date", date).eq("period", "evening").maybeSingle();
    const { data: deliveries } = await supabase.from("stock_deliveries").select("*").eq("store_id", store_id).eq("date", date);
    const { data: sales } = await supabase.from("stock_sales").select("*").eq("store_id", store_id).eq("date", date);

    const report = (items || []).map(item => {
      const mLine = (morning?.stock_count_lines || []).find(l => l.item_id === item.id);
      const eLine = (evening?.stock_count_lines || []).find(l => l.item_id === item.id);
      const delivered = (deliveries || []).filter(d => d.item_id === item.id).reduce((s, d) => s + Number(d.quantity || 0), 0);
      const sold = (sales || []).filter(s => s.item_id === item.id).reduce((s, d) => s + Number(d.quantity || 0), 0);
      const morningQty = mLine ? Number(mLine.quantity) : null;
      const eveningQty = eLine ? Number(eLine.quantity) : null;
      // 理論 = 早盤 + 進貨 - POS銷售
      const theoretical = morningQty !== null ? morningQty + delivered - sold : null;
      const variance = theoretical !== null && eveningQty !== null ? eveningQty - theoretical : null;
      const alert = variance !== null && Math.abs(variance) > Number(item.alert_threshold || 2);
      return {
        item_id: item.id, name: item.name, category: item.category, unit: item.unit,
        par_level: item.par_level, morning: morningQty, delivered, sold, evening: eveningQty,
        theoretical, variance, alert, need_restock: eveningQty !== null && eveningQty < Number(item.par_level || 0),
      };
    });

    const hasSales = (sales || []).length > 0;
    return Response.json({ data: report, morning_submitted: !!morning, evening_submitted: !!evening, has_sales: hasSales });
  }

  // 銷售紀錄查詢
  if (type === "sales") {
    let q = supabase.from("stock_sales").select("*").order("created_at", { ascending: false });
    if (store_id) q = q.eq("store_id", store_id);
    if (date) q = q.eq("date", date);
    const { data } = await q.limit(200);
    return Response.json({ data });
  }

  // 備料需求（根據最新盤點 vs par_level）
  if (type === "restock") {
    const { data: items } = await supabase.from("stock_items").select("*, stores(name)").eq("is_active", true).order("store_id").order("category");
    const storeIds = [...new Set((items || []).map(i => i.store_id))];
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });

    const needs = [];
    for (const sid of storeIds) {
      // 找最新一次盤點（今天晚盤 or 昨天晚盤）
      let { data: latest } = await supabase.from("stock_counts").select("*, stock_count_lines(*)").eq("store_id", sid).in("date", [today, yesterday]).eq("period", "evening").order("date", { ascending: false }).limit(1);
      if (!latest?.length) {
        ({ data: latest } = await supabase.from("stock_counts").select("*, stock_count_lines(*)").eq("store_id", sid).order("date", { ascending: false }).limit(1));
      }
      const count = latest?.[0];
      const storeItems = (items || []).filter(i => i.store_id === sid);
      for (const item of storeItems) {
        const line = count?.stock_count_lines?.find(l => l.item_id === item.id);
        const current = line ? Number(line.quantity) : null;
        const par = Number(item.par_level || 0);
        if (current !== null && current < par) {
          needs.push({ store_name: item.stores?.name, item_name: item.name, current, par_level: par, need: par - current, unit: item.unit, category: item.category });
        }
      }
    }
    return Response.json({ data: needs });
  }

  return Response.json({ data: [] });
}

export async function POST(request) {
  const body = await request.json();

  // 新增盤點品項
  if (body.action === "add_item") {
    const { store_id, name, category, unit, par_level, alert_threshold } = body;
    const { data, error } = await supabase.from("stock_items").insert({
      store_id, name, category: category || "食材", unit: unit || "個",
      par_level: par_level || 0, alert_threshold: alert_threshold || 2,
    }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  // 修改品項
  if (body.action === "update_item") {
    const { item_id, ...updates } = body;
    delete updates.action;
    const { data, error } = await supabase.from("stock_items").update(updates).eq("id", item_id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  // 刪除品項
  if (body.action === "delete_item") {
    await supabase.from("stock_items").update({ is_active: false }).eq("id", body.item_id);
    return Response.json({ success: true });
  }

  // 複製品項到另一門市
  if (body.action === "copy_items") {
    const { from_store_id, to_store_id } = body;
    const { data: items } = await supabase.from("stock_items").select("*").eq("store_id", from_store_id).eq("is_active", true);
    let copied = 0;
    for (const item of items || []) {
      await supabase.from("stock_items").insert({ store_id: to_store_id, name: item.name, category: item.category, unit: item.unit, par_level: item.par_level, alert_threshold: item.alert_threshold, sort_order: item.sort_order });
      copied++;
    }
    return Response.json({ success: true, copied });
  }

  // 提交盤點
  if (body.action === "submit_count") {
    const { store_id, date, period, lines, submitted_by, submitted_by_name, notes } = body;
    // upsert header
    const { data: count, error } = await supabase.from("stock_counts").upsert({
      store_id, date, period, submitted_by, submitted_by_name, notes, submitted_at: new Date().toISOString(),
    }, { onConflict: "store_id,date,period" }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });

    // 刪除舊明細再插入新的
    await supabase.from("stock_count_lines").delete().eq("count_id", count.id);
    const lineData = (lines || []).map(l => ({
      count_id: count.id, item_id: l.item_id, item_name: l.item_name, quantity: Number(l.quantity || 0), unit: l.unit,
    }));
    if (lineData.length) await supabase.from("stock_count_lines").insert(lineData);

    // 如果是晚盤，檢查差異並通知
    if (period === "evening") {
      const { data: morningCount } = await supabase.from("stock_counts").select("*, stock_count_lines(*)").eq("store_id", store_id).eq("date", date).eq("period", "morning").maybeSingle();
      const { data: deliveries } = await supabase.from("stock_deliveries").select("*").eq("store_id", store_id).eq("date", date);
      const { data: storeData } = await supabase.from("stores").select("name").eq("id", store_id).single();

      const alerts = [];
      for (const line of lineData) {
        const mLine = morningCount?.stock_count_lines?.find(l => l.item_id === line.item_id);
        if (!mLine) continue;
        const delivered = (deliveries || []).filter(d => d.item_id === line.item_id).reduce((s, d) => s + Number(d.quantity || 0), 0);
        const theoretical = Number(mLine.quantity) + delivered;
        const diff = Number(line.quantity) - theoretical;
        const { data: itemData } = await supabase.from("stock_items").select("alert_threshold").eq("id", line.item_id).maybeSingle();
        const threshold = Number(itemData?.alert_threshold || 2);
        if (Math.abs(diff) > threshold) {
          alerts.push({ name: line.item_name, morning: mLine.quantity, delivered, theoretical, evening: line.quantity, diff });
        }
      }

      if (alerts.length > 0) {
        const { pushText } = await import("@/lib/line");
        const { data: admins } = await supabase.from("employees").select("line_uid").eq("role", "admin").eq("is_active", true);
        const msg = `🚨 庫存差異警示\n🏠 ${storeData?.name || ""} ${date}\n━━━━━━━━━━━━━━\n` + alerts.map(a => `❌ ${a.name}：早${a.morning}+進${a.delivered}=理論${a.theoretical}，實際${a.evening}，差${a.diff > 0 ? "+" : ""}${a.diff}`).join("\n");
        for (const admin of admins || []) {
          if (admin.line_uid) await pushText(admin.line_uid, msg).catch(() => {});
        }
      }
    }

    return Response.json({ success: true, count_id: count.id });
  }

  // 登記進貨
  if (body.action === "add_delivery") {
    const { store_id, items, received_by, received_by_name } = body;
    const date = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
    const inserts = (items || []).map(i => ({
      store_id, date, item_id: i.item_id, item_name: i.item_name,
      quantity: Number(i.quantity || 0), unit: i.unit, supplier: i.supplier || "",
      received_by, received_by_name,
    }));
    const { error } = await supabase.from("stock_deliveries").insert(inserts);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true, count: inserts.length });
  }

  // 刪除盤點
  if (body.action === "delete_count") {
    await supabase.from("stock_count_lines").delete().eq("count_id", body.count_id);
    await supabase.from("stock_counts").delete().eq("id", body.count_id);
    return Response.json({ success: true });
  }

  // 匯入 POS 銷售（AI 辨識結果）
  if (body.action === "import_sales") {
    const { store_id, date, items, source, submitted_by } = body;
    const dt = date || new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
    // 先刪除同日同源的舊資料（避免重複匯入）
    await supabase.from("stock_sales").delete().eq("store_id", store_id).eq("date", dt).eq("source", source || "manual");

    // 匹配品名 → stock_items
    const { data: stockItems } = await supabase.from("stock_items").select("id, name").eq("store_id", store_id).eq("is_active", true);
    const matched = [];
    const unmatched = [];
    for (const item of items || []) {
      const match = (stockItems || []).find(si =>
        si.name === item.name ||
        si.name.includes(item.name) ||
        item.name.includes(si.name) ||
        si.name.replace(/\s/g, "") === item.name.replace(/\s/g, "")
      );
      if (match) {
        matched.push({ store_id, date: dt, item_id: match.id, item_name: match.name, quantity: Number(item.qty || 0), amount: Number(item.amount || 0), source: source || "manual", submitted_by });
      } else {
        unmatched.push(item.name);
      }
    }
    if (matched.length) await supabase.from("stock_sales").insert(matched);
    return Response.json({ success: true, matched: matched.length, unmatched, total: (items || []).length });
  }

  // AI 辨識 POS 銷售截圖
  if (body.action === "analyze_sales_photo") {
    const { analyzePosSales } = await import("@/lib/anthropic");
    const r = await analyzePosSales(body.base64);
    if (!r) return Response.json({ error: "辨識失敗" }, { status: 500 });
    return Response.json({ data: r });
  }

  // 解析 CSV 內容
  if (body.action === "parse_sales_csv") {
    const { parsePosCsv } = await import("@/lib/anthropic");
    const r = await parsePosCsv(body.csv_content);
    if (!r) return Response.json({ error: "解析失敗" }, { status: 500 });
    return Response.json({ data: r });
  }

  // 手動新增單筆銷售
  if (body.action === "add_sale") {
    const { store_id, date, item_id, item_name, quantity, submitted_by } = body;
    const { data, error } = await supabase.from("stock_sales").insert({
      store_id, date, item_id, item_name, quantity: Number(quantity || 0), source: "manual", submitted_by
    }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  // 刪除銷售紀錄
  if (body.action === "delete_sales") {
    await supabase.from("stock_sales").delete().eq("store_id", body.store_id).eq("date", body.date);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
