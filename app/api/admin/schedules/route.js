import { supabase, auditLog } from "@/lib/supabase";
import { pushText } from "@/lib/line";

// 依最新班表重新計算該班 attendances 的遲到/早退分鐘
async function recalcAttendance(scheduleId) {
  if (!scheduleId) return;
  const { data: sch } = await supabase.from("schedules")
    .select("id, shifts(start_time, end_time)").eq("id", scheduleId).single();
  if (!sch) return;
  const { data: settings } = await supabase.from("attendance_settings").select("*").limit(1).single();
  const graceIn = settings?.late_grace_minutes ?? 5;
  const graceOut = settings?.early_leave_minutes ?? 5;
  const { data: atts } = await supabase.from("attendances")
    .select("id, type, timestamp").eq("schedule_id", scheduleId);
  for (const a of atts || []) {
    const tp = new Date(a.timestamp).toLocaleTimeString("sv-SE",
      { timeZone: "Asia/Taipei", hour12: false }).slice(0, 5);
    const [ch, cm] = tp.split(":").map(Number);
    if (a.type === "clock_in" && sch.shifts?.start_time) {
      const [sh, sm] = sch.shifts.start_time.split(":").map(Number);
      const diff = (ch * 60 + cm) - (sh * 60 + sm);
      await supabase.from("attendances")
        .update({ late_minutes: diff > graceIn ? diff : 0 }).eq("id", a.id);
    } else if (a.type === "clock_out" && sch.shifts?.end_time) {
      const [eh, em] = sch.shifts.end_time.split(":").map(Number);
      const diff = (eh * 60 + em) - (ch * 60 + cm);
      await supabase.from("attendances")
        .update({ early_leave_minutes: diff > graceOut ? diff : 0 }).eq("id", a.id);
    }
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const store_id = searchParams.get("store_id");
  const month = searchParams.get("month");
  const week_start = searchParams.get("week_start");
  const week_end = searchParams.get("week_end");
  const type = searchParams.get("type");

  // ✦16 範本列表
  if (type === "templates") {
    let q = supabase.from("schedule_templates").select("*").order("created_at", { ascending: false });
    if (store_id) q = q.eq("store_id", store_id);
    const { data } = await q.limit(20);
    return Response.json({ data });
  }

  let query = supabase.from("schedules").select("*, employees(name, line_uid), shifts(name, start_time, end_time, role, color), stores(name)").order("date");
  if (store_id) query = query.eq("store_id", store_id);
  if (month) {
    const y = parseInt(month.split("-")[0]), m = parseInt(month.split("-")[1]);
    const firstDay = new Date(y, m - 1, 1);
    const startOfWeek = new Date(firstDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const lastDay = new Date(y, m, 0);
    const endOfWeek = new Date(lastDay);
    endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay()));
    query = query.gte("date", startOfWeek.toLocaleDateString("sv-SE")).lte("date", endOfWeek.toLocaleDateString("sv-SE"));
  }
  if (week_start && week_end) query = query.gte("date", week_start).lte("date", week_end);
  // 員工檢視：只回傳已發布的班表（或預假本人申請）
  if (searchParams.get("published_only") === "1") query = query.or("published.eq.true,leave_type.eq.advance");

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();
  const { action } = body;

  if (action === "create") {
    const { employee_id, store_id, shift_id, date, type, leave_type, half_day, note, is_rest_day, leave_hours } = body;
    let { day_type } = body;
    // 自動推導 day_type：明確指定者優先；否則由 leave_type / is_rest_day 推導
    if (!day_type) {
      if (leave_type === "off") day_type = "regular_off";
      else if (leave_type === "rest" || is_rest_day) day_type = "rest_day";
      else if (type === "leave") day_type = "paid_leave";
      else day_type = "work";
    }
    // 檢查是否為國定假日（自動帶 day_type）
    if (day_type === "work" && type !== "leave") {
      const { data: hol } = await supabase.from("national_holidays").select("id").eq("date", date).eq("is_active", true).limit(1).maybeSingle();
      if (hol) day_type = "national_holiday";
    }

    // 如果是排班，檢查是否已有假別
    if (type !== "leave") {
      const { data: existing } = await supabase.from("schedules")
        .select("id, type, leave_type").eq("employee_id", employee_id).eq("date", date).eq("type", "leave").limit(1);
      if (existing?.length) {
        const lt = { advance:"預假", annual:"特休", sick:"病假", personal:"事假", menstrual:"生理假", comp_time:"補休", marriage:"婚假", funeral:"喪假" };
        // 如果是休息日，轉為「休息日加班」= 排班 + is_rest_day
        if (existing[0].leave_type === "rest") {
          await supabase.from("schedules").delete().eq("id", existing[0].id);
          // 繼續往下建立排班 + is_rest_day = true
        } else if (existing[0].leave_type === "off") {
          return Response.json({ skipped: true, warning: "⚠️ " + date + " 為例假日，依法不可排班。如需出勤請改為休息日。" });
        } else {
          return Response.json({ skipped: true, warning: "⏭ " + date + " 已有" + (lt[existing[0].leave_type] || "休假") + "，已跳過" });
        }
      }
    }

    // 一例一休檢核
    if (type !== "leave") {
      const d = new Date(date);
      const checkStart = new Date(d.getTime() - 6 * 86400000).toLocaleDateString("sv-SE");
      const checkEnd = new Date(d.getTime() + 6 * 86400000).toLocaleDateString("sv-SE");
      const { data: nearby } = await supabase.from("schedules")
        .select("date, type").eq("employee_id", employee_id)
        .gte("date", checkStart).lte("date", checkEnd).order("date");
      const workDates = new Set((nearby || []).filter(s => s.type !== "leave").map(s => s.date));
      workDates.add(date);
      let maxConsecutive = 0, curr = 0;
      for (let i = -6; i <= 6; i++) {
        const dd = new Date(d.getTime() + i * 86400000).toLocaleDateString("sv-SE");
        if (workDates.has(dd)) { curr++; maxConsecutive = Math.max(maxConsecutive, curr); } else { curr = 0; }
      }
      // 判斷是否為休息日加班
      const restDayWork = day_type === "rest_day";
      const warning = maxConsecutive >= 7 ? "⚠️ 連續工作" + maxConsecutive + "天，違反一例一休" : maxConsecutive === 6 ? "⚠️ 已連續6天" : restDayWork ? "💰 休息日加班，依法加成計薪" : null;
      // 例假禁止排班（除非是 leave 類型）
      if (day_type === "regular_off") {
        return Response.json({ error: "⚠️ 例假日依勞基法不可排班，除非天災事變請改為休息日" }, { status: 400 });
      }
      const isRestDay = day_type === "rest_day";
      const { data, error } = await supabase.from("schedules").upsert({
        employee_id, store_id: store_id || null, shift_id: shift_id || null, date,
        type: type || "shift", leave_type: leave_type || null, half_day, note, status: "scheduled",
        day_type, leave_hours: Number(leave_hours || 0),
        rest_consent: isRestDay ? "pending" : null,
      }, { onConflict: "employee_id,date" }).select("*, employees(name, line_uid), shifts(name, start_time, end_time)").single();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      await recalcAttendance(data?.id);

      // 休息日同意書在「發布班表」時才推送，此處只標記 rest_consent=pending
      return Response.json({ data, warning: isRestDay ? "💰 已排休息日加班（發布班表後會推同意書）" : warning });
    }

    // 如果新增休息日，檢查是否已有排班 → 標記為休息日加班
    if (type === "leave" && (leave_type === "rest" || leave_type === "off")) {
      const { data: existing } = await supabase.from("schedules")
        .select("id, type, shift_id").eq("employee_id", employee_id).eq("date", date).eq("type", "shift").limit(1);
      if (existing?.length && leave_type === "rest") {
        // 已有排班 → 標記為休息日加班
        const { data, error } = await supabase.from("schedules").update({ day_type: "rest_day" })
          .eq("id", existing[0].id).select("*, employees(name), shifts(name, start_time, end_time)").single();
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ data, message: "💰 已標記為休息日加班" });
      }
      if (existing?.length && leave_type === "off") {
        return Response.json({ error: "⚠️ 此日已有排班，例假日不可工作。請先刪除排班或改為休息日。" });
      }
    }

    const { data, error } = await supabase.from("schedules").upsert({
      employee_id, store_id: store_id || null, shift_id: shift_id || null, date,
      type: type || "shift", leave_type, half_day, note, status: "scheduled", day_type,
    }, { onConflict: "employee_id,date" }).select("*, employees(name), shifts(name, start_time, end_time)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    await recalcAttendance(data?.id);
    return Response.json({ data });
  }

  // 複製上週班表
  if (action === "copy_week") {
    const { source_start, source_end, target_start, store_id } = body;
    let q = supabase.from("schedules").select("employee_id, shift_id, store_id, type, leave_type, half_day, note")
      .gte("date", source_start).lte("date", source_end).eq("type", "shift");
    if (store_id) q = q.eq("store_id", store_id);
    const { data: source } = await q;
    if (!source?.length) return Response.json({ error: "上週無排班資料", copied: 0 });

    const srcBase = new Date(source_start).getTime();
    const tgtBase = new Date(target_start).getTime();
    let copied = 0, skipped = 0;
    for (const s of source) {
      const srcDate = new Date(s.date || source_start);
      const offset = Math.round((new Date(s.date || source_start).getTime() - srcBase) / 86400000);
      const tgtDate = new Date(tgtBase + offset * 86400000).toLocaleDateString("sv-SE");
      // 檢查目標日有無休假
      const { data: ex } = await supabase.from("schedules").select("id").eq("employee_id", s.employee_id).eq("date", tgtDate).eq("type", "leave").limit(1);
      if (ex?.length) { skipped++; continue; }
      await supabase.from("schedules").upsert({
        employee_id: s.employee_id, store_id: s.store_id, shift_id: s.shift_id,
        date: tgtDate, type: "shift", status: "scheduled",
      }, { onConflict: "employee_id,date" });
      copied++;
    }
    return Response.json({ copied, skipped, message: "已複製" + copied + "筆" + (skipped ? "，跳過" + skipped + "筆（有休假）" : "") });
  }

  if (action === "add_leave") {
    const { employee_id, date, leave_type, half_day, note } = body;

    // 檢查是否已有排班
    const { data: existing } = await supabase.from("schedules")
      .select("id, type, shift_id").eq("employee_id", employee_id).eq("date", date).eq("type", "shift").limit(1);

    if (existing?.length) {
      if (leave_type === "rest") {
        // 已有排班 + 標休息日 → 標記為「休息日加班」（保留原班 + 推同意書）
        const { data, error } = await supabase.from("schedules").update({
          day_type: "rest_day", rest_consent: "pending",
        }).eq("id", existing[0].id).select("*, employees(name, line_uid), shifts(name, start_time, end_time)").single();
        if (error) return Response.json({ error: error.message }, { status: 500 });

        return Response.json({ data, message: "💰 已標記為休息日加班（發布後推同意書）" });
      }
      if (leave_type === "off") {
        return Response.json({ error: "⚠️ 此日已有排班，例假日不可工作。請先刪除排班再標記例假。" });
      }
      // 其他假別（特休/病假等）→ 刪除原排班，改為請假
      await supabase.from("schedules").delete().eq("id", existing[0].id);
    }

    // 無排班或已刪除原排班 → 新增假別
    const dayType = leave_type === "off" ? "regular_off" : leave_type === "rest" ? "rest_day" : "paid_leave";
    const { data, error } = await supabase.from("schedules").upsert({
      employee_id, date, type: "leave", leave_type, half_day, note,
      status: "confirmed", day_type: dayType,
    }, { onConflict: "employee_id,date" }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (action === "publish") {
    const { week_start, week_end, store_id } = body;
    let query = supabase.from("schedules").select("*, employees(name, line_uid), shifts(name, start_time, end_time), stores(name)").gte("date", week_start).lte("date", week_end).eq("published", false);
    if (store_id) query = query.eq("store_id", store_id);
    const { data: schedules } = await query;
    if (!schedules?.length) return Response.json({ message: "沒有待發布的排班", published: 0, notified: 0 });

    const byEmp = {};
    for (const s of schedules) {
      if (!byEmp[s.employee_id]) byEmp[s.employee_id] = { name: s.employees?.name, uid: s.employees?.line_uid, items: [] };
      byEmp[s.employee_id].items.push(s);
    }
    let notified = 0;
    const DAYS = ["日","一","二","三","四","五","六"];
    const leaveMap = { annual:"特休", sick:"病假", personal:"事假", menstrual:"生理假", off:"例假", rest:"休息日" };
    for (const info of Object.values(byEmp)) {
      if (!info.uid) continue;
      let msg = `📅 班表通知\n${week_start} ~ ${week_end}\n━━━━━━━━━━━━━━\n`;
      for (const s of info.items.sort((a,b) => a.date.localeCompare(b.date))) {
        const day = DAYS[new Date(s.date).getDay()];
        if (s.type === "leave") msg += `${s.date}（${day}）${leaveMap[s.leave_type]||s.leave_type}${s.half_day?`（${s.half_day==="am"?"上午":"下午"}）`:""}\n`;
        else msg += `${s.date}（${day}）${s.shifts?.name||""} ${s.shifts?.start_time?.slice(0,5)||""}~${s.shifts?.end_time?.slice(0,5)||""}\n`;
      }
      await pushText(info.uid, msg).catch(() => {});
      notified++;
    }
    await supabase.from("schedules").update({ published: true }).in("id", schedules.map(s => s.id));

    // 發布時推送休息日加班同意書（rest_consent=pending 的排班）
    let consentSent = 0;
    const restDayScheds = schedules.filter(s => s.day_type === "rest_day" && s.rest_consent === "pending" && s.type === "shift");
    if (restDayScheds.length > 0) {
      const { lineClient } = await import("@/lib/line");
      for (const s of restDayScheds) {
        if (!s.employees?.line_uid) continue;
        const day = DAYS[new Date(s.date).getDay()];
        const sh = s.shifts;
        const shiftStr = sh ? `${sh.name||""} ${(sh.start_time||"").slice(0,5)}~${(sh.end_time||"").slice(0,5)}` : "";
        try {
          await lineClient.pushMessage({ to: s.employees.line_uid, messages: [{
            type: "template", altText: "休息日加班同意書",
            template: { type: "buttons", title: "📅 休息日加班同意書",
              text: `${s.date}（${day}）休息日\n${shiftStr}\n\n依勞基法須經您同意才能加班`,
              actions: [
                { type: "postback", label: "✅ 同意加班", data: `action=rest_consent_accept&schedule_id=${s.id}` },
                { type: "postback", label: "❌ 拒絕", data: `action=rest_consent_decline&schedule_id=${s.id}` },
              ]
            }
          }]});
          consentSent++;
        } catch {}
      }
    }

    await auditLog(null, null, "schedule_publish", "schedule", null, { week_start, week_end, store_id, count: schedules.length, notified, consentSent });
    return Response.json({ published: schedules.length, notified, consentSent, message: consentSent > 0 ? `已推送 ${consentSent} 份休息日加班同意書` : undefined });
  }

  if (action === "delete") {
    const { schedule_id, attendance_mode } = body;
    const { count: attCount } = await supabase.from("attendances")
      .select("id", { count: "exact", head: true }).eq("schedule_id", schedule_id);
    // 有出勤紀錄且未指定處理方式 → 要求前端詢問後重送
    if ((attCount || 0) > 0 && !attendance_mode) {
      return Response.json({ needs_decision: true, attendance_count: attCount });
    }
    if (attendance_mode === "delete") {
      await supabase.from("attendances").delete().eq("schedule_id", schedule_id);
    } else {
      // keep（預設）：解除綁定保留打卡紀錄
      await supabase.from("attendances").update({ schedule_id: null }).eq("schedule_id", schedule_id);
    }
    await auditLog(null, null, "schedule_delete", "schedule", schedule_id,
      { attendance_mode: attendance_mode || "none", attendance_count: attCount || 0 });
    const { error } = await supabase.from("schedules").delete().eq("id", schedule_id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  // ✦16 班表範本：儲存
  if (action === "save_template") {
    const { name, store_id, template_data, created_by } = body;
    const { data, error } = await supabase.from("schedule_templates").insert({
      name, store_id, template_data, created_by
    }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  // ✦16 班表範本：套用
  if (action === "apply_template") {
    const { template_id, week_start } = body;
    const { data: tpl } = await supabase.from("schedule_templates").select("*").eq("id", template_id).single();
    if (!tpl) return Response.json({ error: "範本不存在" }, { status: 404 });
    let applied = 0;
    for (const entry of tpl.template_data || []) {
      const date = new Date(new Date(week_start).getTime() + entry.day_of_week * 86400000).toLocaleDateString("sv-SE");
      await supabase.from("schedules").upsert({
        employee_id: entry.employee_id, store_id: tpl.store_id, shift_id: entry.shift_id,
        date, type: entry.type || "shift", leave_type: entry.leave_type, status: "scheduled"
      }, { onConflict: "employee_id,date" });
      applied++;
    }
    return Response.json({ success: true, applied });
  }

  // ✦16 班表範本：列表
  if (action === "list_templates") {
    const { data } = await supabase.from("schedule_templates").select("*")
      .eq("store_id", body.store_id).order("created_at", { ascending: false });
    return Response.json({ data });
  }

  // ✦16 班表範本：刪除
  if (action === "delete_template") {
    await supabase.from("schedule_templates").delete().eq("id", body.template_id);
    return Response.json({ success: true });
  }

  // ✦17 調班申請
  if (action === "create_swap") {
    const { requester_id, target_id, date_a, date_b } = body;
    const { data } = await supabase.from("swap_requests").insert({
      requester_id, target_id, date_a, date_b
    }).select().single();
    return Response.json({ data });
  }

  if (action === "review_swap") {
    const { swap_id, status, approved_by } = body;
    const { data: swap } = await supabase.from("swap_requests").select("*").eq("id", swap_id).single();
    if (!swap) return Response.json({ error: "Not found" }, { status: 404 });

    if (status === "approved") {
      // 交換排班
      const { data: schA } = await supabase.from("schedules").select("*")
        .eq("employee_id", swap.requester_id).eq("date", swap.date_a).single();
      const { data: schB } = await supabase.from("schedules").select("*")
        .eq("employee_id", swap.target_id).eq("date", swap.date_b).single();
      if (schA && schB) {
        await supabase.from("schedules").update({ employee_id: swap.target_id }).eq("id", schA.id);
        await supabase.from("schedules").update({ employee_id: swap.requester_id }).eq("id", schB.id);
      }
    }
    await supabase.from("swap_requests").update({ status, approved_by, approved_at: new Date().toISOString() }).eq("id", swap_id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
