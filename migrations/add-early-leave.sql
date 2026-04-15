-- 出勤新增早退分鐘欄位
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS early_leave_minutes INTEGER DEFAULT 0;
-- 預設早退門檻改為 5 分鐘（原為 15）
UPDATE attendance_settings SET early_leave_minutes = 5 WHERE early_leave_minutes IS NULL OR early_leave_minutes = 15;
