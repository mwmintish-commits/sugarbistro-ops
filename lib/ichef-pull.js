import { supabase, auditLog } from "@/lib/supabase";

const MEMBER_BASE = "https://sugarbistro-member.zeabur.app";
const MEMBER_SYNC_API = `${MEMBER_BASE}/api/cron/ichef/account-sync`;
const MEMBER_REPORT_API = `${MEMBER_BASE}/api/admin/ichef/account-report`;

export function yesterdayTaipei() {
  const t = new Date(Date.now() + 8 * 3600_000);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

export async function pullIchefSettlements({ start, end, store } = {}) {
  if (!process.env.CRON_SECRET) {
    return { ok: false, status: 500, body: { error: "CRON_SECRET 未設定（Zeabur 環境變數）" } };
  }
  const startDate = start || yesterdayTaipei();
  const endDate = end || startDate;
  const authHeader = { Authorization: `Bearer ${process.env.CRON_SECRET}` };

  // 1) 先觸發會員系統重新抓 iChef（確保 DB 是最新且付款拆分正確）
  const syncParams = new URLSearchParams({ start: startDate, end: endDate });
  if (store) syncParams.set("store", store);
  const syncUrl = `${MEMBER_SYNC_API}?${syncParams.toString()}`;
  try {
    const sr = await fetch(syncUrl, { method: "POST", headers: authHeader });
    if (!sr.ok) {
      const text = await sr.text();
      return {
        ok: false, status: 502,
        body: {
          error: `會員系統 sync 失敗 HTTP ${sr.status}`,
          detail: text.slice(0, 500),
          url: syncUrl,
        }
      };
    }
    // sync 回傳僅作 audit，不影響後續 pull
  } catch (e) {
    return {
      ok: false, status: 502,
      body: { error: "觸發會員系統 sync 失敗：" + (e?.message || String(e)) }
    };
  }

  // 2) 再從會員系統讀資料
  const params = new URLSearchParams({ start: startDate, end: endDate });
  if (store) params.set("store", store);
  const memberUrl = `${MEMBER_REPORT_API}?${params.toString()}`;

  let memberJson;
  try {
    const r = await fetch(memberUrl, { headers: authHeader });
    if (!r.ok) {
      const text = await r.text();
      return {
        ok: false, status: 502,
        body: {
          error: `會員系統 API 失敗 HTTP ${r.status}`,
          detail: text.slice(0, 500),
          url: memberUrl,
        }
      };
    }
    memberJson = await r.json();
  } catch (e) {
    return {
      ok: false, status: 502,
      body: { error: "連線會員系統失敗：" + (e?.message || String(e)) }
    };
  }

  // 2) 載入 store 對應表（ichef_code → id）
  const { data: stores } = await supabase
    .from("stores")
    .select("id, name, ichef_code")
    .not("ichef_code", "is", null);
  const codeMap = {};
  for (const s of stores || []) codeMap[s.ichef_code] = { id: s.id, name: s.name };

  // 3) 逐筆 upsert
  let inserted = 0, updated = 0, skippedNoMap = 0, skippedManual = 0;
  const errors = [];
  const unmappedCodes = new Set();

  for (const item of memberJson.data || []) {
    try {
      const m = codeMap[item.storeCode];
      if (!m) {
        skippedNoMap++;
        unmappedCodes.add(item.storeCode);
        continue;
      }
      const num = (v) => Number(v || 0);
      const str = (v) => { const s = String(v || "").trim(); return s || null; };
      const rec = {
        store_id: m.id,
        date: item.reportDate,

        // 營收 / 折扣
        net_sales: num(item.totalAmount),
        discount_total: num(item.discountTotal),

        // 付款拆分
        cash_amount: num(item.cashAmount),
        credit_card_amount: num(item.creditCardAmount),
        line_pay_amount: num(item.linePayAmount),
        twqr_amount: num(item.twqrAmount),
        uber_eat_amount: num(item.uberEatAmount),
        easy_card_amount: num(item.easyCardAmount),
        meal_voucher_amount: num(item.mealVoucherAmount),
        line_credit_amount: num(item.linePointsAmount),
        drink_voucher_amount: num(item.drinkVoucherAmount),
        other_payment_amount: num(item.otherPaymentAmount),

        // 發票
        invoice_count: num(item.invoiceCount),
        invoice_start: str(item.invoiceStart),
        invoice_end: str(item.invoiceEnd),
        void_invoice_count: num(item.voidInvoiceCount ?? item.cancelledCount),
        void_invoice_amount: num(item.voidInvoiceAmount),

        // 其他
        cashier_name: str(item.cashierName),
        ichef_short_amount: num(item.shortAmount),
        ichef_synced_at: new Date().toISOString(),
      };

      const { data: ex } = await supabase
        .from("daily_settlements")
        .select("id, manually_corrected, deposit_id")
        .eq("store_id", m.id)
        .eq("date", rec.date)
        .maybeSingle();

      if (ex?.id) {
        // 已連結存款的不覆蓋核心數字，僅更新同步時間/短少
        if (ex.deposit_id) {
          skippedManual++;
          errors.push(`${m.name} ${rec.date}：已連結存款，僅更新同步時間`);
          const { error: e1 } = await supabase.from("daily_settlements")
            .update({ ichef_synced_at: rec.ichef_synced_at, ichef_short_amount: rec.ichef_short_amount })
            .eq("id", ex.id);
          if (e1) errors.push(`${m.name} ${rec.date} update(synced)失敗：${e1.message}`);
          continue;
        }
        const { error: e2 } = await supabase.from("daily_settlements").update(rec).eq("id", ex.id);
        if (e2) {
          errors.push(`${m.name} ${rec.date} update 失敗：${e2.message}`);
        } else {
          updated++;
        }
      } else {
        const { error: e3 } = await supabase.from("daily_settlements").insert(rec);
        if (e3) {
          errors.push(`${m.name} ${rec.date} insert 失敗：${e3.message}`);
        } else {
          inserted++;
        }
      }
    } catch (e) {
      errors.push(`${item.storeCode} ${item.reportDate}: ${e?.message || e}`);
    }
  }

  await auditLog(null, null, "ichef_pull", "settlement", null, {
    range: { start: startDate, end: endDate },
    fetched: memberJson.count || 0,
    inserted, updated, skippedNoMap, skippedManual,
    unmapped: Array.from(unmappedCodes),
    errors: errors.slice(0, 5),
  });

  return {
    ok: true, status: 200,
    body: {
      success: true,
      range: { start: startDate, end: endDate },
      fetched: memberJson.count || 0,
      inserted, updated, skippedNoMap, skippedManual,
      unmapped_codes: Array.from(unmappedCodes),
      errors: errors.slice(0, 10),
      message: `匯入完成：新增 ${inserted}、更新 ${updated}、未對應門市 ${skippedNoMap}、已對帳跳過 ${skippedManual}`,
    }
  };
}
