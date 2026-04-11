-- ============================================
-- 生產 + 代工 + B2B 完整資料庫
-- ============================================

-- 1. 庫存品項
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  type TEXT DEFAULT 'raw_material', -- raw_material/semi_finished/finished/packaging
  category TEXT, -- 乾貨/冷藏/冷凍/包材/清潔
  unit TEXT DEFAULT '個',
  current_stock NUMERIC DEFAULT 0,
  safe_stock NUMERIC DEFAULT 0,
  cost_per_unit NUMERIC DEFAULT 0,
  store_id UUID REFERENCES stores(id),
  supplier_name TEXT,
  expiry_days INTEGER,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE inventory_items DISABLE ROW LEVEL SECURITY;

-- 2. 庫存異動
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES inventory_items(id),
  type TEXT NOT NULL, -- in/out/adjust/transfer/waste
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC,
  reference_type TEXT, -- purchase/production/sale/transfer/waste
  reference_id UUID,
  batch_number TEXT,
  expiry_date DATE,
  from_store_id UUID,
  to_store_id UUID,
  operated_by UUID,
  operated_by_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE inventory_movements DISABLE ROW LEVEL SECURITY;

-- 3. 配方
CREATE TABLE IF NOT EXISTS recipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT, -- 泡芙/餅乾/蛋糕/冰淇淋/吐司/其他
  type TEXT DEFAULT 'finished', -- finished/semi_finished
  yield_qty NUMERIC DEFAULT 1,
  yield_unit TEXT DEFAULT '個',
  labor_minutes INTEGER DEFAULT 0,
  instructions TEXT,
  cost_per_unit NUMERIC DEFAULT 0,
  selling_price NUMERIC DEFAULT 0,
  wholesale_price NUMERIC DEFAULT 0,
  margin_percent NUMERIC DEFAULT 0,
  store_id UUID REFERENCES stores(id), -- 生產門市
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE recipes DISABLE ROW LEVEL SECURITY;

-- 4. 配方原料
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  item_id UUID REFERENCES inventory_items(id),
  item_name TEXT,
  quantity NUMERIC NOT NULL,
  unit TEXT,
  sort_order INTEGER DEFAULT 0
);
ALTER TABLE recipe_ingredients DISABLE ROW LEVEL SECURITY;

-- 5. 客戶
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'b2b', -- oem/b2b/both
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_id TEXT, -- 統編
  payment_terms TEXT DEFAULT '月結30天',
  credit_limit NUMERIC DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;

-- 6. 客戶訂單
CREATE TABLE IF NOT EXISTS client_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL,
  client_id UUID REFERENCES clients(id),
  type TEXT DEFAULT 'b2b', -- oem/b2b
  status TEXT DEFAULT 'confirmed', -- quotation/confirmed/in_production/ready/shipped/delivered/invoiced/paid
  order_date DATE DEFAULT CURRENT_DATE,
  delivery_date DATE,
  total_amount NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid', -- unpaid/partial/paid
  paid_amount NUMERIC DEFAULT 0,
  paid_date DATE,
  shipping_address TEXT,
  shipping_method TEXT, -- 自送/貨運/宅配
  tracking_number TEXT,
  shipped_date DATE,
  delivered_date DATE,
  invoice_number TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE client_orders DISABLE ROW LEVEL SECURITY;

-- 7. 訂單明細
CREATE TABLE IF NOT EXISTS client_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES client_orders(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id),
  item_id UUID REFERENCES inventory_items(id),
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT DEFAULT '個',
  unit_price NUMERIC DEFAULT 0,
  total_price NUMERIC DEFAULT 0,
  production_order_id UUID,
  notes TEXT
);
ALTER TABLE client_order_items DISABLE ROW LEVEL SECURITY;

-- 8. 生產工單
CREATE TABLE IF NOT EXISTS production_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL,
  recipe_id UUID REFERENCES recipes(id),
  recipe_name TEXT,
  planned_qty NUMERIC NOT NULL,
  actual_qty NUMERIC DEFAULT 0,
  waste_qty NUMERIC DEFAULT 0,
  yield_rate NUMERIC DEFAULT 0,
  store_id UUID REFERENCES stores(id),
  production_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'planned', -- planned/in_progress/completed/cancelled
  order_type TEXT DEFAULT 'stock', -- stock/oem/b2b
  client_order_id UUID REFERENCES client_orders(id),
  assigned_to UUID REFERENCES employees(id),
  assigned_name TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE production_orders DISABLE ROW LEVEL SECURITY;

-- 序號產生器
CREATE SEQUENCE IF NOT EXISTS po_seq START 1;
CREATE SEQUENCE IF NOT EXISTS co_seq START 1;

SELECT '✅ 生產/代工/B2B 資料庫建置完成' AS result;
