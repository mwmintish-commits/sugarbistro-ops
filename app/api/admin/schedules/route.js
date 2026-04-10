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
