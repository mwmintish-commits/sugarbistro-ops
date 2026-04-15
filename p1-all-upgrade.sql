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
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS expiry_alert_days INTEGER DEFAULT 3;

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
CREATE INDEX IF NOT EXISTS idx_inv_expiry ON inventory(expiry_date);
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
