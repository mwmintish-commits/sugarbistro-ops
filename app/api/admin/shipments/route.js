import { supabase } from "@/lib/supabase";
import { getStoreManagers } from "@/lib/notify";
import { pushText } from "@/lib/line";

// 出貨單 API
// 流程：總部建單(draft) → 出貨(shipped) → 員工逐項收貨(received/variance) → 全部收完(received)

function genShipmentNumber() {
  const d = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }).replace(/-/g, "");
  const r = Math.floor(Math.random() * 900 + 100);
  return `SHP-${d}-${r}`;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const store_id = searchParams.get("store_id");
  const status = searchParams.get("status");

  // 取得單一出貨單詳情
  if (type === "detail") {
    const { data: ship } = await supabase.from("shipments")
      .select("*, stores(name)")
      .eq("id", searchParams.get("id")).single();
    if (!ship) return Response.json({ error: "找不到" }, { status: 404 });
    const { data: lines } = await supabase.from("shipment_lines")
      .select("*, inventory_items(name, unit, zone, category, is_key_item)")
      .eq("shipment_id", ship.id);
    return Response.json({ data: { ...ship, lines: lines || [] } });
  }

  // 待辦看板：依門市彙總 pending 叫貨單（總部用來建出貨單）
  if (type === "pending_orders_by_store") {
    const { data: orders } = await supabase.from("purchase_orders")
      .select("*, inventory_items(name, unit, zone, category, is_key_item, current_stock, safe_stock), stores(name)")
      .eq("status", "pending")
      .order("requested_at", { ascending: true });
    const byStore = {};
    for (const o of orders || []) {
      const k = o.store_id || "unknown";
      if (!byStore[k]) byStore[k] = { store_id: k, store_name: o.stores?.name || "(未指定)", orders: [] };
      byStore[k].orders.push(o);
    }
    return Response.json({ data: Object.values(byStore) });
  }

  // 列出出貨單（後台/門市共用）
  let q = supabase.from("shipments")
    .select("*, stores(name)")
    .order("created_at", { ascending: false });
  if (store_id) q = q.eq("store_id", store_id);
  if (status) {
    if (status.includes(",")) q = q.in("status", status.split(","));
    else q = q.eq("status", status);
  }
  const { data: ships } = await q.limit(200);
  // 附帶 line 數量摘要（不撈完整內容）
  const ids = (ships || []).map(s => s.id);
  let lineMap = {};
  if (ids.length > 0) {
    const { data: lines } = await supabase.from("shipment_lines")
      .select("shipment_id, status, shipped_qty, received_qty")
      .in("shipment_id", ids);
    for (const l of lines || []) {
      if (!lineMap[l.shipment_id]) lineMap[l.shipment_id] = { total: 0, received: 0 };
      lineMap[l.shipment_id].total++;
      if (l.status === "received" || l.status === "variance") lineMap[l.shipment_id].received++;
    }
  }
  const enriched = (ships || []).map(s => ({ ...s, line_summary: lineMap[s.id] || { total: 0, received: 0 } }));
  return Response.json({ data: enriched });
}

