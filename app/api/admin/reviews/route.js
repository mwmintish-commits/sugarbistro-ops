import { supabase, eom } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");
  const quarter = searchParams.get("quarter");
  const store_id = searchParams.get("store_id");

  let q = supabase.from("performance_reviews")
    .select("*, employees:employee_id(name, role, store_id, is_active), stores:store_id(name)")
    .order("total_score", { ascending: false });
  if (year) q = q.eq("year", Number(year));
  if (quarter) q = q.eq("quarter", Number(quarter));
  if (store_id) q = q.eq("store_id", store_id);
  const { data } = await q;
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();

  // 一鍵產生考核表
  if (body.action === "generate") {
    const { year, quarter } = body;
    const qMonths = [(quarter - 1) * 3 + 1, (quarter - 1) * 3 + 2, (quarter - 1) * 3 + 3];
    const startDate = year + "-" + String(qMonths[0]).padStart(2, "0") + "-01";
    const endMonth = year + "-" + String(qMonths[2]).padStart(2, "0");
    const endDate = eom(endMonth);

    const { data: emps } = await supabase.from("employees")
      .select("id, name, role, store_id, employment_type, probation_status")
      .eq("is_active", true);

    const targets = (emps || []).filter(e => e.probation_status !== "in_probation" && e.role !== "admin");
    const empIds = targets.map(e => e.id);
    const storeIds = [...new Set(targets.map(e => e.store_id).filter(Boolean))];
    const qk = year + "-Q" + quarter;

    // ===== 批次預載：所有員工 & 所有門市的相關資料 =====
    const [schedsAll, clockInsAll, clockOutsAll, leavesAll, alertsAll, wlItemsAll, incidentsAll, violsAll] =
      empIds.length === 0 ? [[],[],[],[],[],[],[],[]] : await Promise.all([
        supabase.from("schedules").select("employee_id, date, type")
          .in("employee_id", empIds).eq("type", "shift").gte("date", startDate).lte("date", endDate).then(r => r.data || []),
        supabase.from("attendances").select("employee_id, date, late_minutes")
          .in("employee_id", empIds).eq("type", "clock_in").gte("date", startDate).lte("date", endDate).then(r => r.data || []),
        supabase.from("attendances").select("employee_id, date, early_leave_minutes")
          .in("employee_id", empIds).eq("type", "clock_out").gte("date", startDate).lte("date", endDate).then(r => r.data || []),
        supabase.from("leave_requests").select("employee_id, start_date, end_date")
          .in("employee_id", empIds).eq("status", "approved").lte("start_date", endDate).gte("end_date", startDate).then(r => r.data || []),
        supabase.from("attendance_alerts").select("employee_id, date")
          .in("employee_id", empIds).eq("alert_type", "no_clockin").gte("date", startDate).lte("date", endDate).then(r => r.data || []),
        storeIds.length === 0 ? Promise.resolve([]) : supabase.from("work_log_items").select("store_id, completed")
          .in("store_id", storeIds).gte("date", startDate).lte("date", endDate).then(r => r.data || []),
        storeIds.length === 0 ? Promise.resolve([]) : supabase.from("incident_reports").select("store_id, type")
          .in("store_id", storeIds).gte("created_at", startDate).lte("created_at", endDate + "T23:59:59").then(r => r.data || []),
        supabase.from("violations").select("employee_id, level")
          .in("employee_id", empIds).eq("quarter_key", qk).then(r => r.data || []),
      ]);

    const byEmp = (arr) => arr.reduce((m, r) => { (m[r.employee_id] ||= []).push(r); return m; }, {});
    const byStore = (arr) => arr.reduce((m, r) => { (m[r.store_id] ||= []).push(r); return m; }, {});
    const schedMap = byEmp(schedsAll), ciMap = byEmp(clockInsAll), coMap = byEmp(clockOutsAll);
    const lvMap = byEmp(leavesAll), alertMap = byEmp(alertsAll), violMap = byEmp(violsAll);
    const wlMap = byStore(wlItemsAll), incMap = byStore(incidentsAll);

    const results = [];
    const upserts = [];
    for (const emp of targets) {
      // === 出勤紀律 30分 ===
      const schedules = schedMap[emp.id] || [];
      const clockIns = ciMap[emp.id] || [];
      const clockOuts = coMap[emp.id] || [];
      const leaves = lvMap[emp.id] || [];
      const alerts = alertMap[emp.id] || [];

      const clockDates = new Set(clockIns.map(c => c.date));
      const leaveDates = new Set();
      for (const l of leaves) {
        let d = new Date(l.start_date);
        while (d <= new Date(l.end_date)) { leaveDates.add(d.toLocaleDateString("sv-SE")); d.setDate(d.getDate() + 1); }
      }

      const lateCount = clockIns.filter(c => c.late_minutes > 0).length;
      const earlyLeaveCount = clockOuts.filter(c => c.early_leave_minutes > 0).length;
      const noClockInAlerts = alerts.length;
      let absentCount = 0;
      for (const s of schedules) {
        if (!clockDates.has(s.date) && !leaveDates.has(s.date)) absentCount++;
      }
      const attScore = Math.max(0, 30 - (lateCount * 3) - (earlyLeaveCount * 3) - (absentCount * 10));
      const attDetail = { late: lateCount, early_leave: earlyLeaveCount, absent: absentCount, no_clockin_alerts: noClockInAlerts, scheduled: schedules.length };

      // === 工作完成度 30分 ===
      const wlItems = wlMap[emp.store_id] || [];
      const totalWl = wlItems.length;
      const doneWl = wlItems.filter(w => w.completed).length;
      const wlRate = totalWl > 0 ? Math.round(doneWl / totalWl * 100) : 100;
      let perfAuto = wlRate >= 95 ? 25 : wlRate >= 80 ? 20 : wlRate >= 60 ? 15 : 10;

      // === 服務態度 20分 ===
      const incidents = incMap[emp.store_id] || [];
      const complaints = incidents.filter(i => i.type === "customer_complaint").length;
      let svcAuto = Math.max(0, 20 - (complaints * 5));

      // === 違規紀錄 20分 ===
      const viols = violMap[emp.id] || [];
      let violScore = 20;
      let disqualified = false;
      for (const v of viols) {
        if (v.level === "zero_tolerance") { disqualified = true; violScore = 0; break; }
        if (v.level === "serious") { violScore = 0; break; }
        if (v.level === "moderate") violScore -= 5;
        if (v.level === "minor") violScore -= 2;
      }
      violScore = Math.max(0, violScore);

      const total = attScore + perfAuto + svcAuto + violScore;
      const coeff = disqualified ? 0 : total >= 80 ? 1.0 : total >= 70 ? 0.5 : 0;

      upserts.push({
        employee_id: emp.id, store_id: emp.store_id, year, quarter,
        attendance_score: attScore, attendance_detail: attDetail,
        performance_score: perfAuto, performance_auto: perfAuto, performance_adjust: 0,
        service_score: svcAuto, service_auto: svcAuto, service_adjust: 0,
        violation_score: violScore, violation_detail: { count: viols.length, disqualified },
        total_score: total, bonus_coefficient: coeff, status: "draft"
      });

      results.push({ name: emp.name, total, coeff });
    }

    if (upserts.length > 0) {
      await supabase.from("performance_reviews").upsert(upserts, { onConflict: "employee_id,year,quarter" });
    }
    return Response.json({ success: true, generated: results.length, data: results });
  }

  // 手動調整
  if (body.action === "adjust") {
    const { review_id, performance_adjust, service_adjust, notes, reviewer_id } = body;
    const { data: rev } = await supabase.from("performance_reviews").select("*").eq("id", review_id).single();
    if (!rev) return Response.json({ error: "Not found" }, { status: 404 });

    const pa = Math.max(-5, Math.min(5, performance_adjust || 0));
    const sa = Math.max(-5, Math.min(5, service_adjust || 0));
    const newPerf = rev.performance_auto + pa;
    const newSvc = rev.service_auto + sa;
    const total = rev.attendance_score + newPerf + newSvc + rev.violation_score;
    const disq = rev.violation_detail?.disqualified;
    const coeff = disq ? 0 : total >= 80 ? 1.0 : total >= 70 ? 0.5 : 0;

    const { data } = await supabase.from("performance_reviews").update({
      performance_adjust: pa, performance_score: newPerf,
      service_adjust: sa, service_score: newSvc,
      total_score: total, bonus_coefficient: coeff,
      reviewer_id, notes
    }).eq("id", review_id).select().single();
    return Response.json({ data });
  }

  // 提交/核准
  if (body.action === "submit") {
    await supabase.from("performance_reviews").update({ status: "submitted" }).eq("id", body.review_id);
    return Response.json({ success: true });
  }
  if (body.action === "approve_all") {
    await supabase.from("performance_reviews").update({ status: "approved" })
      .eq("year", body.year).eq("quarter", body.quarter).eq("status", "submitted");
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
