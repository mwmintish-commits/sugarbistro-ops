-- ============================
-- 小食糖營運系統 - 資料表建立
-- 根據實際 POS 日結單 & 華南銀行存款單欄位設計
-- 在 Supabase SQL Editor 中執行
-- ============================

-- 1. 門市資料表
CREATE TABLE IF NOT EXISTS stores (
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
CREATE TABLE IF NOT EXISTS employees (
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
CREATE TABLE IF NOT EXISTS daily_settlements (
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
CREATE TABLE IF NOT EXISTS deposits (
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
CREATE TABLE IF NOT EXISTS user_states (
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
DROP POLICY IF EXISTS "Public read receipts" ON storage.objects;
CREATE POLICY "Public read receipts" ON storage.objects
  FOR SELECT USING (bucket_id = 'receipts');

-- 允許寫入
DROP POLICY IF EXISTS "Allow upload receipts" ON storage.objects;
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
-- ============================
-- Round 1：員工綁定 + 三級權限
-- 在 Supabase SQL Editor 中執行
-- ============================

-- 修改 employees 表：加入綁定碼和角色欄位
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS bind_code TEXT,
  ADD COLUMN IF NOT EXISTS bind_code_expires TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS managed_store_id UUID REFERENCES stores(id);

-- 確保 role 欄位的值只能是 admin/manager/staff
-- (如果已有資料，先更新)
UPDATE employees SET role = 'staff' WHERE role NOT IN ('admin', 'manager', 'staff');

-- 建立綁定碼唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_bind_code
  ON employees(bind_code) WHERE bind_code IS NOT NULL;

-- ============================
-- 插入預設總部管理員帳號
-- （你之後用 LINE 綁定它）
-- ============================
INSERT INTO employees (name, role, is_active)
VALUES ('總部管理員', 'admin', true)
ON CONFLICT DO NOTHING;

-- 為這個帳號產生綁定碼（有效 7 天）
UPDATE employees
SET bind_code = '888888',
    bind_code_expires = now() + interval '7 days'
WHERE name = '總部管理員' AND role = 'admin';

-- 日結附加單據表
CREATE TABLE IF NOT EXISTS settlement_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  settlement_id UUID REFERENCES daily_settlements(id),
  receipt_type TEXT NOT NULL,
  image_url TEXT,
  serial_numbers JSONB,
  amount NUMERIC DEFAULT 0,
  ai_raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 券別流水號稽核表（防重複使用）
CREATE TABLE IF NOT EXISTS voucher_serials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  serial_number TEXT NOT NULL,
  voucher_type TEXT NOT NULL,
  store_id UUID REFERENCES stores(id),
  settlement_id UUID REFERENCES daily_settlements(id),
  date DATE,
  amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(serial_number, voucher_type)
);

-- 出勤打卡表
CREATE TABLE IF NOT EXISTS attendances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  store_id UUID REFERENCES stores(id),
  type TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_valid BOOLEAN DEFAULT true,
  photo_url TEXT,
  late_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- ============================
-- Round 3：打卡 + 排班系統
-- 台灣勞基法工時標準
-- ============================

-- 1. 班別設定表
CREATE TABLE IF NOT EXISTS shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER DEFAULT 60,
  work_hours NUMERIC DEFAULT 8,
  role TEXT DEFAULT 'all',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 排班表
CREATE TABLE IF NOT EXISTS schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  store_id UUID REFERENCES stores(id),
  shift_id UUID REFERENCES shifts(id),
  date DATE NOT NULL,
  status TEXT DEFAULT 'scheduled',
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- 3. 打卡設定表（總部可調整）
CREATE TABLE IF NOT EXISTS attendance_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  late_grace_minutes INTEGER DEFAULT 5,
  late_threshold_minutes INTEGER DEFAULT 30,
  early_leave_minutes INTEGER DEFAULT 15,
  overtime_min_minutes INTEGER DEFAULT 30,
  overtime_rate_1 NUMERIC DEFAULT 1.34,
  overtime_rate_2 NUMERIC DEFAULT 1.67,
  overtime_tier1_hours INTEGER DEFAULT 2,
  work_hours_per_day NUMERIC DEFAULT 8,
  work_hours_per_week NUMERIC DEFAULT 40,
  break_after_hours NUMERIC DEFAULT 4,
  break_min_minutes INTEGER DEFAULT 30,
  require_photo BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 插入預設打卡設定
INSERT INTO attendance_settings (
  late_grace_minutes, late_threshold_minutes, early_leave_minutes,
  overtime_min_minutes, work_hours_per_day, work_hours_per_week
) VALUES (5, 30, 15, 30, 8, 40)
ON CONFLICT DO NOTHING;

-- 4. 修改 attendances 表增加更多欄位
ALTER TABLE attendances
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES schedules(id),
  ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES shifts(id),
  ADD COLUMN IF NOT EXISTS distance_meters NUMERIC,
  ADD COLUMN IF NOT EXISTS clock_in_token TEXT,
  ADD COLUMN IF NOT EXISTS browser_info TEXT;

-- 5. 打卡 Token 表（防偽造用）
CREATE TABLE IF NOT EXISTS clockin_tokens (
  token TEXT PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  type TEXT NOT NULL,
  store_id UUID,
  shift_id UUID,
  schedule_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. 插入預設班別
INSERT INTO shifts (store_id, name, start_time, end_time, break_minutes, work_hours, role)
SELECT s.id, '一段班', '10:00', '20:00', 60, 9, '外場'
FROM stores s WHERE s.name = '台北門市'
ON CONFLICT DO NOTHING;

INSERT INTO shifts (store_id, name, start_time, end_time, break_minutes, work_hours, role)
SELECT s.id, '一段班', '10:00', '20:00', 60, 9, '內場'
FROM stores s WHERE s.name = '台北門市'
ON CONFLICT DO NOTHING;

INSERT INTO shifts (store_id, name, start_time, end_time, break_minutes, work_hours, role)
SELECT s.id, '一段班', '10:00', '20:00', 60, 9, '外場'
FROM stores s WHERE s.name = '屏東門市'
ON CONFLICT DO NOTHING;

INSERT INTO shifts (store_id, name, start_time, end_time, break_minutes, work_hours, role)
SELECT s.id, '一段班', '10:00', '20:00', 60, 9, '內場'
FROM stores s WHERE s.name = '屏東門市'
ON CONFLICT DO NOTHING;

INSERT INTO shifts (store_id, name, start_time, end_time, break_minutes, work_hours, role)
SELECT s.id, '早班', '10:00', '16:00', 30, 5.5, 'all'
FROM stores s WHERE s.name = '新光左營店'
ON CONFLICT DO NOTHING;

INSERT INTO shifts (store_id, name, start_time, end_time, break_minutes, work_hours, role)
SELECT s.id, '晚班', '15:00', '21:30', 30, 6, 'all'
FROM stores s WHERE s.name = '新光左營店'
ON CONFLICT DO NOTHING;

INSERT INTO shifts (store_id, name, start_time, end_time, break_minutes, work_hours, role)
SELECT s.id, '早班', '10:00', '16:00', 30, 5.5, 'all'
FROM stores s WHERE s.name = 'SKM門市'
ON CONFLICT DO NOTHING;

INSERT INTO shifts (store_id, name, start_time, end_time, break_minutes, work_hours, role)
SELECT s.id, '晚班', '13:00', '21:30', 60, 7.5, 'all'
FROM stores s WHERE s.name = 'SKM門市'
ON CONFLICT DO NOTHING;

-- 關閉新表的 RLS
ALTER TABLE shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE clockin_tokens DISABLE ROW LEVEL SECURITY;
-- ============================
-- 排班增強 + 請假系統
-- ============================

-- 排班表加入類型欄位（班別或休假）
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'shift',
  ADD COLUMN IF NOT EXISTS leave_type TEXT,
  ADD COLUMN IF NOT EXISTS half_day TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT;

-- 預休假申請表
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  half_day TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  reviewed_by UUID REFERENCES employees(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE leave_requests DISABLE ROW LEVEL SECURITY;

-- 員工假別額度表
CREATE TABLE IF NOT EXISTS leave_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  year INTEGER NOT NULL,
  annual_leave NUMERIC DEFAULT 0,
  annual_used NUMERIC DEFAULT 0,
  sick_leave NUMERIC DEFAULT 30,
  sick_used NUMERIC DEFAULT 0,
  personal_leave NUMERIC DEFAULT 14,
  personal_used NUMERIC DEFAULT 0,
  menstrual_leave NUMERIC DEFAULT 12,
  menstrual_used NUMERIC DEFAULT 0,
  UNIQUE(employee_id, year)
);

ALTER TABLE leave_balances DISABLE ROW LEVEL SECURITY;
-- ============================
-- Round 5：後台登入驗證 + 門店主管角色
-- ============================

-- 後台登入 session 表
CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  role TEXT NOT NULL,
  store_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 驗證碼表
CREATE TABLE IF NOT EXISTS verify_codes (
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admin_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE verify_codes DISABLE ROW LEVEL SECURITY;
-- ============================================
-- Phase 2：人資合規 + 財務強化
-- ============================================

-- 1. 假勤餘額表（每年每人每假別）
CREATE TABLE IF NOT EXISTS leave_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  year INTEGER NOT NULL,
  annual_total NUMERIC DEFAULT 0,
  annual_used NUMERIC DEFAULT 0,
  sick_total NUMERIC DEFAULT 30,
  sick_used NUMERIC DEFAULT 0,
  personal_total NUMERIC DEFAULT 14,
  personal_used NUMERIC DEFAULT 0,
  menstrual_total NUMERIC DEFAULT 12,
  menstrual_used NUMERIC DEFAULT 0,
  overtime_comp_total NUMERIC DEFAULT 0,
  overtime_comp_used NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, year)
);
ALTER TABLE leave_balances DISABLE ROW LEVEL SECURITY;

-- 2. 加班紀錄表
CREATE TABLE IF NOT EXISTS overtime_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  store_id UUID REFERENCES stores(id),
  date DATE NOT NULL,
  scheduled_end TIME,
  actual_end TIME,
  overtime_minutes INTEGER DEFAULT 0,
  overtime_type TEXT DEFAULT 'weekday',
  rate NUMERIC DEFAULT 1.34,
  amount NUMERIC DEFAULT 0,
  comp_type TEXT DEFAULT 'pay',
  comp_hours NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  approved_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE overtime_records DISABLE ROW LEVEL SECURITY;

-- 3. 撥款紀錄表
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  reference_id UUID,
  store_id UUID REFERENCES stores(id),
  employee_id UUID REFERENCES employees(id),
  amount NUMERIC NOT NULL,
  recipient TEXT,
  status TEXT DEFAULT 'pending',
  paid_date DATE,
  month_key TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;

-- 4. 員工異動紀錄
CREATE TABLE IF NOT EXISTS employee_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  change_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE employee_changes DISABLE ROW LEVEL SECURITY;

-- 5. 2026 國定假日
CREATE TABLE IF NOT EXISTS national_holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  year INTEGER
);
ALTER TABLE national_holidays DISABLE ROW LEVEL SECURITY;

INSERT INTO national_holidays (date, name, year) VALUES
('2026-01-01', '元旦', 2026),
('2026-01-28', '除夕', 2026),
('2026-01-29', '春節', 2026),
('2026-01-30', '春節', 2026),
('2026-01-31', '春節', 2026),
('2026-02-01', '春節（補假）', 2026),
('2026-02-28', '和平紀念日', 2026),
('2026-04-04', '兒童節', 2026),
('2026-04-05', '清明節', 2026),
('2026-05-01', '勞動節', 2026),
('2026-05-31', '端午節', 2026),
('2026-09-28', '教師節', 2026),
('2026-10-06', '中秋節', 2026),
('2026-10-10', '國慶日', 2026),
('2026-10-25', '光復節', 2026),
('2026-12-25', '行憲紀念日', 2026)
ON CONFLICT (date) DO NOTHING;

-- 6. expenses 加篩選用索引
CREATE INDEX IF NOT EXISTS idx_expenses_month ON expenses(month_key);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_expenses_store ON expenses(store_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);

-- 完成
SELECT '✅ Phase 2 migration 完成' AS result;
-- ============================================
-- Phase 2: P1 全部升級
-- A組：損益 B組：人事 C組：排班 D組：庫存 E組：安全
-- ============================================

-- ✦32 操作日誌
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID,
  actor_name TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ✦29 合約管理
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'permanent';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_end_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_file_url TEXT;

-- ✦19 效期管理（庫存批號）— 延後建立，等 inventory_items 先建

-- ✦16 班表範本
CREATE TABLE IF NOT EXISTS schedule_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  name TEXT NOT NULL,
  template_data JSONB NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ✦17 調班申請
CREATE TABLE IF NOT EXISTS shift_swap_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID REFERENCES employees(id),
  target_id UUID REFERENCES employees(id),
  date DATE NOT NULL,
  requester_schedule_id UUID,
  target_schedule_id UUID,
  status TEXT DEFAULT 'pending',
  approved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ✦33 登入安全
ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS login_fail_count INTEGER DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- RLS 全關
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

SELECT '✅ Phase 2 SQL 完成' AS result;
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

-- 客戶特約價 — 延後建立，等 clients 先建

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

-- (expense_categories 由後段 migration 建立，此處跳過舊版定義)


-- Bug 10a: 費用分類建議欄位
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category_suggestion TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS pnl_group TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS pnl_item TEXT;

-- 薪資表加請假扣款欄位
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS leave_deduction NUMERIC DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS leave_hours NUMERIC DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS leave_detail TEXT;

-- 日結表新增欄位
ALTER TABLE daily_settlements ADD COLUMN IF NOT EXISTS remittance_amount NUMERIC DEFAULT 0;
ALTER TABLE daily_settlements ADD COLUMN IF NOT EXISTS void_invoice_numbers TEXT;
ALTER TABLE daily_settlements ADD COLUMN IF NOT EXISTS void_item_count INTEGER DEFAULT 0;
ALTER TABLE daily_settlements ADD COLUMN IF NOT EXISTS void_item_amount NUMERIC DEFAULT 0;
-- ============================================
-- Phase 3：全合一修正
-- 費用/撥款/門市/離職/國定假日/發票偵測
-- ============================================

-- 1. user_states 加逾時欄位（LINE Bot 5分鐘自動清除用）
ALTER TABLE user_states ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. expenses 擴充欄位
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS submitted_by_name TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category_suggestion TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS invoice_number TEXT;
CREATE INDEX IF NOT EXISTS idx_expenses_invoice ON expenses(invoice_number);
CREATE INDEX IF NOT EXISTS idx_expenses_month ON expenses(month_key);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_expenses_store ON expenses(store_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);

-- 3. 回填現有費用的提交人姓名
UPDATE expenses SET submitted_by_name = e.name
FROM employees e WHERE expenses.submitted_by = e.id AND expenses.submitted_by_name IS NULL;

-- 4. national_holidays 加啟用開關
ALTER TABLE national_holidays ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 5. stores 加 address 欄位
ALTER TABLE stores ADD COLUMN IF NOT EXISTS address TEXT;

-- 6. employees 加離職相關欄位
ALTER TABLE employees ADD COLUMN IF NOT EXISTS resignation_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS resignation_reason TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_working_date DATE;

-- 7. 確保所有表 RLS 關閉
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

SELECT '✅ Phase 3 全合一修正完成' AS result;
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

-- ✦19 效期管理（庫存批號）
CREATE TABLE IF NOT EXISTS inventory_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id),
  batch_number TEXT,
  quantity NUMERIC DEFAULT 0,
  expiry_date DATE,
  received_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_batch_expiry ON inventory_batches(expiry_date);

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

-- 客戶特約價（clients 已建，可建立）
CREATE TABLE IF NOT EXISTS client_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  special_price NUMERIC NOT NULL,
  UNIQUE(client_id, variant_id)
);

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
-- ============================================
-- 小食糖全合一修復 SQL
-- 一次執行即可確保所有欄位和資料正確
-- ============================================

-- 1. shifts 表確保 role 欄位存在
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'all';

-- 2. employees 表確保勞健保分開欄位
ALTER TABLE employees ADD COLUMN IF NOT EXISTS labor_tier INTEGER;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS health_tier INTEGER;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS labor_start_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS health_start_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC;

-- 3. work_log_templates 確保 role 和 shift_type 欄位
ALTER TABLE work_log_templates ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'all';
ALTER TABLE work_log_templates ADD COLUMN IF NOT EXISTS shift_type TEXT DEFAULT 'opening';

-- 4. 修正 work_log_templates shift_type（NULL → 根據分類自動設定）
UPDATE work_log_templates SET shift_type = 'opening' WHERE category = '開店準備' AND (shift_type IS NULL OR shift_type = '');
UPDATE work_log_templates SET shift_type = 'during' WHERE category = '營業中' AND (shift_type IS NULL OR shift_type = '');
UPDATE work_log_templates SET shift_type = 'closing' WHERE category = '打烊作業' AND (shift_type IS NULL OR shift_type = '');
UPDATE work_log_templates SET shift_type = 'during' WHERE category = '清潔消毒' AND (shift_type IS NULL OR shift_type = '');
UPDATE work_log_templates SET shift_type = 'during' WHERE category = '食材管理' AND (shift_type IS NULL OR shift_type = '');
UPDATE work_log_templates SET shift_type = 'opening' WHERE shift_type IS NULL OR shift_type = '';

-- 5. stores 表確保營業目標欄位
ALTER TABLE stores ADD COLUMN IF NOT EXISTS daily_target NUMERIC DEFAULT 0;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS monthly_target NUMERIC DEFAULT 0;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS longitude NUMERIC;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS radius_m INTEGER DEFAULT 200;

-- 6. leave_requests 確保 request_type 欄位
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'leave';

-- 7. system_settings 表
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;

-- (總部代付費用分類移至後段 INSERT 統一處理)

-- 9. 清除重複班別（保留最早建立的）
DELETE FROM shifts a USING shifts b
WHERE a.id > b.id
AND a.store_id = b.store_id
AND a.name = b.name
AND a.role = b.role
AND a.start_time = b.start_time
AND a.end_time = b.end_time
AND a.is_active = true AND b.is_active = true;

-- 10. 確保所有表 RLS 關閉
ALTER TABLE shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE work_log_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE stores DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;
-- expense_categories 可能尚未建立，跳過
-- ALTER TABLE expense_categories DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_settlements DISABLE ROW LEVEL SECURITY;
ALTER TABLE deposits DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendances DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE announcements DISABLE ROW LEVEL SECURITY;
ALTER TABLE work_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_states DISABLE ROW LEVEL SECURITY;
ALTER TABLE verify_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_tiers DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances DISABLE ROW LEVEL SECURITY;
ALTER TABLE annual_leave_rules DISABLE ROW LEVEL SECURITY;

-- 完成
SELECT '✅ 全合一修復完成' AS result;
-- Round 6：新人報到系統

CREATE TABLE IF NOT EXISTS onboarding_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_uid TEXT NOT NULL,
  name TEXT NOT NULL,
  store_id UUID REFERENCES stores(id),
  store_name TEXT,
  token TEXT UNIQUE,
  handbook_read BOOLEAN DEFAULT false,
  signed_at TIMESTAMPTZ,
  signature_name TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE onboarding_records DISABLE ROW LEVEL SECURITY;
-- Round 7：完整人資 + 勞健保 + 薪資

-- 員工擴充欄位
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS birthday DATE,
  ADD COLUMN IF NOT EXISTS id_number TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
  ADD COLUMN IF NOT EXISTS emergency_phone TEXT,
  ADD COLUMN IF NOT EXISTS emergency_relation TEXT,
  ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS hire_date DATE,
  ADD COLUMN IF NOT EXISTS contract_signed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS contract_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS insurance_start_date DATE,
  ADD COLUMN IF NOT EXISTS insurance_tier INTEGER,
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC,
  ADD COLUMN IF NOT EXISTS onboarding_id UUID;

-- 報到資料擴充
ALTER TABLE onboarding_records
  ADD COLUMN IF NOT EXISTS birthday DATE,
  ADD COLUMN IF NOT EXISTS id_number TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
  ADD COLUMN IF NOT EXISTS emergency_phone TEXT,
  ADD COLUMN IF NOT EXISTS emergency_relation TEXT,
  ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS auto_employee_id UUID;

-- 勞健保級距表（2026年餐飲業適用）
CREATE TABLE IF NOT EXISTS insurance_tiers (
  id SERIAL PRIMARY KEY,
  tier_level INTEGER NOT NULL,
  salary_min NUMERIC NOT NULL,
  salary_max NUMERIC NOT NULL,
  insured_salary NUMERIC NOT NULL,
  labor_self NUMERIC NOT NULL,
  labor_employer NUMERIC NOT NULL,
  health_self NUMERIC NOT NULL,
  health_employer NUMERIC NOT NULL,
  employment_type TEXT DEFAULT 'regular',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE insurance_tiers DISABLE ROW LEVEL SECURITY;

-- 插入常用投保級距（2026年預估，實際以政府公告為準）
-- 一般人員
INSERT INTO insurance_tiers (tier_level, salary_min, salary_max, insured_salary, labor_self, labor_employer, health_self, health_employer, employment_type) VALUES
(1, 27470, 27470, 27470, 690, 2414, 438, 1224, 'regular'),
(2, 27471, 28800, 28800, 723, 2531, 459, 1283, 'regular'),
(3, 28801, 30300, 30300, 761, 2663, 483, 1350, 'regular'),
(4, 30301, 31800, 31800, 799, 2795, 507, 1417, 'regular'),
(5, 31801, 33300, 33300, 836, 2927, 531, 1484, 'regular'),
(6, 33301, 34800, 34800, 874, 3059, 555, 1551, 'regular'),
(7, 34801, 36300, 36300, 912, 3191, 579, 1619, 'regular'),
(8, 36301, 38200, 38200, 959, 3358, 609, 1704, 'regular'),
(9, 38201, 40100, 40100, 1007, 3525, 640, 1789, 'regular'),
(10, 40101, 42000, 42000, 1055, 3692, 670, 1874, 'regular'),
(11, 42001, 43900, 43900, 1103, 3859, 700, 1959, 'regular'),
(12, 43901, 45800, 45800, 1150, 4026, 730, 2044, 'regular');

-- 兼職人員（部分工時）
INSERT INTO insurance_tiers (tier_level, salary_min, salary_max, insured_salary, labor_self, labor_employer, health_self, health_employer, employment_type) VALUES
(1, 0, 11100, 11100, 279, 976, 177, 495, 'parttime'),
(2, 11101, 12540, 12540, 315, 1102, 200, 559, 'parttime'),
(3, 12541, 13500, 13500, 339, 1187, 215, 602, 'parttime'),
(4, 13501, 15840, 15840, 398, 1392, 253, 707, 'parttime'),
(5, 15841, 16500, 16500, 414, 1451, 263, 736, 'parttime'),
(6, 16501, 17280, 17280, 434, 1519, 276, 771, 'parttime'),
(7, 17281, 17880, 17880, 449, 1572, 285, 798, 'parttime'),
(8, 17881, 19047, 19047, 478, 1674, 304, 850, 'parttime'),
(9, 19048, 20008, 20008, 503, 1759, 319, 893, 'parttime'),
(10, 20009, 21009, 21009, 528, 1847, 335, 937, 'parttime'),
(11, 21010, 22000, 22000, 553, 1934, 351, 981, 'parttime'),
(12, 22001, 23100, 23100, 580, 2030, 368, 1031, 'parttime');

-- 薪資單表
CREATE TABLE IF NOT EXISTS payroll (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  work_days NUMERIC DEFAULT 0,
  work_hours NUMERIC DEFAULT 0,
  overtime_hours NUMERIC DEFAULT 0,
  base_salary NUMERIC DEFAULT 0,
  overtime_pay NUMERIC DEFAULT 0,
  bonus NUMERIC DEFAULT 0,
  labor_insurance_self NUMERIC DEFAULT 0,
  health_insurance_self NUMERIC DEFAULT 0,
  other_deductions NUMERIC DEFAULT 0,
  net_salary NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, year, month)
);

ALTER TABLE payroll DISABLE ROW LEVEL SECURITY;

-- 年假額度計算參考表（台灣勞基法）
-- regular: 一般人員
-- parttime: 兼職人員（依比例計算）
CREATE TABLE IF NOT EXISTS annual_leave_rules (
  id SERIAL PRIMARY KEY,
  min_months INTEGER NOT NULL,
  max_months INTEGER,
  leave_days NUMERIC NOT NULL,
  employment_type TEXT DEFAULT 'regular',
  description TEXT
);

ALTER TABLE annual_leave_rules DISABLE ROW LEVEL SECURITY;

INSERT INTO annual_leave_rules (min_months, max_months, leave_days, employment_type, description) VALUES
(6, 12, 3, 'regular', '滿6個月未滿1年：3天'),
(12, 24, 7, 'regular', '滿1年未滿2年：7天'),
(24, 36, 10, 'regular', '滿2年未滿3年：10天'),
(36, 60, 14, 'regular', '滿3年未滿5年：14天'),
(60, 120, 15, 'regular', '滿5年未滿10年：15天'),
(120, NULL, 15, 'regular', '滿10年以上：每年加1天，最多30天'),
(6, 12, 1.5, 'parttime', '兼職滿6個月未滿1年：1.5天（比例）'),
(12, 24, 3.5, 'parttime', '兼職滿1年未滿2年：3.5天'),
(24, 36, 5, 'parttime', '兼職滿2年未滿3年：5天'),
(36, 60, 7, 'parttime', '兼職滿3年未滿5年：7天'),
(60, 120, 7.5, 'parttime', '兼職滿5年未滿10年：7.5天'),
(120, NULL, 7.5, 'parttime', '兼職滿10年以上：比例加算');
-- Round 8：工作日誌 + 公布欄 + 費用系統 + 損益表

-- 工作日誌模板（每店的每日工作項目清單）
CREATE TABLE IF NOT EXISTS work_log_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  category TEXT NOT NULL,
  item TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 工作日誌紀錄
CREATE TABLE IF NOT EXISTS work_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  store_id UUID REFERENCES stores(id),
  date DATE NOT NULL,
  items JSONB DEFAULT '[]',
  notes TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- 公布欄
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  store_id UUID,
  priority TEXT DEFAULT 'normal',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES employees(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 支出分類（確保用最新 schema）
DROP TABLE IF EXISTS expense_categories CASCADE;
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- 支出紀錄（月結廠商+零用金共用）
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  category_id UUID REFERENCES expense_categories(id),
  expense_type TEXT NOT NULL,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  vendor_name TEXT,
  description TEXT,
  image_url TEXT,
  ai_raw_data JSONB,
  submitted_by UUID REFERENCES employees(id),
  status TEXT DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  month_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE work_log_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE work_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE announcements DISABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;

-- 插入預設支出分類
INSERT INTO expense_categories (name, type, sort_order) VALUES
('食材原料', 'vendor', 1),
('包材耗材', 'vendor', 2),
('飲料原料', 'vendor', 3),
('清潔用品', 'vendor', 4),
('設備維修', 'vendor', 5),
('外送平台費', 'vendor', 6),
('其他廠商', 'vendor', 7),
('文具雜物', 'petty_cash', 10),
('交通費', 'petty_cash', 11),
('臨時採購', 'petty_cash', 12),
('維修零件', 'petty_cash', 13),
('其他零用', 'petty_cash', 14),
('總部代付-租金', 'hq_advance', 20),
('總部代付-水電', 'hq_advance', 21),
('總部代付-保險', 'hq_advance', 22),
('總部代付-稅務', 'hq_advance', 23),
('總部代付-其他', 'hq_advance', 24)
ON CONFLICT (name) DO NOTHING;

-- 插入預設工作日誌項目
INSERT INTO work_log_templates (store_id, category, item, sort_order) 
SELECT s.id, '開店準備', '確認冷藏冷凍溫度', 1 FROM stores s WHERE s.name LIKE '%台北%'
UNION ALL SELECT s.id, '開店準備', '清潔工作檯面', 2 FROM stores s WHERE s.name LIKE '%台北%'
UNION ALL SELECT s.id, '開店準備', '備料確認', 3 FROM stores s WHERE s.name LIKE '%台北%'
UNION ALL SELECT s.id, '開店準備', '收銀機開機確認', 4 FROM stores s WHERE s.name LIKE '%台北%'
UNION ALL SELECT s.id, '營業中', '隨時保持環境整潔', 10 FROM stores s WHERE s.name LIKE '%台北%'
UNION ALL SELECT s.id, '營業中', '食材效期檢查', 11 FROM stores s WHERE s.name LIKE '%台北%'
UNION ALL SELECT s.id, '營業中', '客人服務品質確認', 12 FROM stores s WHERE s.name LIKE '%台北%'
UNION ALL SELECT s.id, '打烊作業', '清潔所有設備', 20 FROM stores s WHERE s.name LIKE '%台北%'
UNION ALL SELECT s.id, '打烊作業', '垃圾清運', 21 FROM stores s WHERE s.name LIKE '%台北%'
UNION ALL SELECT s.id, '打烊作業', '鎖門確認', 22 FROM stores s WHERE s.name LIKE '%台北%'
ON CONFLICT DO NOTHING;
-- Round 9 修正

-- 確保 stores 有 GPS（如尚未設定）
ALTER TABLE stores ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS radius_m INTEGER DEFAULT 200;

-- 工作日誌模板加入角色欄位
ALTER TABLE work_log_templates ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'all';
ALTER TABLE work_log_templates ADD COLUMN IF NOT EXISTS shift_type TEXT DEFAULT 'opening';
-- Round 10：勞保健保分開 + 工作日誌後台

ALTER TABLE employees ADD COLUMN IF NOT EXISTS labor_tier INTEGER;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS health_tier INTEGER;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS labor_start_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS health_start_date DATE;
-- Round 11：修正工作日誌時段

-- 把現有 NULL 的 shift_type 根據分類自動設定
UPDATE work_log_templates SET shift_type = 'opening' WHERE category = '開店準備' AND (shift_type IS NULL OR shift_type = '');
UPDATE work_log_templates SET shift_type = 'during' WHERE category = '營業中' AND (shift_type IS NULL OR shift_type = '');
UPDATE work_log_templates SET shift_type = 'closing' WHERE category = '打烊作業' AND (shift_type IS NULL OR shift_type = '');
UPDATE work_log_templates SET shift_type = 'during' WHERE category = '清潔消毒' AND (shift_type IS NULL OR shift_type = '');
UPDATE work_log_templates SET shift_type = 'during' WHERE category = '食材管理' AND (shift_type IS NULL OR shift_type = '');
-- 其餘未匹配的都設為 opening
UPDATE work_log_templates SET shift_type = 'opening' WHERE shift_type IS NULL OR shift_type = '';

-- 設定預設值避免未來新增也是 NULL
ALTER TABLE work_log_templates ALTER COLUMN shift_type SET DEFAULT 'opening';
-- Round 12：總部代付 + 薪資

-- (總部代付分類已合併至前段 INSERT)
-- Round 13：系統設定表（存員工守則等）

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;
-- Round 14：預排休假

-- 確保 leave_requests 有 request_type 欄位
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'leave';
-- leave = 正式請假, pre_arranged = 預排休假
-- Round 15：營業額目標

ALTER TABLE stores ADD COLUMN IF NOT EXISTS daily_target NUMERIC DEFAULT 0;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS monthly_target NUMERIC DEFAULT 0;
-- ============================================
-- P0 打卡系統完整升級
-- ✦03排班檢核 ✦04加班申請 ✦05加班補休
-- ✦12出勤月報 ✦13漏打卡 ✦14異常通知
-- ============================================

-- ===== ✦05 加班補休欄位 =====
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS comp_type TEXT DEFAULT 'pending';
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS comp_hours NUMERIC DEFAULT 0;
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS comp_expiry_date DATE;
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS comp_used BOOLEAN DEFAULT false;
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS comp_converted BOOLEAN DEFAULT false;
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- ===== ✦04 加班申請表 =====
CREATE TABLE IF NOT EXISTS overtime_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  store_id UUID REFERENCES stores(id),
  date DATE NOT NULL,
  planned_minutes INTEGER NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending',  -- pending/approved/rejected
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE overtime_applications DISABLE ROW LEVEL SECURITY;

-- ===== ✦13 漏打卡補登 =====
CREATE TABLE IF NOT EXISTS clock_amendments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  store_id UUID REFERENCES stores(id),
  date DATE NOT NULL,
  type TEXT NOT NULL,              -- clock_in / clock_out
  amended_time TIME NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending/approved/rejected
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE clock_amendments DISABLE ROW LEVEL SECURITY;

-- ===== ✦14 異常通知紀錄 =====
CREATE TABLE IF NOT EXISTS attendance_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  store_id UUID REFERENCES stores(id),
  date DATE NOT NULL,
  alert_type TEXT NOT NULL,       -- no_clockin / late_3times / overtime_46hr
  message TEXT,
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE attendance_alerts DISABLE ROW LEVEL SECURITY;

-- ===== ✦12 出勤月報（月結時產生快照） =====
CREATE TABLE IF NOT EXISTS attendance_monthly_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  store_id UUID REFERENCES stores(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  work_days INTEGER DEFAULT 0,
  late_count INTEGER DEFAULT 0,
  late_total_minutes INTEGER DEFAULT 0,
  early_leave_count INTEGER DEFAULT 0,
  absent_days INTEGER DEFAULT 0,
  leave_days NUMERIC DEFAULT 0,
  overtime_hours NUMERIC DEFAULT 0,
  overtime_comp_hours NUMERIC DEFAULT 0,
  overtime_pay_amount NUMERIC DEFAULT 0,
  amendment_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, year, month)
);
ALTER TABLE attendance_monthly_reports DISABLE ROW LEVEL SECURITY;

-- ===== 索引 =====
CREATE INDEX IF NOT EXISTS idx_ot_employee ON overtime_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_ot_comp_type ON overtime_records(comp_type);
CREATE INDEX IF NOT EXISTS idx_ot_status ON overtime_records(status);
CREATE INDEX IF NOT EXISTS idx_ot_expiry ON overtime_records(comp_expiry_date);
CREATE INDEX IF NOT EXISTS idx_ot_app_emp ON overtime_applications(employee_id);
CREATE INDEX IF NOT EXISTS idx_ot_app_date ON overtime_applications(date);
CREATE INDEX IF NOT EXISTS idx_amend_emp ON clock_amendments(employee_id);
CREATE INDEX IF NOT EXISTS idx_alert_date ON attendance_alerts(date);
CREATE INDEX IF NOT EXISTS idx_att_report ON attendance_monthly_reports(employee_id, year, month);

-- ===== RLS 全關 =====
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

SELECT '✅ P0 打卡系統升級 SQL 完成' AS result;

-- ============================================
-- P0 其餘項目
-- ✦01試用期 ✦02假別 ✦06薪資單 ✦09審批 ✦10預算 ✦11差異
-- ============================================

-- ✦01 試用期
ALTER TABLE employees ADD COLUMN IF NOT EXISTS probation_end_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS probation_status TEXT DEFAULT 'in_probation';
  -- in_probation / passed / failed

-- ✦02 假別補齊（leave_requests 已有 leave_type TEXT，只需擴充選項，無需改表）

-- ✦06 薪資單歷史
CREATE TABLE IF NOT EXISTS payroll_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  store_id UUID REFERENCES stores(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  base_salary NUMERIC DEFAULT 0,
  work_days INTEGER DEFAULT 0,
  hourly_rate NUMERIC DEFAULT 0,
  overtime_pay NUMERIC DEFAULT 0,
  comp_hours NUMERIC DEFAULT 0,
  labor_self NUMERIC DEFAULT 0,
  health_self NUMERIC DEFAULT 0,
  tax_withhold NUMERIC DEFAULT 0,
  supplementary_health NUMERIC DEFAULT 0,
  deductions NUMERIC DEFAULT 0,
  net_salary NUMERIC DEFAULT 0,
  notes TEXT,
  sent_via_line BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, year, month)
);
ALTER TABLE payroll_records DISABLE ROW LEVEL SECURITY;

