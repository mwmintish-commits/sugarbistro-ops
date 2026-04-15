-- Round 13：系統設定表（存員工守則等）

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;
