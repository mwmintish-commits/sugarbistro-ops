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

    const results = [];
    for (const emp of (emps || []).filter(e => e.probation_status !== "in_probation" && e.role !== "admin")) {

      // === 出勤紀律 30分 ===
      const { data: schedules } = await supabase.from("schedules")
        .select("date, type").eq("employee_id", emp.id).eq("type", "shift")
        .gte("date", startDate).lte("date", endDate);
      const { data: clockIns } = await supabase.from("attendances")
        .select("date, is_late").eq("employee_id", emp.id).eq("type", "clock_in")
        .gte("date", startDate).lte("date", endDate);
      const { data: leaves } = await supabase.from("leave_requests")
        .select("start_date, end_date").eq("employee_id", emp.id).eq("status", "approved")
        .gte("start_date", startDate).lte("start_date", endDate);

      const clockDates = new Set((clockIns || []).map(c => c.date));
      const leaveDates = new Set();
      for (const l of leaves || []) {
        let d = new Date(l.start_date);
        while (d <= new Date(l.end_date)) { leaveDates.add(d.toLocaleDateString("sv-SE")); d.setDate(d.getDate() + 1); }
      }

      let lateCount = (clockIns || []).filter(c => c.is_late).length;
      let absentCount = 0;
      for (const s of schedules || []) {
        if (!clockDates.has(s.date) && !leaveDates.has(s.date)) absentCount++;
      }
      const attScore = Math.max(0, 30 - (lateCount * 3) - (absentCount * 10));
      const attDetail = { late: lateCount, absent: absentCount, scheduled: (schedules || []).length };

      // === 工作完成度 30分（自動基礎分）===
      const { data: wlItems } = await supabase.from("work_log_items")
        .select("completed, completed_by_name").eq("store_id", emp.store_id)
        .gte("date", startDate).lte("date", endDate);
      const totalWl = (wlItems || []).length;
      const doneWl = (wlItems || []).filter(w => w.completed).length;
      const wlRate = totalWl > 0 ? Math.round(doneWl / totalWl * 100) : 100;
      let perfAuto = wlRate >= 95 ? 25 : wlRate >= 80 ? 20 : wlRate >= 60 ? 15 : 10;

      // === 服務態度 20分 ===
      const { data: incidents } = await supabase.from("incident_reports")
        .select("type, description").eq("store_id", emp.store_id)
        .gte("created_at", startDate).lte("created_at", endDate + "T23:59:59");
      const complaints = (incidents || []).filter(i => i.type === "customer_complaint").length;
      let svcAuto = Math.max(0, 20 - (complaints * 5));

      // === 違規紀錄 20分 ===
      const qk = year + "-Q" + quarter;
      const { data: viols } = await supabase.from("violations")
        .select("level").eq("employee_id", emp.id).eq("quarter_key", qk);
      let violScore = 20;
      let disqualified = false;
      for (const v of viols || []) {
        if (v.level === "zero_tolerance") { disqualified = true; violScore = 0; break; }
        if (v.level === "serious") { violScore = 0; break; }
        if (v.level === "moderate") violScore -= 5;
        if (v.level === "minor") violScore -= 2;
      }
      violScore = Math.max(0, violScore);

      const total = attScore + perfAuto + svcAuto + violScore;
      const coeff = disqualified ? 0 : total >= 80 ? 1.0 : total >= 70 ? 0.5 : 0;

      await supabase.from("performance_reviews").upsert({
        employee_id: emp.id, store_id: emp.store_id, year, quarter,
        attendance_score: attScore, attendance_detail: attDetail,
        performance_score: perfAuto, performance_auto: perfAuto, performance_adjust: 0,
        service_score: svcAuto, service_auto: svcAuto, service_adjust: 0,
        violation_score: violScore, violation_detail: { count: (viols || []).length, disqualified },
        total_score: total, bonus_coefficient: coeff, status: "draft"
      }, { onConflict: "employee_id,year,quarter" });

      results.push({ name: emp.name, total, coeff });
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
