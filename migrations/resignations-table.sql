-- 自願離職同意書系統

CREATE TABLE IF NOT EXISTS resignations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 員工資訊（snapshot 避免員工資料事後被修改）
  employee_id UUID REFERENCES employees(id),
  employee_name TEXT NOT NULL,
  employee_id_number TEXT,
  store_id UUID REFERENCES stores(id),
  store_name TEXT,
  hire_date DATE,

  -- 離職資訊
  resignation_type TEXT NOT NULL DEFAULT 'voluntary',  -- voluntary / company_terminated / contract_end / retirement
  last_working_date DATE NOT NULL,
  reason TEXT,
  service_months INTEGER,
  notice_days INTEGER,                                  -- 預告期天數（依勞基法 16）
  annual_leave_remaining_days NUMERIC DEFAULT 0,
  settlement_amount NUMERIC DEFAULT 0,
  additional_notes TEXT,                                -- 雙方額外約定

  -- 簽署流程
  token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',               -- pending / signed / cancelled / expired
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  signed_at TIMESTAMPTZ,
  signature_url TEXT,                                   -- 員工簽名圖片 URL
  signer_ip TEXT,                                       -- 簽署時的 IP（稽核用）

  -- 後台處理
  created_by UUID REFERENCES employees(id),
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES employees(id),
  cancel_reason TEXT,
  settlement_payment_id UUID,                           -- 對應的撥款記錄

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resignations_employee_id ON resignations(employee_id);
CREATE INDEX IF NOT EXISTS idx_resignations_status ON resignations(status);
CREATE INDEX IF NOT EXISTS idx_resignations_token ON resignations(token);

-- updated_at 自動更新 trigger（如果還沒有泛用版本）
DO $$ BEGIN
  CREATE TRIGGER set_resignations_updated_at BEFORE UPDATE ON resignations
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
EXCEPTION
  WHEN undefined_function THEN
    CREATE OR REPLACE FUNCTION trigger_set_timestamp()
    RETURNS TRIGGER AS $f$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $f$ LANGUAGE plpgsql;
    CREATE TRIGGER set_resignations_updated_at BEFORE UPDATE ON resignations
      FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
  WHEN duplicate_object THEN NULL;
END $$;
