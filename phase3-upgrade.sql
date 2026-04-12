-- ============================================
-- Phase 3: 報到+考核+獎金+違規+文件+提醒
-- ============================================

-- 員工文件上傳
CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  file_url TEXT,
  signed_at TIMESTAMPTZ,
  signature_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 違規紀錄
CREATE TABLE IF NOT EXISTS violations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  store_id UUID REFERENCES stores(id),
  level TEXT NOT NULL,
  category TEXT,
  description TEXT,
  action_taken TEXT,
  reported_by UUID,
  quarter_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 季考核
CREATE TABLE IF NOT EXISTS performance_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  store_id UUID REFERENCES stores(id),
  year INTEGER NOT NULL,
  quarter INTEGER NOT NULL,
  attendance_score INTEGER DEFAULT 30,
  attendance_detail JSONB,
  performance_score INTEGER DEFAULT 30,
  performance_auto INTEGER,
  performance_adjust INTEGER DEFAULT 0,
  service_score INTEGER DEFAULT 20,
  service_auto INTEGER,
  service_adjust INTEGER DEFAULT 0,
  violation_score INTEGER DEFAULT 20,
  violation_detail JSONB,
  total_score INTEGER,
  bonus_coefficient NUMERIC DEFAULT 1.0,
  reviewer_id UUID,
  status TEXT DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, year, quarter)
);

-- 獎金發放
CREATE TABLE IF NOT EXISTS bonus_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  store_id UUID REFERENCES stores(id),
  year INTEGER NOT NULL,
  quarter INTEGER NOT NULL,
  weighted_hours NUMERIC DEFAULT 0,
  review_coefficient NUMERIC DEFAULT 1.0,
  share_ratio NUMERIC DEFAULT 0,
  gross_amount NUMERIC DEFAULT 0,
  excluded BOOLEAN DEFAULT false,
  exclude_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, year, quarter)
);

-- 季獎金池（總部填入）
CREATE TABLE IF NOT EXISTS bonus_pools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  year INTEGER NOT NULL,
  quarter INTEGER NOT NULL,
  total_amount NUMERIC DEFAULT 0,
  pnl_status TEXT DEFAULT 'pending',
  pnl_net NUMERIC,
  status TEXT DEFAULT 'draft',
  pay_date DATE,
  confirmed_by UUID,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, year, quarter)
);

-- 員工報到必填欄位
ALTER TABLE employees ADD COLUMN IF NOT EXISTS id_number TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_phone TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_signed BOOLEAN DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS handbook_signed BOOLEAN DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bonus_policy_signed BOOLEAN DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;

-- 提醒表（如果不存在）
CREATE TABLE IF NOT EXISTS system_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT,
  target_id UUID,
  target_name TEXT,
  message TEXT,
  due_date DATE,
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 調班申請表（如果不存在）
CREATE TABLE IF NOT EXISTS swap_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID REFERENCES employees(id),
  target_id UUID REFERENCES employees(id),
  date_a DATE,
  date_b DATE,
  status TEXT DEFAULT 'pending',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 全關
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

SELECT '✅ Phase 3 SQL 完成' AS result;

-- ============================================
-- SaaS 預備
-- ============================================

-- M1 門市模組開關
CREATE TABLE IF NOT EXISTS store_modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  module_key TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  UNIQUE(store_id, module_key)
);

-- M2 方案限制
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS value_type TEXT DEFAULT 'json';
-- 方案設定存在 system_settings: key="plan", value={"name":"standard","max_stores":3,"max_employees":15}

-- M3 白牌
-- 品牌設定存在 system_settings: key="branding", value={"company_name":"小食糖","logo_url":"","theme_color":"#0a7c42"}

-- RLS 全關
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- 薪資其他加扣項
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS allowance NUMERIC DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS allowance_note TEXT;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS other_deduction NUMERIC DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS deduction_note TEXT;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS bonus_note TEXT;

