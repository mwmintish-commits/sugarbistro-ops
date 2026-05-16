-- 加速常用查詢的索引（解決前後台變慢問題）
-- 跑這份不影響資料，只是建索引，可隨時跑

-- 班表：員工查自己班表（最常見）
CREATE INDEX IF NOT EXISTS idx_schedules_emp_date ON schedules(employee_id, date);
-- 班表：後台查整店班表
CREATE INDEX IF NOT EXISTS idx_schedules_store_date ON schedules(store_id, date);
-- 班表：已發布過濾
CREATE INDEX IF NOT EXISTS idx_schedules_published_date ON schedules(published, date) WHERE published = true;

-- 打卡：員工查自己出勤
CREATE INDEX IF NOT EXISTS idx_attendances_emp_ts ON attendances(employee_id, timestamp DESC);
-- 打卡：後台查整店出勤
CREATE INDEX IF NOT EXISTS idx_attendances_store_ts ON attendances(store_id, timestamp DESC);

-- 費用：常按 store + month_key 撈
CREATE INDEX IF NOT EXISTS idx_expenses_store_month ON expenses(store_id, month_key);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status) WHERE status = 'pending';

-- 撥款：常按 status 撈
CREATE INDEX IF NOT EXISTS idx_payments_status_month ON payments(status, month_key);

-- 請假
CREATE INDEX IF NOT EXISTS idx_leaves_status ON leave_requests(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_leaves_emp ON leave_requests(employee_id, start_date);

-- 日結
CREATE INDEX IF NOT EXISTS idx_settlements_store_date ON daily_settlements(store_id, date);

-- 庫存異動：按 store + reference_date（給銷售扣帳用）
CREATE INDEX IF NOT EXISTS idx_inv_mov_store_ref ON inventory_movements(store_id, reference_date) WHERE reference_date IS NOT NULL;

-- 公告
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, created_at DESC) WHERE is_active = true;
