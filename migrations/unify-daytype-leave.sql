-- 統一排班→薪資邏輯：單一來源原則

-- 1) day_type 放寬 CHECK（新增 unpaid_leave / half_pay_leave）
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_day_type_check;
ALTER TABLE schedules ADD CONSTRAINT schedules_day_type_check
  CHECK (day_type IN ('work','rest_day','regular_off','national_holiday','paid_leave','unpaid_leave','half_pay_leave'));

-- 2) 請假時數（部分請假用，0=整天）
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS leave_hours NUMERIC DEFAULT 0;

-- 3) 舊資料轉換：把 leave_type 對應到正確的 day_type
UPDATE schedules SET day_type = 'unpaid_leave' WHERE type = 'leave' AND leave_type IN ('personal','family_care') AND day_type = 'paid_leave';
UPDATE schedules SET day_type = 'half_pay_leave' WHERE type = 'leave' AND leave_type IN ('sick','menstrual') AND day_type = 'paid_leave';

-- 4) 確保 half_day 欄位轉 leave_hours（半天=4小時）
UPDATE schedules SET leave_hours = 4 WHERE half_day IS NOT NULL AND half_day != '' AND leave_hours = 0;

-- 5) leave_requests 也加 leave_hours（前端傳入）
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_hours NUMERIC DEFAULT 0;
