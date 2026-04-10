-- Round 6：新人報到系統

CREATE TABLE IF NOT EXISTS onboarding_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_uid TEXT NOT NULL,
  name TEXT NOT NULL,
  store_id UUID REFERENCES stores(id),
  store_name TEXT,
  token TEXT UNIQUE,
  handbook_read BOOLEAN DEFAULT false,
  signed_at TIMESTAMPTZ,
  signature_name TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE onboarding_records DISABLE ROW LEVEL SECURITY;
