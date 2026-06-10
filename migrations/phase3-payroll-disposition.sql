-- Phase 3: 結算對帳系統的 disposition 欄位
-- 讓管理者月底決定「多/少出席」「加班」「補假來源」如何處理

-- schedules: 補假來源（扣月薪 / 扣特休餘額）
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS comp_source TEXT
  CHECK (comp_source IS NULL OR comp_source IN ('salary','annual_leave'));

-- payroll_records: 管理者本月對帳的決定
-- overtime_disposition: 加班 → 'pay'(轉薪) | 'comp'(累積補休)
-- attendance_diff_disposition: 多/少出席 → 'pay'(轉薪) | 'comp'(扣假/累積補休) | 'ignore'(不計)
-- annual_leave_used_days: 補假扣特休的天數累計
-- comp_leave_added_hours: 結算後寫入 leave_balances.comp_balance 的補休時數
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS overtime_disposition TEXT
  CHECK (overtime_disposition IS NULL OR overtime_disposition IN ('pay','comp'));
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS attendance_diff_disposition TEXT
  CHECK (attendance_diff_disposition IS NULL OR attendance_diff_disposition IN ('pay','comp','ignore'));
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS annual_leave_used_days NUMERIC DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS comp_leave_added_hours NUMERIC DEFAULT 0;

-- leave_balances 補休餘額欄位（若不存在則加）
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS comp_balance NUMERIC DEFAULT 0;

NOTIFY pgrst, 'reload schema';
