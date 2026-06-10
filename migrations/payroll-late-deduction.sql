-- 薪資結算：遲到/早退扣款相關欄位
-- lib/payroll-calc.js 會計算這些值並 upsert，但歷史 schema 沒這幾個欄位
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS early_leave_minutes INTEGER DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS late_deduction NUMERIC DEFAULT 0;

NOTIFY pgrst, 'reload schema';
