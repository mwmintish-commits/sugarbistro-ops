-- ================================================
-- iChef 日結整合：從 sugarbistro-member 拉取資料
-- ================================================
-- 用途：
--   會員系統 03:10 從 iCHEF 拉資料 → 04:00 我們系統再從會員系統拉到 daily_settlements
--   會員系統用 storeCode（YK / PT / SKM_ZY / SKM_OUTLET）識別門市
--   我們的 stores.id 是 UUID，需建立對應

-- 1. stores 表加 ichef_code 欄位
ALTER TABLE stores ADD COLUMN IF NOT EXISTS ichef_code TEXT;
CREATE INDEX IF NOT EXISTS stores_ichef_code_idx ON stores(ichef_code) WHERE ichef_code IS NOT NULL;

-- 2. daily_settlements 加同步追蹤欄位
ALTER TABLE daily_settlements ADD COLUMN IF NOT EXISTS ichef_synced_at TIMESTAMPTZ;
ALTER TABLE daily_settlements ADD COLUMN IF NOT EXISTS ichef_short_amount NUMERIC DEFAULT 0;

-- 3. 對應碼設定（請依實際門市調整）
-- UPDATE stores SET ichef_code = 'YK'         WHERE name = '永康本店';
-- UPDATE stores SET ichef_code = 'PT'         WHERE name = '屏東門市';
-- UPDATE stores SET ichef_code = 'SKM_ZY'     WHERE name = '新光左營店';
-- UPDATE stores SET ichef_code = 'SKM_OUTLET' WHERE name = 'SKM Outlet';
