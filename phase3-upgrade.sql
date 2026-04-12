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
