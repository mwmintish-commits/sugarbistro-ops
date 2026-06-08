-- 排班可逐天覆寫休息時間
-- 用途：班別預設休息時間（shifts.break_minutes）只是參考；員工某天實際休息不同時可在薪資頁逐筆編輯
-- 邏輯：schedules.break_minutes IS NULL → fallback 使用 shifts.break_minutes
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS break_minutes INTEGER;
COMMENT ON COLUMN schedules.break_minutes IS '當日實際休息分鐘（覆寫 shifts.break_minutes 預設）；NULL = 用班別預設';
