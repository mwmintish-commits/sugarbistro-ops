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

export function calcShiftHours(shift) {
  const st = shift?.start_time, et = shift?.end_time;
  if (!st || !et) return 8;
  const [sh, sm] = st.split(":").map(Number);
  const [eh, em] = et.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
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

export const fmt = n => "$" + Number(n || 0).toLocaleString();
