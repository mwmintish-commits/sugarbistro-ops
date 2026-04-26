-- 清除「例假/休息日」誤算的遲到早退
-- 配合 clockin/recalcAttendance 的 day_type 判斷修正
UPDATE attendances
SET late_minutes = 0, early_leave_minutes = 0
WHERE schedule_id IN (
  SELECT id FROM schedules
  WHERE day_type IN ('regular_off', 'rest_day')
);
