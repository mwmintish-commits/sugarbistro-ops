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
