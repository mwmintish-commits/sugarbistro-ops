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
