-- ============================
-- 小食糖營運系統 - 資料表建立
-- 根據實際 POS 日結單 & 華南銀行存款單欄位設計
-- 在 Supabase SQL Editor 中執行
-- ============================

-- 1. 門市資料表
CREATE TABLE stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  radius_m INTEGER DEFAULT 100,
  store_type TEXT DEFAULT 'restaurant',
  bank_name TEXT,
  bank_branch TEXT,
  bank_account TEXT,
  cash_threshold NUMERIC DEFAULT 50000,
  deposit_tolerance NUMERIC DEFAULT 500,
  petty_cash NUMERIC DEFAULT 8000,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 員工資料表
CREATE TABLE employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  line_uid TEXT UNIQUE,
  phone TEXT,
  store_id UUID REFERENCES stores(id),
  role TEXT DEFAULT 'staff',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 日結單資料表（對應 POS 實際欄位）
CREATE TABLE daily_settlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  date DATE NOT NULL,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  cashier_name TEXT,

  -- 營收
  net_sales NUMERIC DEFAULT 0,
  discount_total NUMERIC DEFAULT 0,

  -- 各支付方式
  cash_amount NUMERIC DEFAULT 0,
  line_pay_amount NUMERIC DEFAULT 0,
  twqr_amount NUMERIC DEFAULT 0,
  uber_eat_amount NUMERIC DEFAULT 0,
  easy_card_amount NUMERIC DEFAULT 0,
  meal_voucher_amount NUMERIC DEFAULT 0,
  line_credit_amount NUMERIC DEFAULT 0,
  drink_voucher_amount NUMERIC DEFAULT 0,

  -- 發票
  invoice_count INTEGER DEFAULT 0,
  invoice_start TEXT,
  invoice_end TEXT,
  void_invoice_count INTEGER DEFAULT 0,
  void_invoice_amount NUMERIC DEFAULT 0,

  -- 現金
  cash_in_register NUMERIC DEFAULT 0,
  petty_cash_reserved NUMERIC DEFAULT 0,
  cash_to_deposit NUMERIC DEFAULT 0,

  -- 紅利
  bonus_item_count INTEGER DEFAULT 0,
  bonus_item_amount NUMERIC DEFAULT 0,

  -- 系統欄位
  image_url TEXT,
  ai_raw_data JSONB,
  manually_corrected BOOLEAN DEFAULT false,
  submitted_by UUID REFERENCES employees(id),
  submitted_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(store_id, date)
);

-- 4. 存款紀錄資料表（對應華南銀行存款單欄位）
CREATE TABLE deposits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  deposit_date DATE NOT NULL,
  amount NUMERIC NOT NULL,

  -- 銀行單據資訊
  bank_name TEXT,
  bank_branch TEXT,
  account_number TEXT,
  depositor_name TEXT,
  roc_date TEXT,

  -- 核對
  period_start DATE,
  period_end DATE,
  expected_cash NUMERIC,
  difference NUMERIC,
  status TEXT DEFAULT 'pending',
  note TEXT,

  -- 系統欄位
  image_url TEXT,
  ai_raw_data JSONB,
  submitted_by UUID REFERENCES employees(id),
  verified_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. 用戶狀態表
CREATE TABLE user_states (
  line_uid TEXT PRIMARY KEY,
  current_flow TEXT,
  flow_data JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- 允許公開讀取
CREATE POLICY "Public read receipts" ON storage.objects
  FOR SELECT USING (bucket_id = 'receipts');

-- 允許寫入
CREATE POLICY "Allow upload receipts" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'receipts');

-- ============================
-- 插入四間門市初始資料
-- ============================
INSERT INTO stores (name, address, store_type, latitude, longitude, radius_m, bank_name, bank_branch, petty_cash) VALUES
  ('台北門市', '台北市', 'restaurant', 25.0330, 121.5654, 100, '華南商業銀行', '', 8000),
  ('屏東門市', '屏東縣', 'restaurant', 22.6727, 120.4868, 100, '華南商業銀行', '屏東分行', 8000),
  ('新光左營店', '高雄市左營區', 'department', 22.6686, 120.3025, 200, '', '', 0),
  ('SKM門市', '高雄市', 'department', 22.6700, 120.3050, 200, '', '', 0);
