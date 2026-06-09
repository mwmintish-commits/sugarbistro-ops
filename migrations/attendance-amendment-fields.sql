-- 補登/手動建立打卡所需欄位
-- code 在 app/api/admin/attendance/route.js 與 clockin/route.js 都會用到，但歷史 migration 沒建
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS is_amendment BOOLEAN DEFAULT false;
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS amendment_id UUID;
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_attendances_is_amendment ON attendances(is_amendment);

-- 強制 PostgREST 重新掃描 schema cache（Supabase 用）
NOTIFY pgrst, 'reload schema';
