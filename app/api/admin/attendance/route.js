import { supabase, eom, auditLog } from "@/lib/supabase";
import { pushText } from "@/lib/line";

// 重算某員工某日的加班紀錄（含休假日/國定假日出勤）
// 用於：後台編輯打卡、補登核准、手動觸發 — 補上 GPS 即時打卡才會建的加班紀錄
// 規則：
//   - 一般工作日：下班超過排班 end_time 達門檻 → 加班
//   - 休息日(rest_day) / 國定假日(national_holiday)：當日工時全部算加班（依勞基法加給）
//   - 只取代「自動產生」的紀錄（notes 以 [自動] 開頭），不動主管手動建立/核准的
async function recomputeDayOT(employee_id, date) {
  // 1) 排班（含 shift 時間與 day_type）
  const { data: sched } = await supabase.from("schedules")
    .select("*, shifts(start_time, end_time)").eq("employee_id", employee_id).eq("date", date).maybeSingle();
  if (!sched) return { ok: false, reason: "無排班" };

  // 2) 當日打卡（取最早 clock_in、最晚 clock_out）
  const { data: atts } = await supabase.from("attendances")
    .select("type, timestamp").eq("employee_id", employee_id)
    .gte("timestamp", date + "T00:00:00+08:00").lte("timestamp", date + "T23:59:59+08:00")
    .order("timestamp", { ascending: true });
  const ins = (atts || []).filter(a => a.type === "clock_in");
  const outs = (atts || []).filter(a => a.type === "clock_out");
  if (ins.length === 0 || outs.length === 0) return { ok: false, reason: "缺上班或下班打卡" };
  const toHHMM = (ts) => new Date(new Date(ts).getTime() + 8 * 3600 * 1000).toISOString().slice(11, 16);
  const inHHMM = toHHMM(ins[0].timestamp);
  const outHHMM = toHHMM(outs[outs.length - 1].timestamp);
  const mins = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

  const { data: settings } = await supabase.from("attendance_settings").select("*").limit(1).single();
  const minOt = settings?.overtime_min_minutes || 30;
  const dt = sched.day_type || "work";
  const { data: emp } = await supabase.from("employees").select("hourly_rate, monthly_salary, store_id").eq("id", employee_id).single();
  const hourlyRate = emp?.hourly_rate || (emp?.monthly_salary ? Math.round(emp.monthly_salary / 30 / 8) : 190);

  let otMinutes = 0, otType = null, rate = 1.34;
  if (dt === "rest_day" || dt === "national_holiday") {
    // 休息日/國定假日：全部工時算加班
    otMinutes = mins(outHHMM) - mins(inHHMM);
    if (dt === "national_holiday") { otType = "holiday"; rate = 2.0; }
    else { otType = otMinutes <= 120 ? "rest_1" : "rest_2"; rate = otMinutes <= 120 ? 1.34 : 1.67; }
  } else {
    // 一般工作日：超過排班 end_time 才算
    if (!sched.shifts?.end_time) return { ok: false, reason: "排班無 end_time" };
    otMinutes = mins(outHHMM) - mins(sched.shifts.end_time.slice(0, 5));
    if (otMinutes < minOt) {
      // 不足門檻 → 清掉舊的自動加班紀錄（若有）
      await supabase.from("overtime_records").delete().eq("employee_id", employee_id).eq("date", date).ilike("notes", "[自動]%");
      return { ok: false, reason: `加班 ${otMinutes} 分未達門檻 ${minOt}` };
    }
    otType = otMinutes <= 120 ? "weekday_1" : "weekday_2";
    rate = otMinutes <= 120 ? 1.34 : 1.67;
  }
  if (otMinutes < minOt && dt !== "rest_day" && dt !== "national_holiday") return { ok: false, reason: "未達門檻" };

  const amount = Math.round(hourlyRate * (otMinutes / 60) * rate);

  // 3) 取代自動產生的紀錄（保留手動的）
  await supabase.from("overtime_records").delete().eq("employee_id", employee_id).eq("date", date).ilike("notes", "[自動]%");
  // 若該日已有「手動/已核准」紀錄就不重複建（避免雙算）
  const { data: manual } = await supabase.from("overtime_records")
    .select("id").eq("employee_id", employee_id).eq("date", date).not("notes", "ilike", "[自動]%").maybeSingle();
  if (manual) return { ok: false, reason: "已有手動加班紀錄，不覆蓋" };

  await supabase.from("overtime_records").insert({
    employee_id, store_id: emp?.store_id || sched.store_id || null, date,
    scheduled_end: sched.shifts?.end_time || null, actual_end: outHHMM,
    overtime_minutes: otMinutes, overtime_type: otType, rate, amount,
    status: "pending", is_pre_approved: false, comp_type: "pending",
    notes: `[自動] ${dt === "rest_day" ? "休息日出勤" : dt === "national_holiday" ? "國定假日出勤" : "平日加班"}（後台重算）`,
  });
  return { ok: true, otMinutes, otType, amount, day_type: dt };
}

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
    .select("*, employees(name), stores(name), shifts(name, start_time, end_time, break_minutes), schedules(break_minutes, day_type)")
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

  // 清理某員工某天的重複打卡（保留每種類型「最早 1 筆 clock_in、最晚 1 筆 clock_out」，其餘刪除）
  // 雙班店家可選 keep_count=2，預設 1
  if (body.action === "dedupe_day") {
    const { employee_id, date, keep_count = 1, edited_by, edited_by_name } = body;
    if (!employee_id || !date) return Response.json({ error: "缺少 employee_id 或 date" }, { status: 400 });
    const { data: recs, error: e1 } = await supabase.from("attendances")
      .select("*").eq("employee_id", employee_id)
      .gte("timestamp", date + "T00:00:00+08:00")
      .lte("timestamp", date + "T23:59:59+08:00")
      .order("timestamp", { ascending: true });
    if (e1) return Response.json({ error: e1.message }, { status: 500 });

    const result = { clock_in_kept: [], clock_in_deleted: [], clock_out_kept: [], clock_out_deleted: [] };
    for (const type of ["clock_in", "clock_out"]) {
      const same = (recs || []).filter(r => r.type === type && !r.is_amendment);
      // clock_in 取最早；clock_out 取最晚
      const sorted = type === "clock_in" ? same : [...same].reverse();
      const keep = sorted.slice(0, keep_count).map(r => r.id);
      const del = sorted.slice(keep_count).map(r => r.id);
      result[type + "_kept"] = keep;
      result[type + "_deleted"] = del;
      if (del.length > 0) {
        await supabase.from("attendances").delete().in("id", del);
      }
    }
    await auditLog(edited_by, edited_by_name, "attendance_dedupe", "attendance", null, {
      employee_id, date, keep_count, ...result,
    });
    return Response.json({
      success: true,
      deleted: result.clock_in_deleted.length + result.clock_out_deleted.length,
      kept: result.clock_in_kept.length + result.clock_out_kept.length,
    });
  }

  // 後台直接編輯打卡時間（不走補登流程，自動重算遲到/早退）
  if (body.action === "update") {
    const { attendance_id, timestamp, type, edited_by, edited_by_name } = body;
    if (!attendance_id || !timestamp) {
      return Response.json({ error: "缺少 attendance_id 或 timestamp" }, { status: 400 });
    }

    // 取原紀錄 + 排班（用來重算）
    const { data: orig, error: e1 } = await supabase.from("attendances")
      .select("*, schedules:schedule_id(*, shifts(start_time, end_time))")
      .eq("id", attendance_id).single();
    if (e1 || !orig) return Response.json({ error: "找不到打卡紀錄" }, { status: 404 });

    // 解析新時間（取台北時區的 HH:MM）
    const t = new Date(timestamp);
    if (isNaN(t.getTime())) return Response.json({ error: "時間格式錯誤" }, { status: 400 });
    const tpHHMM = new Date(t.getTime() + 8 * 3600 * 1000).toISOString().slice(11, 16);

    // 重算 late / early_leave
    const { data: settings } = await supabase.from("attendance_settings").select("*").limit(1).single();
    const lateGrace = settings?.late_grace_minutes ?? 5;
    const earlyThr = settings?.early_leave_minutes ?? 5;
    const recType = type || orig.type;
    const shift = orig.schedules?.shifts;
    let late_minutes = 0, early_leave_minutes = 0;
    if (shift) {
      const [ch, cm] = tpHHMM.split(":").map(Number);
      if (recType === "clock_in" && shift.start_time) {
        const [sh, sm] = shift.start_time.split(":").map(Number);
        const diff = (ch * 60 + cm) - (sh * 60 + sm);
        late_minutes = diff > lateGrace ? diff : 0;
      }
      if (recType === "clock_out" && shift.end_time) {
        const [eh, em] = shift.end_time.split(":").map(Number);
        const diff = (eh * 60 + em) - (ch * 60 + cm);
        early_leave_minutes = diff > earlyThr ? diff : 0;
      }
    }

    const updates = {
      timestamp,
      is_amendment: true,
      late_minutes,
      early_leave_minutes,
      notes: (orig.notes ? orig.notes + " | " : "") +
        `後台編輯 by ${edited_by_name || edited_by || "管理員"} @${new Date().toISOString().slice(0,16).replace("T"," ")}`,
    };
    if (type && type !== orig.type) updates.type = type;

    const { data, error } = await supabase.from("attendances")
      .update(updates).eq("id", attendance_id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });

    await auditLog(edited_by, edited_by_name, "attendance_edit", "attendance", String(attendance_id), {
      old_timestamp: orig.timestamp,
      new_timestamp: timestamp,
      old_type: orig.type,
      new_type: type || orig.type,
      late_minutes, early_leave_minutes,
    });

    // 編輯下班時間 → 自動重算加班（補上 GPS 即時打卡才會建的加班紀錄）
    let otResult = null;
    if (recType === "clock_out") {
      const dateStr = new Date(new Date(timestamp).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
      try { otResult = await recomputeDayOT(orig.employee_id, dateStr); } catch (e) { otResult = { ok: false, reason: e.message }; }
    }

    return Response.json({ data, overtime: otResult });
  }

  // 手動重算某員工某日加班（後台「重算加班」按鈕用）
  if (body.action === "recompute_ot") {
    const { employee_id, date } = body;
    if (!employee_id || !date) return Response.json({ error: "缺少 employee_id 或 date" }, { status: 400 });
    const r = await recomputeDayOT(employee_id, date);
    return Response.json({ success: true, result: r });
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
      // 補登下班 → 自動重算加班
      if (data.type === "clock_out") {
        try { await recomputeDayOT(data.employee_id, data.date); } catch {}
      }
    }
    return Response.json({ data });
  }

  // ✦13 建立補登申請（後台手動）
  // 後台手動補上打卡（不走補登申請流程，直接 insert）
  if (body.action === "manual_add") {
    const { employee_id, date, type, time, edited_by, edited_by_name } = body;
    if (!employee_id || !date || !type || !time) return Response.json({ error: "缺欄位" }, { status: 400 });
    if (!/^\d{2}:\d{2}$/.test(time)) return Response.json({ error: "時間格式錯誤 HH:MM" }, { status: 400 });
    // 找出該員工該日排班（補 schedule_id / shift_id 及計算遲到早退）
    const { data: sched } = await supabase.from("schedules")
      .select("id, shift_id, store_id, day_type, shifts(start_time, end_time)")
      .eq("employee_id", employee_id).eq("date", date).maybeSingle();
    const { data: emp } = await supabase.from("employees").select("store_id").eq("id", employee_id).maybeSingle();
    const { data: settings } = await supabase.from("attendance_settings").select("*").limit(1).single();
    const lateGrace = settings?.late_grace_minutes ?? 5;
    const earlyThr = settings?.early_leave_minutes ?? 5;
    let late_minutes = 0, early_leave_minutes = 0;
    const isOffDay = sched?.day_type === "regular_off" || sched?.day_type === "rest_day";
    if (!isOffDay && sched?.shifts) {
      const [ch, cm] = time.split(":").map(Number);
      if (type === "clock_in" && sched.shifts.start_time) {
        const [sh, sm] = sched.shifts.start_time.split(":").map(Number);
        const diff = (ch * 60 + cm) - (sh * 60 + sm);
        late_minutes = diff > lateGrace ? diff : 0;
      }
      if (type === "clock_out" && sched.shifts.end_time) {
        const [eh, em] = sched.shifts.end_time.split(":").map(Number);
        const diff = (eh * 60 + em) - (ch * 60 + cm);
        early_leave_minutes = diff > earlyThr ? diff : 0;
      }
    }
    const timestamp = `${date}T${time}:00+08:00`;
    const { data, error } = await supabase.from("attendances").insert({
      employee_id, store_id: sched?.store_id || emp?.store_id || null,
      schedule_id: sched?.id || null, shift_id: sched?.shift_id || null,
      type, timestamp, is_amendment: true,
      late_minutes, early_leave_minutes,
      notes: `後台手動補上 by ${edited_by_name || edited_by || "管理員"} @${new Date().toISOString().slice(0,16).replace("T"," ")}`,
    }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    await auditLog(edited_by, edited_by_name, "attendance_manual_add", "attendance", String(data.id), { employee_id, date, type, time });
    // 補下班 → 自動重算加班
    let otResult = null;
    if (type === "clock_out") {
      try { otResult = await recomputeDayOT(employee_id, date); } catch (e) { otResult = { ok: false, reason: e.message }; }
    }
    return Response.json({ data, overtime: otResult });
  }

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