-- ✦10 費用預算
ALTER TABLE stores ADD COLUMN IF NOT EXISTS monthly_expense_budget NUMERIC DEFAULT 0;

-- ✦11 現金差異追蹤
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS difference_explanation TEXT;

-- 索引
CREATE INDEX IF NOT EXISTS idx_payroll_emp ON payroll_records(employee_id, year, month);

-- RLS
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

SELECT '✅ P0 全部升級完成' AS result;
-- ============================================
-- P1 全部五組升級 SQL
-- A:總覽損益 B:人事 C:排班 D:庫存訂單 E:安全
-- ============================================

-- ===== B組 ✦29 合約管理 =====
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'permanent';
  -- permanent=不定期, fixed=定期
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_end_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_file_url TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_phone TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS education TEXT;

-- ===== C組 ✦16 班表範本 =====
CREATE TABLE IF NOT EXISTS schedule_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  store_id UUID REFERENCES stores(id),
  template_data JSONB NOT NULL DEFAULT '[]',
  -- [{employee_id, day_of_week(0-6), shift_id, type:"shift"|"leave", leave_type}]
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE schedule_templates DISABLE ROW LEVEL SECURITY;

-- ===== C組 ✦17 調班申請 =====
CREATE TABLE IF NOT EXISTS swap_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID REFERENCES employees(id),
  target_id UUID REFERENCES employees(id),
  requester_schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  target_schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  date_a DATE NOT NULL,
  date_b DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  -- pending → target_accepted → manager_approved / rejected
  target_accepted BOOLEAN DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE swap_requests DISABLE ROW LEVEL SECURITY;

