import { supabase } from "@/lib/supabase";
import { pushText } from "@/lib/line";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const store_id = searchParams.get("store_id");
  const month = searchParams.get("month");
  const week_start = searchParams.get("week_start");
  const week_end = searchParams.get("week_end");

  let query = supabase.from("schedules").select("*, employees(name, line_uid), shifts(name, start_time, end_time, role), stores(name)").order("date");
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

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();
  const { action } = body;

  if (action === "create") {
    const { employee_id, store_id, shift_id, date, type, leave_type, half_day, note } = body;

    // ✦03 一例一休檢核：排班前檢查連續工作天數
    if (type !== "leave") {
      const d = new Date(date);
      const checkStart = new Date(d.getTime() - 6 * 86400000).toLocaleDateString("sv-SE");
      const checkEnd = new Date(d.getTime() + 6 * 86400000).toLocaleDateString("sv-SE");
      const { data: nearby } = await supabase.from("schedules")
        .select("date, type")
        .eq("employee_id", employee_id)
        .gte("date", checkStart).lte("date", checkEnd)
        .order("date");
      // 計算含本次排班後的連續工作天數
      const workDates = new Set((nearby || []).filter(s => s.type !== "leave").map(s => s.date));
      workDates.add(date);
      let maxConsecutive = 0, curr = 0;
      for (let i = -6; i <= 6; i++) {
        const dd = new Date(d.getTime() + i * 86400000).toLocaleDateString("sv-SE");
        if (workDates.has(dd)) { curr++; maxConsecutive = Math.max(maxConsecutive, curr); }
        else { curr = 0; }
      }
      const warning = maxConsecutive >= 7
        ? "⚠️ 違反一例一休：連續工作" + maxConsecutive + "天（勞基法§36規定每7天至少1天例假+1天休息日）"
        : maxConsecutive === 6
        ? "⚠️ 注意：已連續排班6天，再排1天將違反一例一休"
        : null;

      // 不硬擋，但回傳警示
      const { data, error } = await supabase.from("schedules").upsert({
        employee_id, store_id: store_id || null, shift_id: shift_id || null, date,
        type: type || "shift", leave_type, half_day, note, status: "scheduled",
      }, { onConflict: "employee_id,date" }).select("*, employees(name), shifts(name, start_time, end_time)").single();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ data, warning });
    }

    const { data, error } = await supabase.from("schedules").upsert({
      employee_id, store_id: store_id || null, shift_id: shift_id || null, date,
      type: type || "shift", leave_type, half_day, note, status: "scheduled",
    }, { onConflict: "employee_id,date" }).select("*, employees(name), shifts(name, start_time, end_time)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (action === "add_leave") {
    const { employee_id, date, leave_type, half_day, note } = body;
    const { data, error } = await supabase.from("schedules").upsert({
      employee_id, date, type: "leave", leave_type, half_day, note, status: "confirmed",
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
    return Response.json({ published: schedules.length, notified });
  }

  if (action === "delete") {
    await supabase.from("schedules").delete().eq("id", body.schedule_id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
