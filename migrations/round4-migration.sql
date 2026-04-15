-- ============================
-- 排班增強 + 請假系統
-- ============================

-- 排班表加入類型欄位（班別或休假）
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'shift',
  ADD COLUMN IF NOT EXISTS leave_type TEXT,
  ADD COLUMN IF NOT EXISTS half_day TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT;

-- 預休假申請表
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  half_day TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  reviewed_by UUID REFERENCES employees(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE leave_requests DISABLE ROW LEVEL SECURITY;

-- 員工假別額度表
CREATE TABLE IF NOT EXISTS leave_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  year INTEGER NOT NULL,
  annual_leave NUMERIC DEFAULT 0,
  annual_used NUMERIC DEFAULT 0,
  sick_leave NUMERIC DEFAULT 30,
  sick_used NUMERIC DEFAULT 0,
  personal_leave NUMERIC DEFAULT 14,
  personal_used NUMERIC DEFAULT 0,
  menstrual_leave NUMERIC DEFAULT 12,
  menstrual_used NUMERIC DEFAULT 0,
  UNIQUE(employee_id, year)
);

ALTER TABLE leave_balances DISABLE ROW LEVEL SECURITY;
