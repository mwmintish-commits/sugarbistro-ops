-- 勞健保自付額手動覆寫 + 兼職健保不加保旗標
-- 為什麼：
-- 1. 台灣健保最低 = 基本工資，兼職員工要嘛在這家公司用正職最低級加保、
--    要嘛在他處加保（此處不替他加保）。原本「兼職健保有低於 29500 級距」是錯的。
-- 2. 自付額實際金額以勞健保事務所核定為準，系統用查表算只是預估，
--    必須提供「手動覆寫」讓會計輸入真實金額。

ALTER TABLE employees ADD COLUMN IF NOT EXISTS health_insured_here BOOLEAN DEFAULT true;
COMMENT ON COLUMN employees.health_insured_here IS '是否由本公司加保健保（兼職如在他處加保則設 false，此處不扣健保）';

ALTER TABLE employees ADD COLUMN IF NOT EXISTS labor_self_override NUMERIC;
COMMENT ON COLUMN employees.labor_self_override IS '勞保員工自付額手動覆寫（事務所核定為準，留空則查表估算）';

ALTER TABLE employees ADD COLUMN IF NOT EXISTS health_self_override NUMERIC;
COMMENT ON COLUMN employees.health_self_override IS '健保員工自付額手動覆寫（事務所核定為準，留空則查表估算）';
