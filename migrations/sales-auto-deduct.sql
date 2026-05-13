-- 銷售自動扣完成品庫存 — 追蹤每店每日是否已扣過，避免重複拉取重複扣
ALTER TABLE daily_sales_summary ADD COLUMN IF NOT EXISTS auto_deducted_at TIMESTAMPTZ;
ALTER TABLE daily_sales_summary ADD COLUMN IF NOT EXISTS deduction_summary JSONB DEFAULT '{}'::jsonb;

-- inventory_movements 加 reference_date 索引（讓「該店該日已扣？」查詢快速）
CREATE INDEX IF NOT EXISTS idx_inv_mov_sale_ref
  ON inventory_movements(store_id, reference_date)
  WHERE type = 'sale';
