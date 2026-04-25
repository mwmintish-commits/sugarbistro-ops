-- 出貨單：總部實際配送的依據（與「叫貨單」分離）
-- 叫貨單 purchase_orders = 門市需求（wishlist）
-- 出貨單 shipments        = 總部實際出的東西（ground truth）
-- 一張出貨單可對應多筆叫貨單，也可不對應（補貨/促銷型主動出貨）

CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number TEXT UNIQUE NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id),
  status TEXT NOT NULL DEFAULT 'draft', -- draft | shipped | received | partial | cancelled
  notes TEXT,
  created_by UUID REFERENCES employees(id),
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  shipped_by UUID REFERENCES employees(id),
  shipped_by_name TEXT,
  shipped_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  cancelled_reason TEXT
);

CREATE TABLE IF NOT EXISTS shipment_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  order_id UUID REFERENCES purchase_orders(id), -- 可空：自主補貨
  shipped_qty NUMERIC NOT NULL,
  received_qty NUMERIC,
  unit TEXT,
  unit_cost NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | received | variance
  variance NUMERIC, -- received_qty - shipped_qty（負值=短少，正值=多收）
  received_at TIMESTAMPTZ,
  received_by UUID REFERENCES employees(id),
  received_by_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_shipments_store ON shipments(store_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipment_lines_ship ON shipment_lines(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_lines_item ON shipment_lines(item_id, status);

-- 重點品項（Phase 3）：對帳優先 SKU
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS is_key_item BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN inventory_items.is_key_item IS '高風險/高成本重點品項，銷售對帳優先';
CREATE INDEX IF NOT EXISTS idx_inventory_key ON inventory_items(store_id, is_key_item) WHERE is_key_item = TRUE;
