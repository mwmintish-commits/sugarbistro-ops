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
