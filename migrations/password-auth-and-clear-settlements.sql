-- 1) 清空所有日結資料（含子表）
DELETE FROM settlement_receipts;
DELETE FROM voucher_serials WHERE settlement_id IS NOT NULL;
DELETE FROM daily_settlements;

-- 2) 員工資料表新增密碼欄位
ALTER TABLE employees ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 3) 預設密碼（scrypt 雜湊，格式：salt:hash）
-- admin + manager：'sugar2026'
UPDATE employees
SET password_hash = '19947eaaf266794b0070508b68801c11:97cc01f1654181d0b01b91fc7125fa1663fed05c5d7b501d616f96172fdd3acad807312cf72f2b6720806db00bcbbef2d1e33b20a3f7474e36af7ccc854ddd52'
WHERE role IN ('admin', 'manager') AND is_active = TRUE;

-- store_manager：'0000'
UPDATE employees
SET password_hash = 'abb80ff4e3cbbdc323d9f48d0a6c2429:2c5e9451d099e859b4fcd87903ba8b454576ae28322daad7ba1af6fc7d68720cbdce89b72affcdfd61acfddd75a8058066feec2d11a6ccbfec92a39f2860b758'
WHERE role = 'store_manager' AND is_active = TRUE;

-- 驗證：顯示後台權限帳號的密碼設定狀態
-- SELECT id, name, role, phone, (password_hash IS NOT NULL) AS has_password
-- FROM employees WHERE is_active = TRUE AND role IN ('admin','manager','store_manager')
-- ORDER BY role, name;