-- 員工休假總表擴充
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS sick_total INTEGER DEFAULT 30;
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS personal_total INTEGER DEFAULT 14;
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS modified_by UUID;
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ;

-- ============================================
-- 產品+規格+價格
-- ============================================

-- 產品主檔
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 產品規格（SKU）
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  spec_name TEXT NOT NULL,
  sku TEXT,
  unit TEXT DEFAULT '個',
  retail_price NUMERIC DEFAULT 0,
  wholesale_price NUMERIC DEFAULT 0,
  oem_price NUMERIC DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  recipe_id UUID,
  inventory_item_id UUID,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(product_id, spec_name)
);

-- 客戶特約價
CREATE TABLE IF NOT EXISTS client_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  special_price NUMERIC NOT NULL,
  UNIQUE(client_id, variant_id)
);

-- 訂單品項加 variant_id
ALTER TABLE client_order_items ADD COLUMN IF NOT EXISTS variant_id UUID;

-- RLS
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- 產品加經銷價
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS dealer_price NUMERIC DEFAULT 0;

-- 訂單含稅欄位
ALTER TABLE client_orders ADD COLUMN IF NOT EXISTS tax_type TEXT DEFAULT 'included';
ALTER TABLE client_orders ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 5;
ALTER TABLE client_orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0;
ALTER TABLE client_orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;

-- 員工薪資加扣項預設（每月自動帶入）
ALTER TABLE employees ADD COLUMN IF NOT EXISTS default_allowance NUMERIC DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS default_allowance_note TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS default_deduction NUMERIC DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS default_deduction_note TEXT;

-- RLS
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Bug 3: leave_balances 欄位名統一（round4用annual_leave, phase2用annual_total）
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS annual_total NUMERIC DEFAULT 0;
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS sick_total NUMERIC DEFAULT 30;
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS personal_total NUMERIC DEFAULT 14;
-- 如果舊欄位有資料，複製到新欄位
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leave_balances' AND column_name='annual_leave') THEN
    UPDATE leave_balances SET annual_total = annual_leave WHERE annual_total = 0 AND annual_leave > 0;
  END IF;
END $$;

-- Bug 10a: 費用分類對照表（重建）
DROP TABLE IF EXISTS expense_categories;
CREATE TABLE expense_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keywords TEXT DEFAULT '',
  category_name TEXT NOT NULL,
  pnl_group TEXT DEFAULT '營業費用',
  pnl_item TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);
ALTER TABLE expense_categories DISABLE ROW LEVEL SECURITY;

-- 預設分類（keywords 用逗號分隔）
INSERT INTO expense_categories (keywords, category_name, pnl_group, pnl_item, sort_order) VALUES
  ('加油,油料,汽油,柴油', '車資', '營業費用', '交通費', 1),
  ('台電,電費,水費,台水', '水電費', '營業費用', '水電瓦斯', 2),
  ('瓦斯,桶裝,天然氣', '瓦斯費', '營業費用', '水電瓦斯', 3),
  ('食材,菜,肉,蛋,奶,魚,蝦,豬,牛,雞,蔬果', '食材', '營業成本', '原物料', 4),
  ('紙袋,紙盒,包材,塑膠袋,封口', '包材', '營業成本', '包裝材料', 5),
  ('清潔,洗碗,消毒,抹布,垃圾袋', '清潔用品', '營業費用', '消耗品', 6),
  ('維修,修繕,修理,更換零件', '修繕費', '營業費用', '修繕維護', 7),
  ('電話,網路,月租', '通訊費', '營業費用', '通訊費', 8),
  ('房租,租金', '租金', '營業費用', '租金', 9),
  ('保險,勞保,健保', '保險費', '營業費用', '保險費', 10);


-- Bug 10a: 費用分類建議欄位
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category_suggestion TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS pnl_group TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS pnl_item TEXT;

-- 薪資表加請假扣款欄位
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS leave_deduction NUMERIC DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS leave_hours NUMERIC DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS leave_detail TEXT;
