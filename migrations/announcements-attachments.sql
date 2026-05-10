-- 公告附件支援：圖片 / 檔案 / Markdown 內容
-- attachments 結構範例：
--   [
--     { "type": "image", "url": "https://...", "name": "海報" },
--     { "type": "file",  "url": "https://...", "name": "新政策.pdf", "mime": "application/pdf" }
--   ]

ALTER TABLE announcements ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
