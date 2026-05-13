import { supabase, auditLog } from "@/lib/supabase";

// 從 sugarbistro-member 拉品項銷售資料寫進 daily_sales_items
// 若 USE_MOCK=1 環境變數設定 → 改打 ops 自己的 mock endpoint（給 member 還沒實作完前 dev/test 用）

const MEMBER_API = "https://sugarbistro-member.zeabur.app/api/admin/ichef/sales-items";

export function yesterdayTaipei() {
  const t = new Date(Date.now() + 8 * 3600_000);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

export async function pullIchefSalesItems({ start, end, store, useMock = false } = {}) {
  if (!process.env.CRON_SECRET) {
    return { ok: false, status: 500, body: { error: "CRON_SECRET 未設定" } };
  }
  const startDate = start || yesterdayTaipei();
  const endDate = end || startDate;
  const authHeader = { Authorization: `Bearer ${process.env.CRON_SECRET}` };

  // 來源：mock or real
  const baseUrl = useMock
    ? (process.env.SITE_URL || "https://sugarbistro-ops.zeabur.app") + "/api/_mock/ichef-sales-items"
    : MEMBER_API;
  const params = new URLSearchParams({ start: startDate, end: endDate });
  if (store) params.set("store", store);
  const fetchUrl = `${baseUrl}?${params.toString()}`;

  let payload;
  try {
    const r = await fetch(fetchUrl, { headers: authHeader });
    if (!r.ok) {
      const text = await r.text();
      return {
        ok: false, status: 502,
        body: { error: `API 失敗 HTTP ${r.status}`, detail: text.slice(0, 500), url: fetchUrl }
      };
    }
    payload = await r.json();
  } catch (e) {
    return { ok: false, status: 502, body: { error: "連線失敗：" + (e?.message || e) } };
  }

  // store 對應表（ichef_code → store id）
  const { data: stores } = await supabase
    .from("stores")
    .select("id, name, ichef_code")
    .not("ichef_code", "is", null);
  const codeMap = {};
  for (const s of stores || []) codeMap[s.ichef_code] = { id: s.id, name: s.name };

  let upsertItems = 0, upsertSummary = 0, skipped = 0;
  let totalDeducted = 0, totalMissing = 0;
  const missingByStore = {};
  const unmapped = new Set();
  const errors = [];

  for (const dayStore of payload.data || []) {
    const sid = codeMap[dayStore.storeCode]?.id;
    if (!sid) {
      unmapped.add(dayStore.storeCode);
      skipped++;
      continue;
    }

    // 1) 每日聚合
    try {
      const { error: sumErr } = await supabase
        .from("daily_sales_summary")
        .upsert({
          store_id: sid,
          date: dayStore.reportDate,
          transaction_count: Number(dayStore.transactionCount || 0),
          voided_count: Number(dayStore.voidedCount || 0),
          total_revenue: Number(dayStore.totalRevenue || 0),
          synced_at: new Date().toISOString(),
        }, { onConflict: "store_id,date" });
      if (sumErr) errors.push(`${dayStore.storeName} ${dayStore.reportDate} summary: ${sumErr.message}`);
      else upsertSummary++;
    } catch (e) {
      errors.push(`${dayStore.storeName} ${dayStore.reportDate} summary: ${e.message}`);
    }

    // 2) 每筆品項（先清掉同店同日舊資料再插入，避免重複拉取累積）
    try {
      await supabase.from("daily_sales_items")
        .delete().eq("store_id", sid).eq("date", dayStore.reportDate);
      const rows = (dayStore.items || []).map(it => ({
        store_id: sid,
        date: dayStore.reportDate,
        item_name: String(it.name || "").trim().slice(0, 200),
        quantity: Number(it.quantity || 0),
        unit_price: Number(it.unitPrice || 0),
        revenue: Number(it.revenue || 0),
        by_source: it.bySource || {},
        synced_at: new Date().toISOString(),
      })).filter(r => r.item_name);
      if (rows.length > 0) {
        const { error: insErr } = await supabase.from("daily_sales_items").insert(rows);
        if (insErr) errors.push(`${dayStore.storeName} ${dayStore.reportDate} items: ${insErr.message}`);
        else upsertItems += rows.length;
      }

      // 3) 自動扣完成品庫存（如果該日尚未扣過）
      const { data: summary } = await supabase.from("daily_sales_summary")
        .select("auto_deducted_at").eq("store_id", sid).eq("date", dayStore.reportDate).maybeSingle();
      if (!summary?.auto_deducted_at) {
        const result = await autoDeductFinished(sid, dayStore.items || [], dayStore.reportDate);
        totalDeducted += result.deducted.length;
        totalMissing += result.missing.length;
        if (result.missing.length > 0) {
          missingByStore[dayStore.storeName] = result.missing;
        }
        await supabase.from("daily_sales_summary").update({
          auto_deducted_at: new Date().toISOString(),
          deduction_summary: { deducted: result.deducted.length, missing: result.missing.length, total_qty: result.totalQty },
        }).eq("store_id", sid).eq("date", dayStore.reportDate);
      }
    } catch (e) {
      errors.push(`${dayStore.storeName} ${dayStore.reportDate} items: ${e.message}`);
    }
  }

  await auditLog(null, null, "ichef_sales_pull", "sales", null, {
    range: { start: startDate, end: endDate }, source: useMock ? "mock" : "member",
    summary_upserts: upsertSummary, item_upserts: upsertItems,
    deducted: totalDeducted, missing: totalMissing,
    skipped, unmapped: Array.from(unmapped), errors: errors.slice(0, 5),
  });

  return {
    ok: true, status: 200,
    body: {
      success: true,
      range: { start: startDate, end: endDate },
      source: useMock ? "mock" : "member",
      summary_upserts: upsertSummary,
      item_upserts: upsertItems,
      auto_deducted: totalDeducted,
      missing_items: totalMissing,
      missing_by_store: missingByStore,
      skipped, unmapped: Array.from(unmapped),
      errors: errors.slice(0, 10),
      message: `匯入完成：彙總 ${upsertSummary} 店日、品項 ${upsertItems} 筆、自動扣 ${totalDeducted} 種完成品${totalMissing > 0 ? `（${totalMissing} 種無對應庫存項目）` : ""}`,
    }
  };
}

// 銷售自動扣完成品庫存（1:1，type='finished' 才扣）
async function autoDeductFinished(storeId, salesItems, reportDate) {
  const { data: finishedItems } = await supabase.from("inventory_items")
    .select("id, name, current_stock, cost_per_unit")
    .eq("store_id", storeId)
    .eq("type", "finished")
    .eq("is_active", true);
  const itemMap = {};
  for (const it of finishedItems || []) itemMap[String(it.name || "").trim()] = it;

  const deducted = [];
  const missing = [];
  let totalQty = 0;

  for (const sale of salesItems) {
    const name = String(sale.name || "").trim();
    const qty = Number(sale.quantity || 0);
    if (!name || qty <= 0) continue;
    const item = itemMap[name];
    if (!item) {
      missing.push({ name, quantity: qty });
      continue;
    }
    totalQty += qty;
    const newStock = Math.max(0, Number(item.current_stock || 0) - qty);
    await supabase.from("inventory_items").update({ current_stock: newStock }).eq("id", item.id);
    // audit 軌跡
    await supabase.from("inventory_movements").insert({
      item_id: item.id,
      store_id: storeId,
      type: "sale",
      quantity: -qty,
      reference_type: "ichef_sale",
      reference_date: reportDate,
      note: `自動扣帳 ${reportDate}：${name} × ${qty}`,
    });
    deducted.push({ item_id: item.id, name, qty, new_stock: newStock });
  }

  return { deducted, missing, totalQty };
}
