-- 員工自訂排序
ALTER TABLE employees ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 以現有 created_at 順序做為初始排序值（依門市分組）
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY created_at) * 10 AS rn
  FROM employees
)
UPDATE employees e SET sort_order = r.rn
FROM ranked r WHERE e.id = r.id AND (e.sort_order IS NULL OR e.sort_order = 0);

CREATE INDEX IF NOT EXISTS idx_employees_sort_order ON employees(store_id, sort_order);
