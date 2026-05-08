import { supabase, auditLog } from "@/lib/supabase";

const MEMBER_API = "https://sugarbistro-member.zeabur.app/api/admin/ichef/account-report";

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

  // 1) 從會員系統抓資料
  const params = new URLSearchParams({ start: startDate, end: endDate });
  if (store) params.set("store", store);
  const memberUrl = `${MEMBER_API}?${params.toString()}`;

  let memberJson;
  try {
    const r = await fetch(memberUrl, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
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
      const rec = {
        store_id: m.id,
        date: item.reportDate,
        net_sales: Number(item.totalAmount || 0),
        void_invoice_count: Number(item.cancelledCount || 0),
        ichef_short_amount: Number(item.shortAmount || 0),
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
          await supabase.from("daily_settlements")
            .update({ ichef_synced_at: rec.ichef_synced_at, ichef_short_amount: rec.ichef_short_amount })
            .eq("id", ex.id);
          continue;
        }
        await supabase.from("daily_settlements").update(rec).eq("id", ex.id);
        updated++;
      } else {
        await supabase.from("daily_settlements").insert(rec);
        inserted++;
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
