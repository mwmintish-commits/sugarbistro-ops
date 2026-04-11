-- ============================================
-- 加班補休系統升級
-- 加班時數 → 員工休假表 → 可換補休或轉薪資
-- ============================================

-- 1. overtime_records 補齊補休欄位
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS comp_type TEXT DEFAULT 'pending';
  -- pending=待選擇, pay=轉加班費, comp=轉補休
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS comp_hours NUMERIC DEFAULT 0;
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS comp_expiry_date DATE;
  -- 補休到期日（勞基法：加班日起6個月內）
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS comp_used BOOLEAN DEFAULT false;
  -- 補休是否已使用
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS comp_converted BOOLEAN DEFAULT false;
  -- 過期未休是否已轉回加班費

-- 2. 確保 status 欄位存在
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- 3. 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_ot_employee ON overtime_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_ot_comp ON overtime_records(comp_type);
CREATE INDEX IF NOT EXISTS idx_ot_status ON overtime_records(status);
CREATE INDEX IF NOT EXISTS idx_ot_expiry ON overtime_records(comp_expiry_date);

-- 4. 全表 RLS 關閉
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

SELECT '✅ 加班補休系統升級完成' AS result;
