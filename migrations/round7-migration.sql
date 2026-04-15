-- Round 7：完整人資 + 勞健保 + 薪資

-- 員工擴充欄位
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS birthday DATE,
  ADD COLUMN IF NOT EXISTS id_number TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
  ADD COLUMN IF NOT EXISTS emergency_phone TEXT,
  ADD COLUMN IF NOT EXISTS emergency_relation TEXT,
  ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS hire_date DATE,
  ADD COLUMN IF NOT EXISTS contract_signed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS contract_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS insurance_start_date DATE,
  ADD COLUMN IF NOT EXISTS insurance_tier INTEGER,
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC,
  ADD COLUMN IF NOT EXISTS onboarding_id UUID;

-- 報到資料擴充
ALTER TABLE onboarding_records
  ADD COLUMN IF NOT EXISTS birthday DATE,
  ADD COLUMN IF NOT EXISTS id_number TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
  ADD COLUMN IF NOT EXISTS emergency_phone TEXT,
  ADD COLUMN IF NOT EXISTS emergency_relation TEXT,
  ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS auto_employee_id UUID;

-- 勞健保級距表（2026年餐飲業適用）
CREATE TABLE IF NOT EXISTS insurance_tiers (
  id SERIAL PRIMARY KEY,
  tier_level INTEGER NOT NULL,
  salary_min NUMERIC NOT NULL,
  salary_max NUMERIC NOT NULL,
  insured_salary NUMERIC NOT NULL,
  labor_self NUMERIC NOT NULL,
  labor_employer NUMERIC NOT NULL,
  health_self NUMERIC NOT NULL,
  health_employer NUMERIC NOT NULL,
  employment_type TEXT DEFAULT 'regular',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE insurance_tiers DISABLE ROW LEVEL SECURITY;

-- 插入常用投保級距（2026年預估，實際以政府公告為準）
-- 一般人員
INSERT INTO insurance_tiers (tier_level, salary_min, salary_max, insured_salary, labor_self, labor_employer, health_self, health_employer, employment_type) VALUES
(1, 27470, 27470, 27470, 690, 2414, 438, 1224, 'regular'),
(2, 27471, 28800, 28800, 723, 2531, 459, 1283, 'regular'),
(3, 28801, 30300, 30300, 761, 2663, 483, 1350, 'regular'),
(4, 30301, 31800, 31800, 799, 2795, 507, 1417, 'regular'),
(5, 31801, 33300, 33300, 836, 2927, 531, 1484, 'regular'),
(6, 33301, 34800, 34800, 874, 3059, 555, 1551, 'regular'),
(7, 34801, 36300, 36300, 912, 3191, 579, 1619, 'regular'),
(8, 36301, 38200, 38200, 959, 3358, 609, 1704, 'regular'),
(9, 38201, 40100, 40100, 1007, 3525, 640, 1789, 'regular'),
(10, 40101, 42000, 42000, 1055, 3692, 670, 1874, 'regular'),
(11, 42001, 43900, 43900, 1103, 3859, 700, 1959, 'regular'),
(12, 43901, 45800, 45800, 1150, 4026, 730, 2044, 'regular');

-- 兼職人員（部分工時）
INSERT INTO insurance_tiers (tier_level, salary_min, salary_max, insured_salary, labor_self, labor_employer, health_self, health_employer, employment_type) VALUES
(1, 0, 11100, 11100, 279, 976, 177, 495, 'parttime'),
(2, 11101, 12540, 12540, 315, 1102, 200, 559, 'parttime'),
(3, 12541, 13500, 13500, 339, 1187, 215, 602, 'parttime'),
(4, 13501, 15840, 15840, 398, 1392, 253, 707, 'parttime'),
(5, 15841, 16500, 16500, 414, 1451, 263, 736, 'parttime'),
(6, 16501, 17280, 17280, 434, 1519, 276, 771, 'parttime'),
(7, 17281, 17880, 17880, 449, 1572, 285, 798, 'parttime'),
(8, 17881, 19047, 19047, 478, 1674, 304, 850, 'parttime'),
(9, 19048, 20008, 20008, 503, 1759, 319, 893, 'parttime'),
(10, 20009, 21009, 21009, 528, 1847, 335, 937, 'parttime'),
(11, 21010, 22000, 22000, 553, 1934, 351, 981, 'parttime'),
(12, 22001, 23100, 23100, 580, 2030, 368, 1031, 'parttime');

-- 薪資單表
CREATE TABLE IF NOT EXISTS payroll (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  work_days NUMERIC DEFAULT 0,
  work_hours NUMERIC DEFAULT 0,
  overtime_hours NUMERIC DEFAULT 0,
  base_salary NUMERIC DEFAULT 0,
  overtime_pay NUMERIC DEFAULT 0,
  bonus NUMERIC DEFAULT 0,
  labor_insurance_self NUMERIC DEFAULT 0,
  health_insurance_self NUMERIC DEFAULT 0,
  other_deductions NUMERIC DEFAULT 0,
  net_salary NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, year, month)
);

ALTER TABLE payroll DISABLE ROW LEVEL SECURITY;

-- 年假額度計算參考表（台灣勞基法）
-- regular: 一般人員
-- parttime: 兼職人員（依比例計算）
CREATE TABLE IF NOT EXISTS annual_leave_rules (
  id SERIAL PRIMARY KEY,
  min_months INTEGER NOT NULL,
  max_months INTEGER,
  leave_days NUMERIC NOT NULL,
  employment_type TEXT DEFAULT 'regular',
  description TEXT
);

ALTER TABLE annual_leave_rules DISABLE ROW LEVEL SECURITY;

INSERT INTO annual_leave_rules (min_months, max_months, leave_days, employment_type, description) VALUES
(6, 12, 3, 'regular', '滿6個月未滿1年：3天'),
(12, 24, 7, 'regular', '滿1年未滿2年：7天'),
(24, 36, 10, 'regular', '滿2年未滿3年：10天'),
(36, 60, 14, 'regular', '滿3年未滿5年：14天'),
(60, 120, 15, 'regular', '滿5年未滿10年：15天'),
(120, NULL, 15, 'regular', '滿10年以上：每年加1天，最多30天'),
(6, 12, 1.5, 'parttime', '兼職滿6個月未滿1年：1.5天（比例）'),
(12, 24, 3.5, 'parttime', '兼職滿1年未滿2年：3.5天'),
(24, 36, 5, 'parttime', '兼職滿2年未滿3年：5天'),
(36, 60, 7, 'parttime', '兼職滿3年未滿5年：7天'),
(60, 120, 7.5, 'parttime', '兼職滿5年未滿10年：7.5天'),
(120, NULL, 7.5, 'parttime', '兼職滿10年以上：比例加算');
