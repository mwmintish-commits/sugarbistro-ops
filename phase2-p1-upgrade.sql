-- ============================================
-- Phase 2: P1 全部升級
-- A組：損益 B組：人事 C組：排班 D組：庫存 E組：安全
-- ============================================

-- ✦32 操作日誌
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID,
  actor_name TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ✦29 合約管理
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'permanent';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_end_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_file_url TEXT;

-- ✦19 效期管理（庫存批號）
CREATE TABLE IF NOT EXISTS inventory_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id),
  batch_number TEXT,
  quantity NUMERIC DEFAULT 0,
  expiry_date DATE,
  received_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_batch_expiry ON inventory_batches(expiry_date);

-- ✦16 班表範本
CREATE TABLE IF NOT EXISTS schedule_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  name TEXT NOT NULL,
  template_data JSONB NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ✦17 調班申請
CREATE TABLE IF NOT EXISTS shift_swap_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID REFERENCES employees(id),
  target_id UUID REFERENCES employees(id),
  date DATE NOT NULL,
  requester_schedule_id UUID,
  target_schedule_id UUID,
  status TEXT DEFAULT 'pending',
  approved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ✦33 登入安全
ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS login_fail_count INTEGER DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- RLS 全關
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

SELECT '✅ Phase 2 SQL 完成' AS result;
