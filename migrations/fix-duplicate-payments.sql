-- 修正：總部代墊／費用撥款重複請款
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上執行

-- 1) 清除既有重複（同一 reference_id 保留最早建立的那筆）
WITH ranked AS (
  SELECT id, reference_id,
         ROW_NUMBER() OVER (PARTITION BY reference_id ORDER BY created_at ASC) AS rn
  FROM payments
  WHERE reference_id IS NOT NULL
)
DELETE FROM payments
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) 建立 partial unique index，從資料庫層防止未來再發生
CREATE UNIQUE INDEX IF NOT EXISTS payments_reference_id_unique
  ON payments(reference_id)
  WHERE reference_id IS NOT NULL;
