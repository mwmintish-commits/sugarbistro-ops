// 食材報廢稽核 API
// GET  ?type=queue&status=pending      → 後台稽核佇列
// GET  ?type=stats&store_id=&month=    → 統計（按門市/原因/位置）
// GET  ?type=today&store_id=           → 今日某店狀態（是否已登記/無報廢）
// POST { action: "submit_waste" }      → 員工提交報廢
// POST { action: "confirm_no_waste" }  → 員工提交「本日無報廢」
// POST { action: "audit" }             → 主管核准/退回/列入觀察

import { supabase } from "@/lib/supabase";
import { analyzeWastePhoto } from "@/lib/anthropic";

const LOCATIONS = ["refrig", "freezer", "ambient", "display"];
const LOC_LABEL = { refrig: "冷藏", freezer: "冷凍", ambient: "常溫", display: "展示櫃" };

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "queue";

  if (type === "queue") {
    const status = searchParams.get("status") || "pending";
    const store_id = searchParams.get("store_id");
    let q = supabase.from("inventory_movements")
      .select("*, inventory_items(name, unit, cost_per_unit), stores(name)")
      .in("type", ["waste", "no_waste"])
      .eq("audit_status", status)
      .order("created_at", { ascending: false })
      .limit(200);
    if (store_id) q = q.eq("store_id", store_id);
    const { data } = await q;
    return Response.json({ data: data || [] });
  }

  if (type === "today") {
    const store_id = searchParams.get("store_id");
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
    const start = today + "T00:00:00+08:00";
    const end = today + "T23:59:59+08:00";
    const { data } = await supabase.from("inventory_movements")
      .select("id, type, patrol_location, waste_reason, quantity, audit_status, submitted_by_name, created_at, inventory_items(name, unit)")
      .eq("store_id", store_id)
      .in("type", ["waste", "no_waste"])
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false });
    const noWaste = (data || []).find(d => d.type === "no_waste");
    const wastes = (data || []).filter(d => d.type === "waste");
    return Response.json({ data: { no_waste: !!noWaste, no_waste_at: noWaste?.created_at, wastes } });
  }

  if (type === "stats") {
    const store_id = searchParams.get("store_id");
    const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
    const start = month + "-01T00:00:00+08:00";
    const endMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    const end = month + "-" + endMonth + "T23:59:59+08:00";
    let q = supabase.from("inventory_movements")
      .select("store_id, patrol_location, waste_reason, quantity, audit_status, inventory_items(name, cost_per_unit), stores(name)")
      .eq("type", "waste")
      .gte("created_at", start).lte("created_at", end);
    if (store_id) q = q.eq("store_id", store_id);
    const { data } = await q;
    const byLoc = {}; const byReason = {}; const byStore = {};
    let totalCost = 0;
    for (const r of data || []) {
      const cost = (r.inventory_items?.cost_per_unit || 0) * Math.abs(Number(r.quantity || 0));
      totalCost += cost;
      const loc = r.patrol_location || "unknown";
      const rs = r.waste_reason || "未分類";
      const sn = r.stores?.name || "未知";
      byLoc[loc] = (byLoc[loc] || 0) + cost;
      byReason[rs] = (byReason[rs] || 0) + cost;
      byStore[sn] = (byStore[sn] || 0) + cost;
    }
    return Response.json({ data: { totalCost, count: (data || []).length, byLoc, byReason, byStore } });
  }

  return Response.json({ error: "Unknown type" }, { status: 400 });
}

