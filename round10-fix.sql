-- Round 10：勞保健保分開 + 工作日誌後台

ALTER TABLE employees ADD COLUMN IF NOT EXISTS labor_tier INTEGER;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS health_tier INTEGER;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS labor_start_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS health_start_date DATE;
