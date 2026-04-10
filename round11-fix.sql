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
