-- 加班事前申請流程：擴充 overtime_records 表
-- 一個 record 可以是「預約」(requested_minutes > 0)、「實際」(overtime_minutes > 0)，或兩者並存（預約後核准、打卡時對照）

ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS requested_minutes INT DEFAULT 0;
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS request_reason TEXT;
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS request_comp_pref TEXT;  -- 'pay' / 'comp' / 'auto'
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS is_pre_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ;
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES employees(id);
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- 允許 status='requested'（已申請待核准）
-- 既有 status: pending（打卡自動偵測待核准）/ approved / rejected
-- 新增 status: requested（事前申請待核准）
COMMENT ON COLUMN overtime_records.status IS 'requested(事前申請待核准) | pending(自動偵測待核准) | approved | rejected';

CREATE INDEX IF NOT EXISTS idx_overtime_pre_approved ON overtime_records(employee_id, date, is_pre_approved, status)
  WHERE is_pre_approved = true;
