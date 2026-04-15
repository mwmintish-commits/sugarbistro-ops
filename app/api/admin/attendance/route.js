import { supabase, eom } from "@/lib/supabase";
import { pushText } from "@/lib/line";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const store_id = searchParams.get("store_id");
  const month = searchParams.get("month");
  const date = searchParams.get("date");

  if (type === "settings") {
    const { data } = await supabase.from("attendance_settings")
      .select("*").limit(1).single();
    return Response.json({ data });
  }

  // ✦12 出勤月報
  if (type === "monthly_report") {
    const y = month ? parseInt(month.split("-")[0]) : new Date().getFullYear();
    const m = month ? parseInt(month.split("-")[1]) : new Date().getMonth() + 1;
    let q = supabase.from("attendance_monthly_reports")
      .select("*, employees(name), stores(name)")
      .eq("year", y).eq("month", m).order("employees(name)");
    if (store_id) q = q.eq("store_id", store_id);
    const { data } = await q;
    return Response.json({ data });
  }

  // ✦13 補登紀錄
  if (type === "amendments") {
    let q = supabase.from("clock_amendments")
      .select("*, employees(name), stores(name)")
      .order("created_at", { ascending: false });
    if (month) q = q.gte("date", month + "-01").lte("date", eom(month));
    if (store_id) q = q.eq("store_id", store_id);
    const { data } = await q.limit(100);
    return Response.json({ data });
  }

  // ✦14 異常通知
  if (type === "alerts") {
    let q = supabase.from("attendance_alerts")
      .select("*, employees(name), stores(name)")
      .order("created_at", { ascending: false });
    if (month) q = q.gte("date", month + "-01").lte("date", eom(month));
    const { data } = await q.limit(100);
    return Response.json({ data });
  }

  // 出勤紀錄
  let query = supabase.from("attendances")
    .select("*, employees(name), stores(name), shifts(name)")
    .order("timestamp", { ascending: false });
  if (store_id) query = query.eq("store_id", store_id);
  if (month) {
    query = query.gte("timestamp", month + "-01T00:00:00")
      .lte("timestamp", eom(month) + "T23:59:59");
  }
  if (date) {
    query = query.gte("timestamp", date + "T00:00:00")
      .lte("timestamp", date + "T23:59:59");
  }
  const { data, error } = await query.limit(200);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "update_settings") {
    const keys = ["late_grace_minutes", "late_threshold_minutes",
      "early_leave_minutes", "overtime_min_minutes",
      "require_photo", "work_hours_per_day", "work_hours_per_week"];
    const updates = {};
    keys.forEach(k => { if (body[k] !== undefined) updates[k] = body[k]; });
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from("attendance_settings")
      .update(updates).not("id", "is", null).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (body.action === "delete") {
    const { error } = await supabase.from("attendances")
      .delete().eq("id", body.attendance_id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  // ✦13 補登審核
  if (body.action === "review_amendment") {
    const { amendment_id, status, approved_by } = body;
    const { data, error } = await supabase.from("clock_amendments")
      .update({ status, approved_by, approved_at: new Date().toISOString() })
      .eq("id", amendment_id)
      .select("*, employees(name, line_uid)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });

    // 核准→建立打卡紀錄
    if (status === "approved" && data) {
      const dateTime = data.date + "T" + data.amended_time + ":00+08:00";
      await supabase.from("attendances").insert({
        employee_id: data.employee_id,
        store_id: data.store_id,
        type: data.type,
        timestamp: dateTime,
        is_amendment: true,
        amendment_id: data.id,
        notes: "補登：" + data.reason,
      });
      if (data.employees?.line_uid) {
        await pushText(data.employees.line_uid,
          "✅ 補打卡已核准\n📅 " + data.date + " " +
          (data.type === "clock_in" ? "上班" : "下班") + " " + data.amended_time
        ).catch(() => {});
      }
    }
    return Response.json({ data });
  }

  // ✦13 建立補登申請（後台手動）
  if (body.action === "create_amendment") {
    const { employee_id, store_id, date, type, amended_time, reason } = body;
    const { data, error } = await supabase.from("clock_amendments").insert({
      employee_id, store_id, date, type, amended_time, reason,
    }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  // ✦12 產生月報
  if (body.action === "generate_monthly_report") {
    const { year, month } = body;
    const mk = year + "-" + String(month).padStart(2, "0");
    const { data: emps } = await supabase.from("employees")
      .select("id, name, store_id").eq("is_active", true);

    const results = [];
    for (const emp of emps || []) {
      // 打卡紀錄
      const { data: records } = await supabase.from("attendances")
        .select("type, timestamp, late_minutes")
        .eq("employee_id", emp.id)
        .gte("timestamp", mk + "-01T00:00:00")
        .lte("timestamp", eom(mk) + "T23:59:59");

      const clockIns = (records || []).filter(r => r.type === "clock_in");
      const workDays = clockIns.length;
      const lateCount = clockIns.filter(r => (r.late_minutes || 0) > 0).length;
      const lateMins = clockIns.reduce((s, r) => s + (r.late_minutes || 0), 0);

      // 請假
      const { data: leaves } = await supabase.from("leave_requests")
        .select("start_date, end_date, half_day")
        .eq("employee_id", emp.id).eq("status", "approved")
        .gte("start_date", mk + "-01").lte("start_date", eom(mk));
      let leaveDays = 0;
      for (const l of leaves || []) {
        leaveDays += l.half_day ? 0.5 :
          (Math.ceil((new Date(l.end_date) - new Date(l.start_date)) / 86400000) + 1);
      }

      // 加班
      const { data: ot } = await supabase.from("overtime_records")
        .select("overtime_minutes, amount, comp_type, comp_hours")
        .eq("employee_id", emp.id).eq("status", "approved")
        .gte("date", mk + "-01").lte("date", eom(mk));
      const otHours = (ot || []).reduce((s, r) => s + (r.overtime_minutes || 0), 0) / 60;
      const otCompH = (ot || []).filter(r => r.comp_type === "comp")
        .reduce((s, r) => s + Number(r.comp_hours || 0), 0);
      const otPayAmt = (ot || []).filter(r => r.comp_type === "pay")
        .reduce((s, r) => s + Number(r.amount || 0), 0);

      // 補登
      const { data: amends } = await supabase.from("clock_amendments")
        .select("id").eq("employee_id", emp.id).eq("status", "approved")
        .gte("date", mk + "-01").lte("date", eom(mk));

      await supabase.from("attendance_monthly_reports").upsert({
        employee_id: emp.id, store_id: emp.store_id,
        year, month, work_days: workDays,
        late_count: lateCount, late_total_minutes: lateMins,
        leave_days: leaveDays,
        overtime_hours: Math.round(otHours * 10) / 10,
        overtime_comp_hours: otCompH,
        overtime_pay_amount: otPayAmt,
        amendment_count: (amends || []).length,
      }, { onConflict: "employee_id,year,month" });

      results.push({ name: emp.name, workDays, lateCount, leaveDays, otHours: Math.round(otHours * 10) / 10 });
    }
    return Response.json({ success: true, data: results });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
