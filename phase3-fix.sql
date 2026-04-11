-- Phase 3 修正：費用撥款串接 + 門市管理 + 國定假日開關

-- 1. user_states 加逾時欄位
ALTER TABLE user_states ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. expenses 確保有 submitted_by_name
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS submitted_by_name TEXT;

-- 3. national_holidays 加啟用開關
ALTER TABLE national_holidays ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 4. stores 加 address 欄位
ALTER TABLE stores ADD COLUMN IF NOT EXISTS address TEXT;

-- 5. employees 加離職相關欄位
ALTER TABLE employees ADD COLUMN IF NOT EXISTS resignation_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS resignation_reason TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_working_date DATE;

-- 6. 更新 expenses 的 submitted_by_name（回填現有資料）
UPDATE expenses SET submitted_by_name = e.name
FROM employees e WHERE expenses.submitted_by = e.id AND expenses.submitted_by_name IS NULL;

SELECT '✅ Phase 3 修正完成' AS result;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category_suggestion TEXT;
-- Update existing
