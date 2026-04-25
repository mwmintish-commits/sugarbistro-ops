-- 叫貨單：與 inventory_items 同表體系
-- 流程：建立(pending) → 收貨(received，自動入庫+扣理論成本) / 取消(cancelled)
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  quantity NUMERIC NOT NULL,
  unit TEXT,
  unit_cost NUMERIC,
  supplier_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | received | cancelled
  notes TEXT,
  requested_by UUID REFERENCES employees(id),
  requested_by_name TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  expected_date DATE,
  received_by UUID REFERENCES employees(id),
  received_by_name TEXT,
  received_at TIMESTAMPTZ,
  received_qty NUMERIC, -- 實收數量（可能跟下單不同）
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(store_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_item ON purchase_orders(item_id, status);
