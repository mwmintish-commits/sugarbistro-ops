import { supabase, auditLog } from "@/lib/supabase";
import { routeCustomPayments } from "@/lib/payment-router";

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

      // 把會員系統 API 的 customPayments 跑 router：能對應到標準欄位的（匯款/信用卡/餐券...）
      // 自動加進去，剩下的（SKMpay/百貨點數/應付帳款...）保留在 custom_payments JSONB
      const { standardExtras, customEntries } = routeCustomPayments(item.customPayments);

      const rec = {
        store_id: m.id,
        date: item.reportDate,

        // 營收 / 折扣
        net_sales: num(item.totalAmount),
        discount_total: num(item.discountTotal),

        // 付款拆分（先取會員系統 API 的標準欄位金額，再加上 router 從自定義拆出來的）
        cash_amount: num(item.cashAmount) + (standardExtras.cash_amount || 0),
        credit_card_amount: num(item.creditCardAmount) + (standardExtras.credit_card_amount || 0),
        line_pay_amount: num(item.linePayAmount) + (standardExtras.line_pay_amount || 0),
        twqr_amount: num(item.twqrAmount) + (standardExtras.twqr_amount || 0),
        uber_eat_amount: num(item.uberEatAmount) + (standardExtras.uber_eat_amount || 0),
        easy_card_amount: num(item.easyCardAmount) + (standardExtras.easy_card_amount || 0),
        meal_voucher_amount: num(item.mealVoucherAmount) + (standardExtras.meal_voucher_amount || 0),
        line_credit_amount: num(item.linePointsAmount),
        drink_voucher_amount: num(item.drinkVoucherAmount),
        remittance_amount: standardExtras.remittance_amount || 0,
        // 「其他」= router 沒對應到的 custom 總和（若會員系統 API 沒給 customPayments，fallback 到原 otherPaymentAmount）
        other_payment_amount: Array.isArray(item.customPayments) && item.customPayments.length > 0
          ? customEntries.reduce((a, e) => a + e.amount, 0)
          : num(item.otherPaymentAmount),
        custom_payments: customEntries,

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

      // 使用 upsert + onConflict 一次處理 insert/update
      // 注意：ops 用 anon key 受 RLS 限制，select 看不到既有紀錄，
      // 但 PostgreSQL ON CONFLICT 會在 DB 層處理 unique 衝突。
      // deposit_id 欄位不在 rec 裡，DO UPDATE 不會清掉既有 deposit_id。
      const { error: ue } = await supabase
        .from("daily_settlements")
        .upsert(rec, { onConflict: "store_id,date" });
      if (ue) {
        errors.push(`${m.name} ${rec.date} upsert 失敗：${ue.message}`);
      } else {
        inserted++; // 不區分 new/update（anon 看不到既有紀錄）
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
