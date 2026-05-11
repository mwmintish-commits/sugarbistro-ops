-- ============================================================
-- 自定義結帳明細支援（iChef「自定義結帳」可能包含匯款 / SKMpay /
-- 百貨點數等多種，每筆要清楚顯示避免爭議）
-- ============================================================

-- 1. 每筆日結的自定義結帳明細
-- 範例: [{"method":"匯款","amount":5000},{"method":"SKMpay","amount":2000}]
ALTER TABLE daily_settlements ADD COLUMN IF NOT EXISTS custom_payments JSONB DEFAULT '[]'::jsonb;

-- 2. 該店常用的自定義結帳方式（給後台快速選單用）
-- 範例: 屏東店 → {匯款,SKMpay,百貨點數}
ALTER TABLE stores ADD COLUMN IF NOT EXISTS custom_payment_methods TEXT[] DEFAULT '{}';

-- 3. 索引（讓 Phase 4 報表能快速彙總）
CREATE INDEX IF NOT EXISTS idx_ds_custom_pay ON daily_settlements USING gin (custom_payments);
