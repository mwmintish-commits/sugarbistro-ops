// 人資系統共用計算函式

export function calcHourlyRate(emp) {
  if (emp.hourly_rate) return Number(emp.hourly_rate);
  if (emp.monthly_salary) return Math.round(Number(emp.monthly_salary) / 30 / 8);
  return 190;
}

export function calcDailyRate(emp) {
  if (emp.monthly_salary) return Number(emp.monthly_salary) / 30;
  if (emp.hourly_rate) return Number(emp.hourly_rate) * 8;
  return 0;
}

// 計算單一班次的「實際計薪工時」= 排班時段 - 休息時間
// 例：10:00-20:00 break_minutes=60 → span 10hr - 1hr = 9hr
export function calcShiftHours(shift) {
  const st = shift?.start_time, et = shift?.end_time;
  if (!st || !et) return 8;
  const [sh, sm] = st.split(":").map(Number);
  const [eh, em] = et.split(":").map(Number);
  const span = (eh * 60 + em - sh * 60 - sm) / 60;
  const breakHr = Number(shift?.break_minutes || 0) / 60;
  return Math.max(0, span - breakHr);
}

export function calcLeaveDays(leave) {
  if (leave.half_day) return 0.5;
  const start = new Date(leave.start_date || leave.date);
  const end = new Date(leave.end_date || leave.start_date || leave.date);
  return Math.ceil((end - start) / 86400000) + 1;
}

// 休息日加班費階梯（勞基法 24-1）：回傳「加給部分」的乘數
export function calcRestDayOTPremium(hours) {
  const t1 = Math.min(hours, 2);
  const t2 = Math.max(0, Math.min(hours, 8) - 2);
  const t3 = Math.max(0, Math.min(hours, 12) - 8);
  return t1 * 0.34 + t2 * 0.67 + t3 * 1.67;
}

// 該月應出席天數 = 月總天 − 國定假日 − 週六/日
// holidayDates: Set<string> 格式 "YYYY-MM-DD"（is_active=true 的國假）
export function calcExpectedWorkDays(year, month, holidayDates) {
  const lastDay = new Date(year, month, 0).getDate();
  let workDays = 0;
  for (let d = 1; d <= lastDay; d++) {
    const wd = new Date(year, month - 1, d).getDay();
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (wd === 0 || wd === 6) continue;
    if (holidayDates && holidayDates.has(dateStr)) continue;
    workDays++;
  }
  return workDays;
}

export const fmt = n => "$" + Number(n || 0).toLocaleString();
