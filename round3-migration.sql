-- ============================
-- Round 3：打卡 + 排班系統
-- 台灣勞基法工時標準
-- ============================

-- 1. 班別設定表
CREATE TABLE IF NOT EXISTS shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER DEFAULT 60,
  work_hours NUMERIC DEFAULT 8,
  role TEXT DEFAULT 'all',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 排班表
CREATE TABLE IF NOT EXISTS schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  store_id UUID REFERENCES stores(id),
  shift_id UUID REFERENCES shifts(id),
  date DATE NOT NULL,
  status TEXT DEFAULT 'scheduled',
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- 3. 打卡設定表（總部可調整）
CREATE TABLE IF NOT EXISTS attendance_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  late_grace_minutes INTEGER DEFAULT 5,
  late_threshold_minutes INTEGER DEFAULT 30,
  early_leave_minutes INTEGER DEFAULT 15,
  overtime_min_minutes INTEGER DEFAULT 30,
  overtime_rate_1 NUMERIC DEFAULT 1.34,
  overtime_rate_2 NUMERIC DEFAULT 1.67,
  overtime_tier1_hours INTEGER DEFAULT 2,
  work_hours_per_day NUMERIC DEFAULT 8,
  work_hours_per_week NUMERIC DEFAULT 40,
  break_after_hours NUMERIC DEFAULT 4,
  break_min_minutes INTEGER DEFAULT 30,
  require_photo BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 插入預設打卡設定
INSERT INTO attendance_settings (
  late_grace_minutes, late_threshold_minutes, early_leave_minutes,
  overtime_min_minutes, work_hours_per_day, work_hours_per_week
) VALUES (5, 30, 15, 30, 8, 40)
ON CONFLICT DO NOTHING;

-- 4. 修改 attendances 表增加更多欄位
ALTER TABLE attendances
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES schedules(id),
  ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES shifts(id),
  ADD COLUMN IF NOT EXISTS distance_meters NUMERIC,
  ADD COLUMN IF NOT EXISTS clock_in_token TEXT,
  ADD COLUMN IF NOT EXISTS browser_info TEXT;

-- 5. 打卡 Token 表（防偽造用）
CREATE TABLE IF NOT EXISTS clockin_tokens (
  token TEXT PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  type TEXT NOT NULL,
  store_id UUID,
  shift_id UUID,
  schedule_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. 插入預設班別
INSERT INTO shifts (store_id, name, start_time, end_time, break_minutes, work_hours, role)
SELECT s.id, '一段班', '10:00', '20:00', 60, 9, '外場'
FROM stores s WHERE s.name = '台北門市'
ON CONFLICT DO NOTHING;

INSERT INTO shifts (store_id, name, start_time, end_time, break_minutes, work_hours, role)
SELECT s.id, '一段班', '10:00', '20:00', 60, 9, '內場'
FROM stores s WHERE s.name = '台北門市'
ON CONFLICT DO NOTHING;

INSERT INTO shifts (store_id, name, start_time, end_time, break_minutes, work_hours, role)
SELECT s.id, '一段班', '10:00', '20:00', 60, 9, '外場'
FROM stores s WHERE s.name = '屏東門市'
ON CONFLICT DO NOTHING;

INSERT INTO shifts (store_id, name, start_time, end_time, break_minutes, work_hours, role)
SELECT s.id, '一段班', '10:00', '20:00', 60, 9, '內場'
FROM stores s WHERE s.name = '屏東門市'
ON CONFLICT DO NOTHING;

INSERT INTO shifts (store_id, name, start_time, end_time, break_minutes, work_hours, role)
SELECT s.id, '早班', '10:00', '16:00', 30, 5.5, 'all'
FROM stores s WHERE s.name = '新光左營店'
ON CONFLICT DO NOTHING;

INSERT INTO shifts (store_id, name, start_time, end_time, break_minutes, work_hours, role)
SELECT s.id, '晚班', '15:00', '21:30', 30, 6, 'all'
FROM stores s WHERE s.name = '新光左營店'
ON CONFLICT DO NOTHING;

INSERT INTO shifts (store_id, name, start_time, end_time, break_minutes, work_hours, role)
SELECT s.id, '早班', '10:00', '16:00', 30, 5.5, 'all'
FROM stores s WHERE s.name = 'SKM門市'
ON CONFLICT DO NOTHING;

INSERT INTO shifts (store_id, name, start_time, end_time, break_minutes, work_hours, role)
SELECT s.id, '晚班', '13:00', '21:30', 60, 7.5, 'all'
FROM stores s WHERE s.name = 'SKM門市'
ON CONFLICT DO NOTHING;

-- 關閉新表的 RLS
ALTER TABLE shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE clockin_tokens DISABLE ROW LEVEL SECURITY;
