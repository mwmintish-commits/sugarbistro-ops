import { supabase } from "@/lib/supabase";

// 統一資料源：盤點/進貨/叫貨/報廢都用 inventory_items + inventory_stock(per-store)
// stock_items 已棄用；本檔僅保留盤點/銷售/差異邏輯，品項一律從 inventory_items 取

async function getItems(store_id) {
  const { data: rawItems } = await supabase.from("inventory_items").select("*").eq("is_active", true).order("category").order("name");
  // 同名去重
  const byName = new Map();
  for (const it of rawItems || []) {
    if (!byName.has(it.name)) byName.set(it.name, it);
    else if (byName.get(it.name).store_id && !it.store_id) byName.set(it.name, it);
  }
  const items = Array.from(byName.values());

  let stocks = null;
  try {
    let q = supabase.from("inventory_stock").select("*");
    if (store_id) q = q.eq("store_id", store_id);
    const r = await q;
    if (!r.error) stocks = r.data;
  } catch (e) { stocks = null; }

  if (!stocks) {
    return items.map(i => ({ ...i, current_stock: i.current_stock || 0, alert_threshold: i.alert_threshold || 2 }));
  }
  // 同名 alias
  const aliasGroups = new Map();
  for (const it of rawItems || []) {
    if (!aliasGroups.has(it.name)) aliasGroups.set(it.name, []);
    aliasGroups.get(it.name).push(it.id);
  }
  const stockMap = new Map();
  for (const s of stocks) stockMap.set(s.item_id + ":" + s.store_id, s);

  return items.map(i => {
    const allIds = aliasGroups.get(i.name) || [i.id];
    if (store_id) {
      let total = 0; let par = i.par_level; let safe = i.safe_stock;
      for (const id of allIds) {
        const s = stockMap.get(id + ":" + store_id);
        if (s) { total += Number(s.current_stock || 0); if (s.par_level != null) par = s.par_level; if (s.safe_stock != null) safe = s.safe_stock; }
      }
      return { ...i, current_stock: total, par_level: par, safe_stock: safe, alert_threshold: i.alert_threshold || 2 };
    }
    const total = stocks.filter(s => allIds.includes(s.item_id)).reduce((a, s) => a + Number(s.current_stock || 0), 0);
    return { ...i, current_stock: total, alert_threshold: i.alert_threshold || 2 };
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const store_id = searchParams.get("store_id");
  const date = searchParams.get("date");
  const month = searchParams.get("month");

  // 盤點品項清單（從 inventory_items + inventory_stock）
  if (type === "items") {
    const data = await getItems(store_id);
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
    let q = supabase.from("inventory_movements").select("*, inventory_items(name, unit, category)").in("type", ["in", "purchase", "transfer_in"]).order("created_at", { ascending: false });
    if (store_id) q = q.or(`store_id.eq.${store_id},to_store_id.eq.${store_id}`);
    if (date) q = q.gte("created_at", date + "T00:00:00").lte("created_at", date + "T23:59:59");
    if (month) q = q.gte("created_at", month + "-01").lte("created_at", month + "-31T23:59:59");
    const { data } = await q.limit(200);
    return Response.json({ data });
  }

  // 差異報告（某日某店）
  if (type === "variance" && store_id && date) {
    const items = await getItems(store_id);
    const { data: morning } = await supabase.from("stock_counts").select("*, stock_count_lines(*)").eq("store_id", store_id).eq("date", date).eq("period", "morning").maybeSingle();
    const { data: evening } = await supabase.from("stock_counts").select("*, stock_count_lines(*)").eq("store_id", store_id).eq("date", date).eq("period", "evening").maybeSingle();
    const { data: deliveries } = await supabase.from("inventory_movements").select("*").or(`store_id.eq.${store_id},to_store_id.eq.${store_id}`).in("type", ["in", "purchase", "transfer_in"]).gte("created_at", date + "T00:00:00").lte("created_at", date + "T23:59:59");
    const { data: sales } = await supabase.from("stock_sales").select("*").eq("store_id", store_id).eq("date", date);

    const report = (items || []).map(item => {
      const mLine = (morning?.stock_count_lines || []).find(l => l.item_id === item.id);
      const eLine = (evening?.stock_count_lines || []).find(l => l.item_id === item.id);
      const delivered = (deliveries || []).filter(d => d.item_id === item.id).reduce((s, d) => s + Number(d.quantity || 0), 0);
      const sold = (sales || []).filter(s => s.item_id === item.id).reduce((s, d) => s + Number(d.quantity || 0), 0);
      const morningQty = mLine ? Number(mLine.quantity) : null;
      const eveningQty = eLine ? Number(eLine.quantity) : null;
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
    const { data: stores } = await supabase.from("stores").select("*").eq("is_active", true);
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });

    const needs = [];
    for (const st of stores || []) {
      const items = await getItems(st.id);
      let { data: latest } = await supabase.from("stock_counts").select("*, stock_count_lines(*)").eq("store_id", st.id).in("date", [today, yesterday]).eq("period", "evening").order("date", { ascending: false }).limit(1);
      if (!latest?.length) {
        ({ data: latest } = await supabase.from("stock_counts").select("*, stock_count_lines(*)").eq("store_id", st.id).order("date", { ascending: false }).limit(1));
      }
      const count = latest?.[0];
      for (const item of items) {
        const line = count?.stock_count_lines?.find(l => l.item_id === item.id);
        const current = line ? Number(line.quantity) : null;
        const par = Number(item.par_level || 0);
        if (current !== null && par > 0 && current < par) {
          needs.push({ store_name: st.name, item_name: item.name, current, par_level: par, need: par - current, unit: item.unit, category: item.category });
        }
      }
    }
    return Response.json({ data: needs });
  }

  return Response.json({ data: [] });
}

export async function POST(request) {
  const body = await request.json();

  // 新增品項（全域，寫 inventory_items）
  if (body.action === "add_item") {
    const { name, category, unit, par_level, alert_threshold, safe_stock } = body;
    const { data, error } = await supabase.from("inventory_items").insert({
      name, category: category || "食材", unit: unit || "個",
      par_level: par_level || 0, alert_threshold: alert_threshold || 2,
      safe_stock: safe_stock || 0, type: "raw_material", is_active: true,
    }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    try {
      const { data: stores } = await supabase.from("stores").select("id").eq("is_active", true);
      if (stores?.length) {
        await supabase.from("inventory_stock").insert(stores.map(s => ({ item_id: data.id, store_id: s.id, current_stock: 0 })));
      }
    } catch (e) {}
    return Response.json({ data });
  }

  // 修改品項（更新 inventory_items）
  if (body.action === "update_item") {
    const { item_id, ...updates } = body;
    delete updates.action;
    delete updates.current_stock; // 不從這裡改庫存
    const { data, error } = await supabase.from("inventory_items").update(updates).eq("id", item_id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  // 設定該店覆寫（par_level / safe_stock）
  if (body.action === "set_store_override") {
    const { item_id, store_id, par_level, safe_stock, current_stock } = body;
    const upd = { updated_at: new Date().toISOString() };
    if (par_level !== undefined) upd.par_level = par_level;
    if (safe_stock !== undefined) upd.safe_stock = safe_stock;
    if (current_stock !== undefined) upd.current_stock = current_stock;
    try {
      const { error } = await supabase.from("inventory_stock").upsert({ item_id, store_id, ...upd }, { onConflict: "item_id,store_id" });
      if (error) return Response.json({ error: error.message }, { status: 500 });
    } catch (e) {
      return Response.json({ error: "inventory_stock 表尚未建立，請先執行 migrations/inventory-unify.sql" }, { status: 500 });
    }
    return Response.json({ success: true });
  }

  // 停用品項
  if (body.action === "delete_item") {
    await supabase.from("inventory_items").update({ is_active: false }).eq("id", body.item_id);
    return Response.json({ success: true });
  }

  // 提交盤點（line.item_id 指 inventory_items.id）
  if (body.action === "submit_count") {
    const { store_id, date, period, lines, submitted_by, submitted_by_name, notes } = body;
    const { data: count, error } = await supabase.from("stock_counts").upsert({
      store_id, date, period, submitted_by, submitted_by_name, notes, submitted_at: new Date().toISOString(),
    }, { onConflict: "store_id,date,period" }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });

    await supabase.from("stock_count_lines").delete().eq("count_id", count.id);
    const lineData = (lines || []).map(l => ({
      count_id: count.id, item_id: l.item_id, item_name: l.item_name, quantity: Number(l.quantity || 0), unit: l.unit,
    }));
    if (lineData.length) await supabase.from("stock_count_lines").insert(lineData);

    // 晚盤後同步 inventory_stock.current_stock = 盤點實際數
    if (period === "evening" && lineData.length) {
      for (const l of lineData) {
        try {
          await supabase.from("inventory_stock").upsert({
            item_id: l.item_id, store_id, current_stock: Number(l.quantity || 0), updated_at: new Date().toISOString(),
          }, { onConflict: "item_id,store_id" });
        } catch (e) {
          // Fallback：表不存在時直接更新 inventory_items
          await supabase.from("inventory_items").update({ current_stock: Number(l.quantity || 0) }).eq("id", l.item_id);
        }
      }

      // 差異警示
      const { data: morningCount } = await supabase.from("stock_counts").select("*, stock_count_lines(*)").eq("store_id", store_id).eq("date", date).eq("period", "morning").maybeSingle();
      const { data: deliveries } = await supabase.from("inventory_movements").select("*").or(`store_id.eq.${store_id},to_store_id.eq.${store_id}`).in("type", ["in", "purchase", "transfer_in"]).gte("created_at", date + "T00:00:00").lte("created_at", date + "T23:59:59");
      const { data: storeData } = await supabase.from("stores").select("name").eq("id", store_id).single();

      const alerts = [];
      for (const line of lineData) {
        const mLine = morningCount?.stock_count_lines?.find(l => l.item_id === line.item_id);
        if (!mLine) continue;
        const delivered = (deliveries || []).filter(d => d.item_id === line.item_id).reduce((s, d) => s + Number(d.quantity || 0), 0);
        const theoretical = Number(mLine.quantity) + delivered;
        const diff = Number(line.quantity) - theoretical;
        const { data: itemData } = await supabase.from("inventory_items").select("alert_threshold").eq("id", line.item_id).maybeSingle();
        const threshold = Number(itemData?.alert_threshold || 2);
        if (Math.abs(diff) > threshold) {
          alerts.push({ name: line.item_name, morning: mLine.quantity, delivered, theoretical, evening: line.quantity, diff });
        }
      }

      const { getStoreManagers } = await import("@/lib/notify");
      const { pushText } = await import("@/lib/line");
      const recipients = await getStoreManagers(supabase, store_id);

      const summaryMsg = `📦 晚盤完成\n🏠 ${storeData?.name || ""} ${date}\n👤 ${submitted_by_name || "?"}\n━━━━━━━━━━━━━━\n` +
        lineData.slice(0, 20).map(l => `• ${l.item_name}：${l.quantity}${l.unit || ""}`).join("\n") +
        (lineData.length > 20 ? `\n… 共 ${lineData.length} 項` : "") +
        (alerts.length > 0
          ? `\n━━━━━━━━━━━━━━\n🚨 差異警示 ${alerts.length} 項：\n` + alerts.map(a => `❌ ${a.name}：理論${a.theoretical}/實際${a.evening}（差${a.diff > 0 ? "+" : ""}${a.diff}）`).join("\n")
          : "\n✅ 無異常差異");
      for (const r of recipients) {
        try { await pushText(r.line_uid, summaryMsg); } catch (e) {}
      }
    }

    return Response.json({ success: true, count_id: count.id });
  }

  // 刪除盤點
  if (body.action === "delete_count") {
    await supabase.from("stock_count_lines").delete().eq("count_id", body.count_id);
    await supabase.from("stock_counts").delete().eq("id", body.count_id);
    return Response.json({ success: true });
  }

  // 匯入 POS 銷售
  if (body.action === "import_sales") {
    const { store_id, date, items, source, submitted_by } = body;
    const dt = date || new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
    await supabase.from("stock_sales").delete().eq("store_id", store_id).eq("date", dt).eq("source", source || "manual");

    const { data: invItems } = await supabase.from("inventory_items").select("id, name").eq("is_active", true);
    const matched = [];
    const unmatched = [];
    for (const item of items || []) {
      const match = (invItems || []).find(si =>
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

  if (body.action === "analyze_sales_photo") {
    const { analyzePosSales } = await import("@/lib/anthropic");
    const r = await analyzePosSales(body.base64);
    if (!r) return Response.json({ error: "辨識失敗" }, { status: 500 });
    return Response.json({ data: r });
  }

  if (body.action === "parse_sales_csv") {
    const { parsePosCsv } = await import("@/lib/anthropic");
    const r = await parsePosCsv(body.csv_content);
    if (!r) return Response.json({ error: "解析失敗" }, { status: 500 });
    return Response.json({ data: r });
  }

  if (body.action === "add_sale") {
    const { store_id, date, item_id, item_name, quantity, submitted_by } = body;
    const { data, error } = await supabase.from("stock_sales").insert({
      store_id, date, item_id, item_name, quantity: Number(quantity || 0), source: "manual", submitted_by
    }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (body.action === "delete_sales") {
    await supabase.from("stock_sales").delete().eq("store_id", body.store_id).eq("date", body.date);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
