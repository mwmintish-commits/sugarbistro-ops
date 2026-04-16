-- 排班/出勤加入「當日類型」分類，符合勞基法區分例假/休息日/國定假日

-- 1) schedules 加 day_type
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS day_type TEXT DEFAULT 'work'
  CHECK (day_type IN ('work', 'rest_day', 'regular_off', 'national_holiday', 'paid_leave'));

-- 休息日加班同意狀態：null=尚未推送 / pending=已推送等待回覆 / agreed=同意 / declined=拒絕
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS rest_consent TEXT
  CHECK (rest_consent IN ('pending', 'agreed', 'declined'));

-- 同意/拒絕時間
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS rest_consent_at TIMESTAMPTZ;

-- 把舊資料 is_rest_day=true 自動轉為 day_type='rest_day'
UPDATE schedules SET day_type = 'rest_day' WHERE is_rest_day = true AND day_type = 'work';

-- 2) attendances 加 work_type（打卡當下記錄是哪一類日子）
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS work_type TEXT DEFAULT 'work'
  CHECK (work_type IN ('work', 'rest_day', 'regular_off', 'national_holiday'));

-- 3) 索引：方便查詢
CREATE INDEX IF NOT EXISTS idx_schedules_day_type ON schedules(day_type);
CREATE INDEX IF NOT EXISTS idx_attendances_work_type ON attendances(work_type);