-- ===== D組 ✦19 效期管理 =====
-- inventory 表已改名為 inventory_items，跳過舊名 ALTER
-- ALTER TABLE inventory ADD COLUMN IF NOT EXISTS expiry_date DATE;
-- ALTER TABLE inventory ADD COLUMN IF NOT EXISTS batch_number TEXT;
-- ALTER TABLE inventory ADD COLUMN IF NOT EXISTS expiry_alert_days INTEGER DEFAULT 3;

-- ===== E組 ✦32 操作日誌 =====
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  user_name TEXT,
  action TEXT NOT NULL,
  target_type TEXT,      -- employee, schedule, expense, payroll, etc.
  target_id TEXT,
  details JSONB,         -- {before:{}, after:{}}
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_logs(target_type);

-- ===== E組 ✦33 登入安全 =====
ALTER TABLE employees ADD COLUMN IF NOT EXISTS login_fail_count INTEGER DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS login_locked_until TIMESTAMPTZ;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- ===== B組 ✦30 提醒系統 =====
CREATE TABLE IF NOT EXISTS system_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  -- probation_expiry, contract_expiry, birthday, anniversary,
  -- leave_unused, overtime_limit, stock_low, budget_over, schedule_unpublished, comp_expiring
  target_id UUID,
  target_name TEXT,
  message TEXT NOT NULL,
  due_date DATE,
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE system_reminders DISABLE ROW LEVEL SECURITY;

