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
