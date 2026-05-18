import { supabase } from "@/lib/supabase";

// 存款對帳：撈區間內日結的 cash_amount 加總當作應存，計算差異與狀態
// 規則：abs<=500 matched / abs<=2000 minor_diff / 其他 anomaly
export async function computeDepositReconciliation({ store_id, amount, period_start, period_end }) {
  if (!store_id || !period_start || !period_end) {
    return { expected: 0, difference: 0, status: "draft" };
  }
  const { data: stls } = await supabase.from("daily_settlements")
    .select("cash_amount")
    .eq("store_id", store_id)
    .gte("date", period_start)
    .lte("date", period_end);
  const expected = (stls || []).reduce((s, r) => s + Number(r.cash_amount || 0), 0);
  const amt = Number(amount) || 0;
  const diff = amt - expected;
  const abs = Math.abs(diff);
  let status;
  if (amt <= 0) status = "draft";          // 還沒填金額：保留草稿狀態
  else if (abs <= 500) status = "matched";
  else if (abs <= 2000) status = "minor_diff";
  else status = "anomaly";
  return { expected, difference: diff, status };
}
