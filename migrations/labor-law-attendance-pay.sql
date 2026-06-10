-- 補上勞基法 39 條（特休出勤）與 40 條（例假日緊急出勤）的薪資欄位
-- 對照勞動部「月薪制加班費試算系統」公式

-- 特休出勤加給（勞基法 39 條：休假日工作，工資加倍）
-- 月薪：+1 天日薪 (monthly/30)
-- 兼職：時薪 × 時數 × 2
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS annual_leave_attendance_pay NUMERIC DEFAULT 0;

-- 例假日緊急出勤加給（勞基法 40 條：例假因天災事變停止假期，工資加倍 + 補休一日）
-- 月薪：+1 天日薪
-- 兼職：時薪 × 時數 × 2
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS regular_off_attendance_pay NUMERIC DEFAULT 0;

NOTIFY pgrst, 'reload schema';
