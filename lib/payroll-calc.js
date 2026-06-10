// 薪資計算共用邏輯：給 /api/admin/payroll generate 與 /api/admin/schedules update_break 等共用
// 計算單一/一批員工某月薪資，並 upsert 到 payroll_records
import { supabase, eom } from "@/lib/supabase";
import { calcHourlyRate, calcDailyRate, calcShiftHours, calcRestDayOTPremium } from "@/lib/hr-utils";

const LABOR_SELF = [738,758,795,833,870,908,955,1002,1050,1098,1145,1145,1145,1145,1145,1145,1145,1145,1145,1145];
const HEALTH_SELF = [458,470,493,516,540,563,592,622,651,681,710,748,785,822,859,896,943,990,1036,1083];
const LABOR_SELF_PT = [278,314,338,397,414,433,448,478,502,527,552,579,602,633,662,692,717,738,758,795];

// opts: { store_id?, employee_ids?: string[] }
// employee_ids 優先；否則用 store_id 或全部 active
export async function regeneratePayroll(year, month, opts = {}) {
  const mk = year + "-" + String(month).padStart(2, "0");
  let empQ = supabase.from("employees")
    .select("id, name, store_id, monthly_salary, hourly_rate, labor_tier, health_tier, employment_type, line_uid, default_allowance, default_allowance_note, default_deduction, default_deduction_note, labor_self_override, health_self_override, health_insured_here")
    .eq("is_active", true);
  if (opts.employee_ids?.length) empQ = empQ.in("id", opts.employee_ids);
  else if (opts.store_id) empQ = empQ.eq("store_id", opts.store_id);
  const { data: emps } = await empQ;
  const empIds = (emps || []).map(e => e.id);
  if (empIds.length === 0) return { results: [], count: 0 };

  const dateFrom = mk + "-01", dateTo = eom(mk);
  const [schedsAll, otAll, attAll] = await Promise.all([
    supabase.from("schedules")
      .select("employee_id, date, day_type, leave_type, leave_hours, shift_id, break_minutes, shifts(start_time, end_time, break_minutes)")
      .in("employee_id", empIds).gte("date", dateFrom).lte("date", dateTo)
      .then(r => r.data || []),
    supabase.from("overtime_records")
      .select("employee_id, date, amount, comp_type, comp_hours, comp_converted, comp_used")
      .in("employee_id", empIds).eq("status", "approved")
      .gte("date", dateFrom).lte("date", dateTo)
      .then(r => r.data || []),
    // 載入完整 attendances 用於計算遲到/早退扣款（之前只查 clock_in 計次）
    supabase.from("attendances")
      .select("employee_id, type, late_minutes, early_leave_minutes")
      .in("employee_id", empIds).eq("is_amendment", false)
      .gte("timestamp", dateFrom + "T00:00:00").lte("timestamp", dateTo + "T23:59:59")
      .then(r => r.data || [])
      .catch(() => supabase.from("attendances")
        .select("employee_id, type, late_minutes, early_leave_minutes")
        .in("employee_id", empIds)
        .gte("timestamp", dateFrom + "T00:00:00").lte("timestamp", dateTo + "T23:59:59")
        .then(r => r.data || [])),
  ]);
  const byEmp = (arr) => arr.reduce((m, r) => { (m[r.employee_id] ||= []).push(r); return m; }, {});
  const schedMap = byEmp(schedsAll), otMap = byEmp(otAll), attMap = byEmp(attAll);

  const results = [];
  const upserts = [];
  for (const emp of emps || []) {
    const hourlyRate = calcHourlyRate(emp);
    const dailyRate = calcDailyRate(emp);
    const allScheds = schedMap[emp.id] || [];

    const hrsOf = (s) => {
      if (!s.shifts) return 0;
      return calcShiftHours({
        start_time: s.shifts.start_time,
        end_time: s.shifts.end_time,
        break_minutes: s.break_minutes != null ? s.break_minutes : s.shifts.break_minutes,
      });
    };

    const workScheds = allScheds.filter(s => ["work","rest_day","national_holiday"].includes(s.day_type));
    const workDays = workScheds.length;
    const baseDayScheds = workScheds.filter(s => s.day_type === "work");
    const baseHours = baseDayScheds.reduce((sum, s) => sum + hrsOf(s), 0);
    const base = emp.monthly_salary ? Number(emp.monthly_salary)
      : (emp.hourly_rate ? Math.round(Number(emp.hourly_rate) * baseHours) : 0);

    const premiumDays = new Set(
      allScheds.filter(s => s.day_type === "rest_day" || s.day_type === "national_holiday").map(s => s.date)
    );
    const ot = (otMap[emp.id] || []).filter(r => !premiumDays.has(r.date));
    const otPay = ot.filter(r => r.comp_type === "pay" || r.comp_converted)
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    const compH = ot.filter(r => r.comp_type === "comp" && !r.comp_used && !r.comp_converted)
      .reduce((s, r) => s + Number(r.comp_hours || 0), 0);

    const isPT = emp.employment_type === "parttime";
    const ls = (emp.labor_self_override != null)
      ? Number(emp.labor_self_override) || 0
      : (emp.labor_tier ? (isPT ? LABOR_SELF_PT : LABOR_SELF)[emp.labor_tier - 1] || 0 : 0);
    const hs = (emp.health_self_override != null)
      ? Number(emp.health_self_override) || 0
      : ((isPT && emp.health_insured_here === false) ? 0
          : (emp.health_tier ? HEALTH_SELF[emp.health_tier - 1] || 0 : 0));
    const suppHealth = emp.employment_type === "parttime" && base > 29500 ? Math.round(base * 0.0211) : 0;

    const allow = Number(emp.default_allowance || 0);
    const deduct = Number(emp.default_deduction || 0);

    const holScheds = workScheds.filter(s => s.day_type === "national_holiday");
    let holidayPay = 0;
    for (const s of holScheds) {
      const hrs = hrsOf(s);
      holidayPay += emp.monthly_salary ? Math.round(dailyRate) : Math.round(hourlyRate * hrs * 2);
    }

    const restScheds = workScheds.filter(s => s.day_type === "rest_day");
    let restDayPay = 0;
    for (const s of restScheds) {
      const hrs = hrsOf(s);
      restDayPay += Math.round(hourlyRate * calcRestDayOTPremium(hrs) + hourlyRate * hrs);
    }

    let leaveDeduct = 0, leaveHours = 0, leaveDetail = "";
    const LEAVE_LABELS = { sick:"病假", personal:"事假", menstrual:"生理假", family_care:"家庭照顧" };
    if (emp.monthly_salary) {
      for (const s of allScheds) {
        if (s.day_type === "unpaid_leave") {
          const hrs = Number(s.leave_hours) || 8;
          leaveHours += hrs;
          leaveDeduct += Math.round(hourlyRate * hrs);
          leaveDetail += (leaveDetail ? "、" : "") + (LEAVE_LABELS[s.leave_type] || "事假") + (hrs < 8 ? hrs + "hr" : "1天");
        } else if (s.day_type === "half_pay_leave") {
          const hrs = Number(s.leave_hours) || 8;
          leaveHours += hrs;
          leaveDeduct += Math.round(hourlyRate * hrs * 0.5);
          leaveDetail += (leaveDetail ? "、" : "") + (LEAVE_LABELS[s.leave_type] || "病假") + (hrs < 8 ? hrs + "hr" : "1天");
        } else if (s.day_type === "work" && Number(s.leave_hours) > 0) {
          const hrs = Number(s.leave_hours);
          const rate = ["personal","family_care"].includes(s.leave_type) ? 1 : ["sick","menstrual"].includes(s.leave_type) ? 0.5 : 0;
          if (rate > 0) {
            leaveHours += hrs;
            leaveDeduct += Math.round(hourlyRate * hrs * rate);
            leaveDetail += (leaveDetail ? "、" : "") + (LEAVE_LABELS[s.leave_type] || s.leave_type) + hrs + "hr";
          }
        }
      }
    }

    // 遲到/早退扣款（按時薪 × 分鐘比例）— 兼職/月薪皆適用
    const empAtts = attMap[emp.id] || [];
    const lateMin = empAtts.filter(a => a.type === "clock_in").reduce((s,a)=>s+(a.late_minutes||0),0);
    const earlyMin = empAtts.filter(a => a.type === "clock_out").reduce((s,a)=>s+(a.early_leave_minutes||0),0);
    const lateDeduct = Math.round(hourlyRate * (lateMin + earlyMin) / 60);
    const actualClockDays = empAtts.filter(a => a.type === "clock_in").length;
    const discrepancy = Math.abs(workDays - actualClockDays);
    const net = base + otPay + holidayPay + restDayPay - ls - hs - suppHealth + allow - deduct - leaveDeduct - lateDeduct;

    upserts.push({
      employee_id: emp.id, store_id: emp.store_id,
      year, month, base_salary: base, work_days: workDays,
      hourly_rate: emp.hourly_rate || 0,
      overtime_pay: otPay, comp_hours: compH,
      holiday_pay: holidayPay, holiday_days: holScheds.length,
      rest_day_pay: restDayPay, rest_day_count: restScheds.length,
      labor_self: ls, health_self: hs,
      supplementary_health: suppHealth,
      allowance: allow, allowance_note: emp.default_allowance_note || "",
      other_deduction: deduct, deduction_note: emp.default_deduction_note || "",
      leave_deduction: leaveDeduct, leave_hours: leaveHours, leave_detail: leaveDetail,
      late_minutes: lateMin, early_leave_minutes: earlyMin, late_deduction: lateDeduct,
      net_salary: net,
    });
    results.push({ name: emp.name, base, otPay, holidayPay, restDayPay, ls, hs, suppHealth, allow, deduct, leaveDeduct, lateDeduct, lateMin, earlyMin, net, workDays, actualClockDays, discrepancy });
  }

  if (upserts.length > 0) {
    await supabase.from("payroll_records").upsert(upserts, { onConflict: "employee_id,year,month" });
  }
  return { results, count: upserts.length };
}
