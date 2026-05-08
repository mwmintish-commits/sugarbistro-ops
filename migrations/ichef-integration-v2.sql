-- ================================================
-- iChef 整合 v2：補上會員系統 API 新增的欄位對應
-- ================================================
-- 對應 sugarbistro-member API 擴充：
--   creditCardAmount  → credit_card_amount
--   otherPaymentAmount → other_payment_amount
-- 其餘欄位（cashAmount、linePayAmount...）daily_settlements 已存在，不需 ALTER

ALTER TABLE daily_settlements ADD COLUMN IF NOT EXISTS credit_card_amount NUMERIC DEFAULT 0;
ALTER TABLE daily_settlements ADD COLUMN IF NOT EXISTS other_payment_amount NUMERIC DEFAULT 0;
