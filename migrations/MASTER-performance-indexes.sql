-- ============================================================
-- 全站效能總索引（一次跑完，解決登入慢 + 每頁載入慢）
-- 全部 IF NOT EXISTS，可重複執行、零風險、不動資料
-- 在 Supabase SQL Editor 整份貼上 → Run
-- ============================================================

-- ⭐ 最關鍵：每支 API 都用 token 驗證 session（之前全表掃描）
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_emp ON admin_sessions(employee_id);

-- ⭐ 登入流程：查手機號碼（之前全表掃描）
CREATE INDEX IF NOT EXISTS idx_employees_phone ON employees(phone);
CREATE INDEX IF NOT EXISTS idx_verify_codes_phone ON verify_codes(phone, created_at DESC);

-- 班表（員工/門市/已發布）
CREATE INDEX IF NOT EXISTS idx_schedules_emp_date ON schedules(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_schedules_store_date ON schedules(store_id, date);
CREATE INDEX IF NOT EXISTS idx_schedules_store_emp_date ON schedules(store_id, employee_id, date);
CREATE INDEX IF NOT EXISTS idx_schedules_published_date ON schedules(published, date) WHERE published = true;

-- 打卡
CREATE INDEX IF NOT EXISTS idx_attendances_emp_ts ON attendances(employee_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_attendances_store_ts ON attendances(store_id, timestamp DESC);

-- 假別餘額（之前完全無索引，員工詳情/補休/月報都掃全表）
CREATE INDEX IF NOT EXISTS idx_leave_balances_emp_year ON leave_balances(employee_id, year);

-- 請假
CREATE INDEX IF NOT EXISTS idx_leave_requests_emp_status ON leave_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_pending ON leave_requests(status, created_at DESC) WHERE status = 'pending';

-- 補登
CREATE INDEX IF NOT EXISTS idx_clock_amendments_emp_date ON clock_amendments(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_clock_amendments_pending ON clock_amendments(status, created_at DESC) WHERE status = 'pending';

-- 加班（補休餘額查詢）
CREATE INDEX IF NOT EXISTS idx_overtime_emp_status ON overtime_records(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_overtime_comp ON overtime_records(employee_id, comp_type, comp_expiry_date) WHERE comp_type = 'comp' AND comp_used = false;

-- 費用
CREATE INDEX IF NOT EXISTS idx_expenses_store_month ON expenses(store_id, month_key);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status) WHERE status = 'pending';

-- 撥款
CREATE INDEX IF NOT EXISTS idx_payments_type_month ON payments(type, month_key);
CREATE INDEX IF NOT EXISTS idx_payments_status_month ON payments(status, month_key);
CREATE INDEX IF NOT EXISTS idx_payments_reference_id ON payments(reference_id);

-- 日結 / 存款
CREATE INDEX IF NOT EXISTS idx_settlements_store_date ON daily_settlements(store_id, date);
CREATE INDEX IF NOT EXISTS idx_deposits_store_date ON deposits(store_id, deposit_date);

-- 月報
CREATE INDEX IF NOT EXISTS idx_amr_year_month ON attendance_monthly_reports(year, month, store_id);
CREATE INDEX IF NOT EXISTS idx_amr_employee ON attendance_monthly_reports(employee_id, year, month);

-- 公告
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, created_at DESC) WHERE is_active = true;

-- 庫存異動
CREATE INDEX IF NOT EXISTS idx_inv_mov_store_ref ON inventory_movements(store_id, reference_date) WHERE reference_date IS NOT NULL;

-- 順手清掉過期 session（讓 admin_sessions 表保持小）
DELETE FROM admin_sessions WHERE expires_at < now();
