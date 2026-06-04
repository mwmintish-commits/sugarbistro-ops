-- 勞健保投保金額異動歷史
-- 每次員工的 labor_tier / health_tier / 自付額覆寫 / 投保身份變動時，自動寫入一筆紀錄

CREATE TABLE IF NOT EXISTS insurance_history (
  id BIGSERIAL PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  change_date DATE NOT NULL,                  -- 異動生效日（Asia/Taipei 今日）
  employment_type TEXT,                       -- regular / parttime
  labor_tier INTEGER,
  labor_self_override INTEGER,
  health_tier INTEGER,
  health_self_override INTEGER,
  health_insured_here BOOLEAN,
  changed_by TEXT,                            -- 異動人姓名（admin/manager）
  note TEXT,                                  -- 備註（可選，後台手動填）
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_history_emp_date
  ON insurance_history (employee_id, change_date DESC, created_at DESC);
