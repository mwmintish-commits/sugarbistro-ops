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

-- 8. 總部代付費用分類
INSERT INTO expense_categories (name, type, sort_order) VALUES
('總部代付-租金', 'hq_advance', 20),
('總部代付-水電', 'hq_advance', 21),
('總部代付-保險', 'hq_advance', 22),
('總部代付-稅務', 'hq_advance', 23),
('總部代付-其他', 'hq_advance', 24)
ON CONFLICT (name) DO NOTHING;

-- 9. 確保所有表 RLS 關閉
ALTER TABLE shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE work_log_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE stores DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
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
