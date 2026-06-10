-- 薪資結算：遲到/早退扣款、兼職 paid_leave 給薪相關欄位
-- lib/payroll-calc.js 會計算這些值並 upsert，但歷史 schema 沒這幾個欄位
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS early_leave_minutes INTEGER DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS late_deduction NUMERIC DEFAULT 0;
-- 兼職有薪假給薪（特休、國定補假等）
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS paid_leave_pay NUMERIC DEFAULT 0;

NOTIFY pgrst, 'reload schema';
