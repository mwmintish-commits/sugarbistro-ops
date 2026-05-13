-- Phase 1+2：庫存盤點誠實標示 + 明日出貨/備料建議

-- 1) 庫存品項加上「最後盤點時間/來源」 + 是否現場製作類
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS last_count_at TIMESTAMPTZ;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS last_count_source TEXT;
-- last_count_source 可能值：
--   'opening' / 'closing'    -- 開店/閉店盤點
--   'adjustment' / 'manual'  -- 手動調整
--   'purchase' / 'shipment'  -- 進貨
--   'waste'                  -- 報廢核准
--   'auto_deduct'            -- 銷售自動扣帳（未來）

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS is_production BOOLEAN DEFAULT false;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS production_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_inv_items_last_count ON inventory_items(store_id, last_count_at);