export async function POST(request) {
  const body = await request.json();

  // AI 辨識報廢照片（回傳建議品項/數量/原因）
  if (body.action === "analyze_photo") {
    const { base64, store_id } = body;
    if (!base64) return Response.json({ error: "缺少 base64" }, { status: 400 });
    const { data: items } = await supabase.from("inventory_items")
      .select("id, name, unit").eq("store_id", store_id).eq("is_active", true);
    if (!items || items.length === 0) return Response.json({ error: "門市無庫存品項" });
    try {
      const r = await analyzeWastePhoto(base64, items);
      if (!r) return Response.json({ error: "辨識失敗" });
      // 對應到 item_id
      const matched = items.find(i => i.name === r.item_name) ||
        items.find(i => r.item_name && (i.name.includes(r.item_name) || r.item_name.includes(i.name)));
      return Response.json({
        item_id: matched?.id || null,
        item_name: matched?.name || r.item_name,
        unit: matched?.unit || null,
        quantity: r.quantity || 1,
        reason: r.reason || null,
        confidence: r.confidence || "low",
        description: r.description || "",
      });
    } catch (e) {
      return Response.json({ error: e.message });
    }
  }

  // 員工提交報廢（單筆）
  if (body.action === "submit_waste") {
    const {
      store_id, employee_id, employee_name,
      item_id, quantity, patrol_location, waste_reason,
      waste_photo_url, gps_lat, gps_lng, note,
    } = body;
    if (!store_id || !item_id || !quantity) {
      return Response.json({ error: "缺少必要欄位（門市/品項/數量）" }, { status: 400 });
    }
    if (!LOCATIONS.includes(patrol_location)) {
      return Response.json({ error: "巡邏位置必須為 冷藏/冷凍/常溫/展示櫃" }, { status: 400 });
    }
    if (!waste_photo_url) {
      return Response.json({ error: "報廢必須附照片佐證" }, { status: 400 });
    }
    const { data, error } = await supabase.from("inventory_movements").insert({
      store_id, item_id,
      type: "waste",
      quantity: -Math.abs(Number(quantity)),
      reference_type: "waste",
      patrol_location,
      waste_reason: waste_reason || "未分類",
      waste_photo_url,
      gps_lat: gps_lat || null,
      gps_lng: gps_lng || null,
      submitted_by_name: employee_name || null,
      note: note || null,
      audit_status: "pending",
    }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });

    // 分層通知：該店店長 + 區經理（不再推總部 admin）
    try {
      const { getStoreManagers } = await import("@/lib/notify");
      const recipients = await getStoreManagers(supabase, store_id);
      const { data: it } = await supabase.from("inventory_items").select("name, unit").eq("id", item_id).single();
      const { data: st } = await supabase.from("stores").select("name").eq("id", store_id).single();
      const { pushText } = await import("@/lib/line");
      const msg = "🗑 報廢登記\n🏠 " + (st?.name || store_id) +
        "\n📍 " + LOC_LABEL[patrol_location] +
        "\n📦 " + (it?.name || "?") + " " + Math.abs(quantity) + (it?.unit || "") +
        "\n📝 " + (waste_reason || "未分類") +
        "\n👤 " + (employee_name || "?") +
        "\n→ 請至後台稽核";
      for (const r of recipients) await pushText(r.line_uid, msg).catch(() => {});
    } catch {}

    return Response.json({ data });
  }

  // 員工確認本日無報廢
  if (body.action === "confirm_no_waste") {
    const { store_id, employee_id, employee_name } = body;
    if (!store_id) return Response.json({ error: "缺少門市" }, { status: 400 });
    // 防重複：今日已有同店 no_waste 直接回傳
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
    const start = today + "T00:00:00+08:00";
    const end = today + "T23:59:59+08:00";
    const { data: exists } = await supabase.from("inventory_movements")
      .select("id").eq("store_id", store_id).eq("type", "no_waste")
      .gte("created_at", start).lte("created_at", end).maybeSingle();
    if (exists) return Response.json({ data: exists, already: true });

    const { data, error } = await supabase.from("inventory_movements").insert({
      store_id,
      item_id: null,
      type: "no_waste",
      quantity: 0,
      reference_type: "no_waste",
      submitted_by_name: employee_name || null,
      audit_status: "approved", // 「無報廢」自動核准
    }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  // 主管稽核：approved / rejected / observe
  if (body.action === "audit") {
    const { movement_id, decision, audit_note, audit_by } = body;
    if (!["approved", "rejected", "observe"].includes(decision)) {
      return Response.json({ error: "decision 必須為 approved/rejected/observe" }, { status: 400 });
    }
    const { data, error } = await supabase.from("inventory_movements").update({
      audit_status: decision,
      audit_note: audit_note || null,
      audit_by: audit_by || null,
      audit_at: new Date().toISOString(),
    }).eq("id", movement_id).select("*, inventory_items(id, current_stock)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });

    // 若核准：扣庫存
    if (decision === "approved" && data?.item_id && data.quantity) {
      const cur = Number(data.inventory_items?.current_stock || 0);
      const next = Math.max(0, cur + Number(data.quantity)); // quantity 已是負值
      await supabase.from("inventory_items").update({ current_stock: next }).eq("id", data.item_id);
    }
    return Response.json({ data });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