export async function POST(request) {
  const body = await request.json();

  // 建立出貨單（draft）
  if (body.action === "create") {
    const { store_id, lines, notes, created_by, created_by_name, auto_ship } = body;
    if (!store_id || !Array.isArray(lines) || lines.length === 0) {
      return Response.json({ error: "缺少門市或品項" }, { status: 400 });
    }
    const number = genShipmentNumber();
    const { data: ship, error } = await supabase.from("shipments").insert({
      shipment_number: number, store_id, notes,
      created_by, created_by_name,
      status: auto_ship ? "shipped" : "draft",
      shipped_by: auto_ship ? created_by : null,
      shipped_by_name: auto_ship ? created_by_name : null,
      shipped_at: auto_ship ? new Date().toISOString() : null,
    }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });

    // 寫入 lines（自動帶 unit/cost）
    const itemIds = lines.map(l => l.item_id);
    const { data: items } = await supabase.from("inventory_items").select("id, unit, cost_per_unit").in("id", itemIds);
    const itemMap = Object.fromEntries((items || []).map(i => [i.id, i]));
    const lineInserts = lines
      .filter(l => l.item_id && Number(l.shipped_qty) > 0)
      .map(l => ({
        shipment_id: ship.id, item_id: l.item_id, order_id: l.order_id || null,
        shipped_qty: Number(l.shipped_qty),
        unit: itemMap[l.item_id]?.unit, unit_cost: itemMap[l.item_id]?.cost_per_unit,
        status: "pending",
      }));
    if (lineInserts.length === 0) {
      await supabase.from("shipments").delete().eq("id", ship.id);
      return Response.json({ error: "無有效品項" }, { status: 400 });
    }
    await supabase.from("shipment_lines").insert(lineInserts);

    // 若自動出貨則推 LINE 給門市店長
    if (auto_ship) {
      try {
        const { data: storeData } = await supabase.from("stores").select("name").eq("id", store_id).single();
        const recipients = await getStoreManagers(supabase, store_id);
        const summary = lineInserts.slice(0, 10).map(l => `• ${itemMap[l.item_id]?.unit ? "" : ""}× ${l.shipped_qty}${l.unit || ""}`).join("\n");
        const msg = `📦 總部已出貨\n🏠 ${storeData?.name || ""}\n📋 出貨單：${number}\n共 ${lineInserts.length} 項\n\n收到貨後請至「進貨」頁面逐項核對實收數量。`;
        for (const r of recipients) await pushText(r.line_uid, msg).catch(() => {});
      } catch {}
    }

    return Response.json({ data: { ...ship, line_count: lineInserts.length } });
  }

  // 修改 draft 出貨單（總部 admin 可在出貨前調整）
  if (body.action === "update_draft") {
    const { shipment_id, lines, notes } = body;
    const { data: ship } = await supabase.from("shipments").select("status").eq("id", shipment_id).single();
    if (!ship) return Response.json({ error: "找不到" }, { status: 404 });
    if (ship.status !== "draft") return Response.json({ error: "僅能修改草稿狀態" }, { status: 400 });
    if (notes !== undefined) await supabase.from("shipments").update({ notes }).eq("id", shipment_id);
    if (Array.isArray(lines)) {
      // 整批替換
      await supabase.from("shipment_lines").delete().eq("shipment_id", shipment_id);
      const itemIds = lines.map(l => l.item_id);
      const { data: items } = await supabase.from("inventory_items").select("id, unit, cost_per_unit").in("id", itemIds);
      const itemMap = Object.fromEntries((items || []).map(i => [i.id, i]));
      const lineInserts = lines
        .filter(l => l.item_id && Number(l.shipped_qty) > 0)
        .map(l => ({
          shipment_id, item_id: l.item_id, order_id: l.order_id || null,
          shipped_qty: Number(l.shipped_qty),
          unit: itemMap[l.item_id]?.unit, unit_cost: itemMap[l.item_id]?.cost_per_unit,
          status: "pending",
        }));
      if (lineInserts.length > 0) await supabase.from("shipment_lines").insert(lineInserts);
    }
    return Response.json({ success: true });
  }

  // 確認出貨（draft → shipped），推 LINE
  if (body.action === "ship") {
    const { shipment_id, shipped_by, shipped_by_name } = body;
    const { data: ship } = await supabase.from("shipments")
      .select("*, stores(name)")
      .eq("id", shipment_id).single();
    if (!ship) return Response.json({ error: "找不到" }, { status: 404 });
    if (ship.status !== "draft") return Response.json({ error: "狀態不對" }, { status: 400 });
    await supabase.from("shipments").update({
      status: "shipped", shipped_by, shipped_by_name,
      shipped_at: new Date().toISOString(),
    }).eq("id", shipment_id);

    try {
      const { data: lines } = await supabase.from("shipment_lines")
        .select("shipped_qty, unit, inventory_items(name)")
        .eq("shipment_id", shipment_id);
      const recipients = await getStoreManagers(supabase, ship.store_id);
      const lineSummary = (lines || []).slice(0, 12).map(l => `• ${l.inventory_items?.name || "?"} × ${l.shipped_qty}${l.unit || ""}`).join("\n");
      const more = (lines || []).length > 12 ? `\n… 共 ${lines.length} 項` : "";
      const msg = `📦 總部已出貨\n🏠 ${ship.stores?.name || ""}\n📋 ${ship.shipment_number}\n━━━━━━━━━━━━━━\n${lineSummary}${more}\n\n收到後請至工作日誌「進貨」頁逐項核對實收數量。`;
      for (const r of recipients) await pushText(r.line_uid, msg).catch(() => {});
    } catch {}
    return Response.json({ success: true });
  }

  // 員工收貨（單筆 line）
  if (body.action === "receive_line") {
    const { line_id, received_qty, received_by, received_by_name } = body;
    const { data: line } = await supabase.from("shipment_lines")
      .select("*, shipments(store_id, shipment_number, stores(name)), inventory_items(name, unit)")
      .eq("id", line_id).single();
    if (!line) return Response.json({ error: "找不到" }, { status: 404 });
    if (line.status !== "pending") return Response.json({ error: "已收貨" }, { status: 400 });
    const recv = Number(received_qty);
    const variance = recv - Number(line.shipped_qty);
    const newStatus = variance === 0 ? "received" : "variance";

    // 更新 line
    await supabase.from("shipment_lines").update({
      received_qty: recv, variance, status: newStatus,
      received_by, received_by_name, received_at: new Date().toISOString(),
    }).eq("id", line_id);

    // 寫入 inventory_movement + 更新庫存
    await supabase.from("inventory_movements").insert({
      item_id: line.item_id, type: "in", quantity: recv, unit_cost: line.unit_cost,
      reference_type: "shipment", reference_id: line.shipment_id,
      to_store_id: line.shipments?.store_id,
      operated_by: received_by, operated_by_name: received_by_name,
      notes: `出貨單 ${line.shipments?.shipment_number} 收貨` + (variance !== 0 ? `（差異 ${variance > 0 ? "+" : ""}${variance}）` : ""),
    });
    const { data: it } = await supabase.from("inventory_items").select("current_stock").eq("id", line.item_id).single();
    await supabase.from("inventory_items").update({
      current_stock: Math.max(0, Number(it?.current_stock || 0) + recv),
      cost_per_unit: line.unit_cost || undefined,
    }).eq("id", line.item_id);

    // 若有對應 order，也標記已收
    if (line.order_id) {
      try {
        await supabase.from("purchase_orders").update({
          status: "received", received_qty: recv, received_by, received_by_name,
          received_at: new Date().toISOString(),
        }).eq("id", line.order_id);
      } catch {}
    }

    // 差異警示 LINE
    if (variance !== 0) {
      try {
        const recipients = await getStoreManagers(supabase, line.shipments?.store_id, { includeAdmin: true });
        const sign = variance > 0 ? "多收" : "短少";
        const msg = `⚠️ 進貨差異\n🏠 ${line.shipments?.stores?.name || ""}\n📋 ${line.shipments?.shipment_number}\n📦 ${line.inventory_items?.name}：出 ${line.shipped_qty}${line.unit || ""} / 實收 ${recv}${line.unit || ""}（${sign} ${Math.abs(variance)}）\n👤 ${received_by_name || ""}\n\n請與總部確認原因。`;
        for (const r of recipients) await pushText(r.line_uid, msg).catch(() => {});
      } catch {}
    }

    // 檢查是否整張單都收完
    const { data: remaining } = await supabase.from("shipment_lines")
      .select("id").eq("shipment_id", line.shipment_id).eq("status", "pending");
    if (!remaining || remaining.length === 0) {
      const { data: hasVar } = await supabase.from("shipment_lines")
        .select("id").eq("shipment_id", line.shipment_id).eq("status", "variance").limit(1);
      await supabase.from("shipments").update({
        status: hasVar?.length ? "partial" : "received",
        received_at: new Date().toISOString(),
      }).eq("id", line.shipment_id);
    }
    return Response.json({ success: true, variance });
  }

  // 後台修改：admin 可改任何 line 的數量／狀態（保留修改權）
  if (body.action === "admin_edit_line") {
    const { line_id, shipped_qty, received_qty, status, notes } = body;
    const patch = {};
    if (shipped_qty !== undefined) patch.shipped_qty = Number(shipped_qty);
    if (received_qty !== undefined) {
      patch.received_qty = Number(received_qty);
      // 重算 variance
      const { data: cur } = await supabase.from("shipment_lines").select("shipped_qty").eq("id", line_id).single();
      patch.variance = Number(received_qty) - Number((shipped_qty !== undefined ? shipped_qty : cur?.shipped_qty) || 0);
    }
    if (status !== undefined) patch.status = status;
    await supabase.from("shipment_lines").update(patch).eq("id", line_id);
    return Response.json({ success: true });
  }

  // 取消整張出貨單（draft 或 shipped 但無人收貨時）
  if (body.action === "cancel") {
    const { shipment_id, cancelled_reason } = body;
    const { data: lines } = await supabase.from("shipment_lines")
      .select("status").eq("shipment_id", shipment_id);
    if ((lines || []).some(l => l.status !== "pending")) {
      return Response.json({ error: "已有 line 收貨，無法取消" }, { status: 400 });
    }
    await supabase.from("shipments").update({
      status: "cancelled", cancelled_reason: cancelled_reason || "",
    }).eq("id", shipment_id);
    return Response.json({ success: true });
  }

  // 後台強制刪除（admin only，連同 lines）
  if (body.action === "admin_delete") {
    const { shipment_id } = body;
    await supabase.from("shipment_lines").delete().eq("shipment_id", shipment_id);
    await supabase.from("shipments").delete().eq("id", shipment_id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
