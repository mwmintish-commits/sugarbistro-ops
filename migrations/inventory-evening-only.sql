-- 盤點項目改為只在「晚班」執行（顯示用，不強制）
-- 不修改 is_required，員工沒勾仍可結班（後台會標記未完成）

UPDATE work_log_templates
SET checkpoints = ARRAY['evening_end']::text[]
WHERE is_active = TRUE
  AND (
    item ILIKE '%盤點%'
    OR category IN ('庫存盤點', '冷藏盤點', '冷凍盤點', '盤點')
  );

-- 驗證查詢（執行後手動跑一次確認）
-- SELECT store_id, item, category, checkpoints, is_active
-- FROM work_log_templates
-- WHERE is_active = TRUE
--   AND (item ILIKE '%盤點%' OR category IN ('庫存盤點','冷藏盤點','冷凍盤點','盤點'))
-- ORDER BY store_id, sort_order;
