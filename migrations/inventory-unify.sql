-- 統一品項主檔：盤點/進貨/叫貨/報廢/出貨皆使用 inventory_items
-- 解決：同品項因 store_id 重複出現多筆 → 全部變為「全域品項」+ 各店庫存獨立表

-- =============================================
-- 1. 補齊 inventory_items 欄位
-- =============================================
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS alert_threshold NUMERIC DEFAULT 2;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS par_level NUMERIC;

-- =============================================
-- 2. 從舊 stock_items 補進 inventory_items（不重複）
-- =============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_items') THEN
    INSERT INTO inventory_items (name, unit, category, par_level, alert_threshold, safe_stock, type, is_active)
    SELECT DISTINCT ON (s.name)
      s.name, s.unit, s.category, s.par_level, s.alert_threshold,
      COALESCE(s.par_level, 0), 'raw_material', TRUE
    FROM stock_items s
    WHERE s.is_active = TRUE
      AND NOT EXISTS (SELECT 1 FROM inventory_items i WHERE i.name = s.name AND i.is_active = TRUE)
    ORDER BY s.name, s.created_at NULLS LAST;
  END IF;
END $$;

-- =============================================
-- 3. 去除重複：同名只留一筆，FK 全部指向保留的那筆
-- =============================================
CREATE TEMP TABLE _ii_keepers AS
SELECT id, name FROM (
  SELECT id, name, ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at NULLS LAST, id) AS rn
  FROM inventory_items WHERE is_active = TRUE
) x WHERE rn = 1;

CREATE TEMP TABLE _ii_dupmap AS
SELECT i.id AS dup_id, k.id AS keep_id
FROM inventory_items i
JOIN _ii_keepers k ON k.name = i.name
WHERE i.is_active = TRUE AND i.id != k.id;

-- 重新指向 keeper
UPDATE purchase_orders po SET item_id = m.keep_id
  FROM _ii_dupmap m WHERE po.item_id = m.dup_id;
UPDATE shipment_lines sl SET item_id = m.keep_id
  FROM _ii_dupmap m WHERE sl.item_id = m.dup_id;
UPDATE inventory_movements im SET item_id = m.keep_id
  FROM _ii_dupmap m WHERE im.item_id = m.dup_id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_batches') THEN
    EXECUTE 'UPDATE inventory_batches ib SET item_id = m.keep_id FROM _ii_dupmap m WHERE ib.item_id = m.dup_id';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recipe_items') THEN
    EXECUTE 'UPDATE recipe_items ri SET item_id = m.keep_id FROM _ii_dupmap m WHERE ri.item_id = m.dup_id';
  END IF;
END $$;

-- 把舊的 store_id 各店庫存加總到 keeper
UPDATE inventory_items i
SET current_stock = COALESCE(i.current_stock, 0) + COALESCE((
  SELECT SUM(COALESCE(d.current_stock, 0))
  FROM inventory_items d
  JOIN _ii_dupmap m ON m.dup_id = d.id
  WHERE m.keep_id = i.id
), 0)
WHERE i.id IN (SELECT DISTINCT keep_id FROM _ii_dupmap);

-- 停用重複行；保留行設為全域（store_id = NULL）
UPDATE inventory_items SET is_active = FALSE WHERE id IN (SELECT dup_id FROM _ii_dupmap);
UPDATE inventory_items SET store_id = NULL WHERE is_active = TRUE;

-- =============================================
-- 4. 各店庫存獨立表（per-store stock）
-- =============================================
CREATE TABLE IF NOT EXISTS inventory_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  current_stock NUMERIC DEFAULT 0,
  par_level NUMERIC,    -- 此店標準存量（覆寫主檔）
  safe_stock NUMERIC,   -- 此店安全存量（覆寫主檔）
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (item_id, store_id)
);
CREATE INDEX IF NOT EXISTS idx_inv_stock_item ON inventory_stock(item_id);
CREATE INDEX IF NOT EXISTS idx_inv_stock_store ON inventory_stock(store_id);

-- 為每個現有「啟用品項 × 啟用門市」初始化一筆 per-store stock（current_stock=0）
INSERT INTO inventory_stock (item_id, store_id, current_stock)
SELECT i.id, s.id, 0
FROM inventory_items i
CROSS JOIN stores s
WHERE i.is_active = TRUE AND s.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM inventory_stock ist WHERE ist.item_id = i.id AND ist.store_id = s.id
  );
