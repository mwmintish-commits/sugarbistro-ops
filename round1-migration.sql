-- ============================
-- Round 1：員工綁定 + 三級權限
-- 在 Supabase SQL Editor 中執行
-- ============================

-- 修改 employees 表：加入綁定碼和角色欄位
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS bind_code TEXT,
  ADD COLUMN IF NOT EXISTS bind_code_expires TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS managed_store_id UUID REFERENCES stores(id);

-- 確保 role 欄位的值只能是 admin/manager/staff
-- (如果已有資料，先更新)
UPDATE employees SET role = 'staff' WHERE role NOT IN ('admin', 'manager', 'staff');

-- 建立綁定碼唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_bind_code
  ON employees(bind_code) WHERE bind_code IS NOT NULL;

-- ============================
-- 插入預設總部管理員帳號
-- （你之後用 LINE 綁定它）
-- ============================
INSERT INTO employees (name, role, is_active)
VALUES ('總部管理員', 'admin', true)
ON CONFLICT DO NOTHING;

-- 為這個帳號產生綁定碼（有效 7 天）
UPDATE employees
SET bind_code = '888888',
    bind_code_expires = now() + interval '7 days'
WHERE name = '總部管理員' AND role = 'admin';

-- 日結附加單據表
CREATE TABLE IF NOT EXISTS settlement_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  settlement_id UUID REFERENCES daily_settlements(id),
  receipt_type TEXT NOT NULL,
  image_url TEXT,
  serial_numbers JSONB,
  amount NUMERIC DEFAULT 0,
  ai_raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 券別流水號稽核表（防重複使用）
CREATE TABLE IF NOT EXISTS voucher_serials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  serial_number TEXT NOT NULL,
  voucher_type TEXT NOT NULL,
  store_id UUID REFERENCES stores(id),
  settlement_id UUID REFERENCES daily_settlements(id),
  date DATE,
  amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(serial_number, voucher_type)
);

-- 出勤打卡表
CREATE TABLE IF NOT EXISTS attendances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  store_id UUID REFERENCES stores(id),
  type TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_valid BOOLEAN DEFAULT true,
  photo_url TEXT,
  late_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
