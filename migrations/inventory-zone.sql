-- 報廢登記用：將 inventory_items 加上「區域」欄位，對應前台巡邏位置
-- zone 值：'refrig'(冷藏) | 'freezer'(冷凍) | 'ambient'(常溫) | 'display'(展示櫃)
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS zone TEXT;
COMMENT ON COLUMN inventory_items.zone IS '報廢巡邏區域：refrig/freezer/ambient/display';

CREATE INDEX IF NOT EXISTS idx_inventory_zone ON inventory_items(store_id, zone) WHERE is_active = TRUE;
