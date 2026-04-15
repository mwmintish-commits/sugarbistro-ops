-- Round 14：預排休假

-- 確保 leave_requests 有 request_type 欄位
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'leave';
-- leave = 正式請假, pre_arranged = 預排休假
