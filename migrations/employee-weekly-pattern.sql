-- 員工排班週模板：固定例假/休息日的星期幾
-- 排班頁建立 work 排班時，若該日為員工的 weekly_regular_off → 自動帶 regular_off（會被擋）；
-- 若為 weekly_rest_day → 自動帶 rest_day（休息日加班）
-- 屏東店通常設「週例假=wed、週休息日=thu」；台北店不固定者兩欄留空

ALTER TABLE employees ADD COLUMN IF NOT EXISTS weekly_regular_off TEXT
  CHECK (weekly_regular_off IS NULL OR weekly_regular_off IN ('mon','tue','wed','thu','fri','sat','sun'));
ALTER TABLE employees ADD COLUMN IF NOT EXISTS weekly_rest_day TEXT
  CHECK (weekly_rest_day IS NULL OR weekly_rest_day IN ('mon','tue','wed','thu','fri','sat','sun'));

NOTIFY pgrst, 'reload schema';
