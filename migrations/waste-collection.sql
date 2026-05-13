-- 報廢「物理回收」狀態追蹤
-- 用途：稽核通過 (audit_status='approved') 之後，HQ 親自去回收
-- 流程：pending (待回收) → collected (已被總部收走) → disposed (店家已自行銷毀，不需收)

ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS collection_status TEXT DEFAULT 'pending';
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS collected_by UUID REFERENCES employees(id);
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS collected_by_name TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS collection_notes TEXT;

-- 索引：快速撈待回收清單
CREATE INDEX IF NOT EXISTS idx_inv_mov_collection
  ON inventory_movements(collection_status, store_id)
  WHERE type = 'waste' AND audit_status = 'approved' AND collection_status = 'pending';
