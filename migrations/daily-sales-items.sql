-- 每日品項銷售資料（從 sugarbistro-member /api/admin/ichef/sales-items 拉進來）
-- 用途：自動扣原料庫存、進銷存核對、毛利分析、叫貨建議

CREATE TABLE IF NOT EXISTS daily_sales_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id),
  date DATE NOT NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  by_source JSONB DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 同店同日同品項視為唯一（重複拉取會 upsert）
CREATE UNIQUE INDEX IF NOT EXISTS uq_dsi_store_date_item
  ON daily_sales_items(store_id, date, item_name);

-- 查詢索引
CREATE INDEX IF NOT EXISTS idx_dsi_store_date ON daily_sales_items(store_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_dsi_item ON daily_sales_items(item_name);

-- 每日聚合（每家店該日的營收 / 交易數 / 作廢數）
CREATE TABLE IF NOT EXISTS daily_sales_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id),
  date DATE NOT NULL,
  transaction_count INTEGER DEFAULT 0,
  voided_count INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, date)
);