-- ===== 索引 =====
CREATE INDEX IF NOT EXISTS idx_sched_tpl_store ON schedule_templates(store_id);
CREATE INDEX IF NOT EXISTS idx_swap_status ON swap_requests(status);
-- CREATE INDEX IF NOT EXISTS idx_inv_expiry ON inventory(expiry_date); -- 舊表名，跳過
CREATE INDEX IF NOT EXISTS idx_reminders_due ON system_reminders(due_date);

-- ===== RLS 全關 =====
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

SELECT '✅ P1 全部 SQL 完成' AS result;
-- 協作式工作日誌

CREATE TABLE IF NOT EXISTS work_log_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id) NOT NULL,
  date DATE NOT NULL,
  template_id UUID REFERENCES work_log_templates(id),
  item_name TEXT NOT NULL,
  category TEXT,
  shift_type TEXT DEFAULT 'opening',
  completed BOOLEAN DEFAULT false,
  completed_by UUID REFERENCES employees(id),
  completed_by_name TEXT,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wli_store_date ON work_log_items(store_id, date);
ALTER TABLE work_log_items DISABLE ROW LEVEL SECURITY;
-- ============================================
-- 工作日誌全面升級
-- ============================================

-- 1. work_log_templates 擴充
ALTER TABLE work_log_templates ADD COLUMN IF NOT EXISTS frequency TEXT DEFAULT 'daily';
ALTER TABLE work_log_templates ADD COLUMN IF NOT EXISTS weekday INTEGER;
ALTER TABLE work_log_templates ADD COLUMN IF NOT EXISTS month_day INTEGER;
ALTER TABLE work_log_templates ADD COLUMN IF NOT EXISTS requires_value BOOLEAN DEFAULT false;
ALTER TABLE work_log_templates ADD COLUMN IF NOT EXISTS value_label TEXT;
ALTER TABLE work_log_templates ADD COLUMN IF NOT EXISTS value_min NUMERIC;
ALTER TABLE work_log_templates ADD COLUMN IF NOT EXISTS value_max NUMERIC;

