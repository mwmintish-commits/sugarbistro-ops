-- 公告：新增開始日期與標籤欄位
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS starts_at DATE;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS tag TEXT;

CREATE INDEX IF NOT EXISTS idx_ann_tag ON announcements(tag);
CREATE INDEX IF NOT EXISTS idx_ann_range ON announcements(starts_at, expires_at);
