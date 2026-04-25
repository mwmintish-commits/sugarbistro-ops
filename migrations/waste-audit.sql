-- 食材報廢稽核系統 Phase 1
-- 在現有 inventory_movements 上擴充欄位，不另建表
-- 欄位設計：
--   patrol_location: 巡邏位置（refrig 冷藏 / freezer 冷凍 / ambient 常溫 / display 展示櫃）
--   waste_reason   : 報廢原因（過期 / 受潮 / 製作失敗 / 客退 / 其他）
--   waste_photo_url: 含浮水印（GPS+時間）的丟棄照片
--   audit_status   : pending / approved / rejected / observe（列入觀察）
--   audit_note / audit_by / audit_at: 稽核紀錄
--   no_waste_flag  : 「本日無報廢」勾選紀錄（與 type='no_waste' 搭配）

-- 注意：原表沒有 store_id 欄位（只有 from_store_id/to_store_id），這裡補上
ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id),
  ADD COLUMN IF NOT EXISTS patrol_location TEXT,
  ADD COLUMN IF NOT EXISTS waste_reason TEXT,
  ADD COLUMN IF NOT EXISTS waste_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS audit_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS audit_note TEXT,
  ADD COLUMN IF NOT EXISTS audit_by TEXT,
  ADD COLUMN IF NOT EXISTS audit_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_by_name TEXT,
  ADD COLUMN IF NOT EXISTS gps_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS gps_lng DOUBLE PRECISION;

-- 把現有資料的 from_store_id 回填到 store_id
UPDATE inventory_movements SET store_id = from_store_id WHERE store_id IS NULL AND from_store_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_im_waste_audit
  ON inventory_movements(audit_status, created_at DESC)
  WHERE type IN ('waste', 'no_waste');

CREATE INDEX IF NOT EXISTS idx_im_waste_store_date
  ON inventory_movements(store_id, created_at DESC)
  WHERE type IN ('waste', 'no_waste');

-- 早班巡邏檢查項目（即將過期食材檢查）
-- 透過 work_log_templates 加入，使 worklog 工作日誌出現「巡邏檢查」項目
INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints)
SELECT s.id, '🔍 食材巡邏', '冷藏櫃巡邏（檢查即將到期）', 90, 'all', 'opening', 'daily', ARRAY['opening']::text[]
FROM stores s
WHERE NOT EXISTS (
  SELECT 1 FROM work_log_templates t
  WHERE t.store_id = s.id AND t.item = '冷藏櫃巡邏（檢查即將到期）'
)
ON CONFLICT DO NOTHING;

INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints)
SELECT s.id, '🔍 食材巡邏', '冷凍櫃巡邏（檢查即將到期）', 91, 'all', 'opening', 'daily', ARRAY['opening']::text[]
FROM stores s
WHERE NOT EXISTS (
  SELECT 1 FROM work_log_templates t
  WHERE t.store_id = s.id AND t.item = '冷凍櫃巡邏（檢查即將到期）'
)
ON CONFLICT DO NOTHING;

INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints)
SELECT s.id, '🔍 食材巡邏', '常溫食材巡邏（檢查即將到期）', 92, 'all', 'opening', 'daily', ARRAY['opening']::text[]
FROM stores s
WHERE NOT EXISTS (
  SELECT 1 FROM work_log_templates t
  WHERE t.store_id = s.id AND t.item = '常溫食材巡邏（檢查即將到期）'
)
ON CONFLICT DO NOTHING;

INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints)
SELECT s.id, '🔍 食材巡邏', '展示櫃巡邏（檢查即將到期）', 93, 'all', 'opening', 'daily', ARRAY['opening']::text[]
FROM stores s
WHERE NOT EXISTS (
  SELECT 1 FROM work_log_templates t
  WHERE t.store_id = s.id AND t.item = '展示櫃巡邏（檢查即將到期）'
)
ON CONFLICT DO NOTHING;

-- 閉店巡邏（最後一個動作）
INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints)
SELECT s.id, '🗑 報廢巡邏', '閉店報廢巡邏並登記（4 區）', 95, 'all', 'closing', 'daily', ARRAY['closing']::text[]
FROM stores s
WHERE NOT EXISTS (
  SELECT 1 FROM work_log_templates t
  WHERE t.store_id = s.id AND t.item = '閉店報廢巡邏並登記（4 區）'
)
ON CONFLICT DO NOTHING;