-- 2. work_log_items 擴充
ALTER TABLE work_log_items ADD COLUMN IF NOT EXISTS value NUMERIC;
ALTER TABLE work_log_items ADD COLUMN IF NOT EXISTS is_abnormal BOOLEAN DEFAULT false;
ALTER TABLE work_log_items ADD COLUMN IF NOT EXISTS frequency TEXT DEFAULT 'daily';

-- 3. 異常回報表
CREATE TABLE IF NOT EXISTS incident_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  employee_id UUID REFERENCES employees(id),
  employee_name TEXT,
  type TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  status TEXT DEFAULT 'open',
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE incident_reports DISABLE ROW LEVEL SECURITY;

-- 4. 系統設定：門店主管日誌權限
INSERT INTO system_settings (key, value) VALUES ('worklog_manager_edit', 'true') ON CONFLICT (key) DO NOTHING;

-- 5. 更新現有模板的 frequency
UPDATE work_log_templates SET frequency = 'daily' WHERE frequency IS NULL;

SELECT '✅ 工作日誌升級完成' AS result;
-- ============================================
-- 加班補休系統升級
-- 加班時數 → 員工休假表 → 可換補休或轉薪資
-- ============================================

-- 1. overtime_records 補齊補休欄位
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS comp_type TEXT DEFAULT 'pending';
  -- pending=待選擇, pay=轉加班費, comp=轉補休
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS comp_hours NUMERIC DEFAULT 0;
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS comp_expiry_date DATE;
  -- 補休到期日（勞基法：加班日起6個月內）
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS comp_used BOOLEAN DEFAULT false;
  -- 補休是否已使用
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS comp_converted BOOLEAN DEFAULT false;
  -- 過期未休是否已轉回加班費

