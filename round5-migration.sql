-- ============================
-- Round 5：後台登入驗證 + 門店主管角色
-- ============================

-- 後台登入 session 表
CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  role TEXT NOT NULL,
  store_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 驗證碼表
CREATE TABLE IF NOT EXISTS verify_codes (
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admin_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE verify_codes DISABLE ROW LEVEL SECURITY;