-- 2. 確保 status 欄位存在
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- 3. 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_ot_employee ON overtime_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_ot_comp ON overtime_records(comp_type);
CREATE INDEX IF NOT EXISTS idx_ot_status ON overtime_records(status);
CREATE INDEX IF NOT EXISTS idx_ot_expiry ON overtime_records(comp_expiry_date);

-- 4. 全表 RLS 關閉
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

SELECT '✅ 加班補休系統升級完成' AS result;
-- 修正：總部代墊／費用撥款重複請款
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上執行

-- 1) 清除既有重複（同一 reference_id 保留最早建立的那筆）
WITH ranked AS (
  SELECT id, reference_id,
         ROW_NUMBER() OVER (PARTITION BY reference_id ORDER BY created_at ASC) AS rn
  FROM payments
  WHERE reference_id IS NOT NULL
)
DELETE FROM payments
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) 建立 partial unique index，從資料庫層防止未來再發生
CREATE UNIQUE INDEX IF NOT EXISTS payments_reference_id_unique
  ON payments(reference_id)
  WHERE reference_id IS NOT NULL;
-- 出勤新增早退分鐘欄位
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS early_leave_minutes INTEGER DEFAULT 0;
-- 預設早退門檻改為 5 分鐘（原為 15）
UPDATE attendance_settings SET early_leave_minutes = 5 WHERE early_leave_minutes IS NULL OR early_leave_minutes = 15;
-- 排班/出勤加入「當日類型」分類，符合勞基法區分例假/休息日/國定假日

-- 1) schedules 加 day_type
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS day_type TEXT DEFAULT 'work'
  CHECK (day_type IN ('work', 'rest_day', 'regular_off', 'national_holiday', 'paid_leave'));

-- 休息日加班同意狀態：null=尚未推送 / pending=已推送等待回覆 / agreed=同意 / declined=拒絕
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS rest_consent TEXT
  CHECK (rest_consent IN ('pending', 'agreed', 'declined'));

-- 同意/拒絕時間
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS rest_consent_at TIMESTAMPTZ;

-- 把舊資料 is_rest_day=true 自動轉為 day_type='rest_day'
UPDATE schedules SET day_type = 'rest_day' WHERE is_rest_day = true AND day_type = 'work';

-- 2) attendances 加 work_type（打卡當下記錄是哪一類日子）
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS work_type TEXT DEFAULT 'work'
  CHECK (work_type IN ('work', 'rest_day', 'regular_off', 'national_holiday'));

-- 3) 索引：方便查詢
CREATE INDEX IF NOT EXISTS idx_schedules_day_type ON schedules(day_type);
CREATE INDEX IF NOT EXISTS idx_attendances_work_type ON attendances(work_type);
