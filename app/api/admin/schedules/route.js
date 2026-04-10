import { supabase } from "@/lib/supabase";
import { pushText } from "@/lib/line";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const store_id = searchParams.get("store_id");
  const month = searchParams.get("month");
  const week_start = searchParams.get("week_start");
  const week_end = searchParams.get("week_end");

  let query = supabase.from("schedules").select("*, employees(name, line_uid), shifts(name, start_time, end_time), stores(name)").order("date");

  if (store_id) query = query.eq("store_id", store_id);
  if (month) query = query.gte("date", `${month}-01`).lte("date", `${month}-31`);
  if (week_start && week_end) query = query.gte("date", week_start).lte("date", week_end);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();
  const { action } = body;

  // 新增單筆排班
  if (action === "create") {
    const { employee_id, store_id, shift_id, date } = body;
    const { data, error } = await supabase.from("schedules").upsert({
      employee_id, store_id, shift_id, date, status: "scheduled",
    }, { onConflict: "employee_id,date" }).select("*, employees(name), shifts(name, start_time, end_time)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  // 批次排班（整週）
  if (action === "bulk_create") {
    const { schedules } = body; // [{employee_id, store_id, shift_id, date}, ...]
    const { data, error } = await supabase.from("schedules").upsert(
      schedules.map(s => ({ ...s, status: "scheduled" })),
      { onConflict: "employee_id,date" }
    ).select("*, employees(name), shifts(name)");
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data, count: data?.length });
  }

  // 發布排班（通知員工）
  if (action === "publish") {
    const { week_start, week_end, store_id } = body;
    let query = supabase.from("schedules").select("*, employees(name, line_uid), shifts(name, start_time, end_time), stores(name)").gte("date", week_start).lte("date", week_end).eq("published", false);
    if (store_id) query = query.eq("store_id", store_id);
    const { data: schedules } = await query;

    if (!schedules || schedules.length === 0) return Response.json({ message: "沒有待發布的排班" });

    // 按員工分組
    const byEmployee = {};
    for (const s of schedules) {
      const eid = s.employee_id;
      if (!byEmployee[eid]) byEmployee[eid] = { name: s.employees?.name, line_uid: s.employees?.line_uid, shifts: [] };
      byEmployee[eid].shifts.push(s);
    }

    // 推播給每位員工
    let notified = 0;
    for (const [eid, info] of Object.entries(byEmployee)) {
      if (!info.line_uid) continue;
      let msg = `📅 班表通知\n${week_start} ~ ${week_end}\n━━━━━━━━━━━━━━\n`;
      for (const s of info.shifts.sort((a, b) => a.date.localeCompare(b.date))) {
        const day = ["日", "一", "二", "三", "四", "五", "六"][new Date(s.date).getDay()];
        msg += `${s.date}（${day}）${s.shifts?.name} ${s.shifts?.start_time?.slice(0, 5)}~${s.shifts?.end_time?.slice(0, 5)}\n`;
      }
      await pushText(info.line_uid, msg).catch(() => {});
      notified++;
    }

    // 標記已發布
    const ids = schedules.map(s => s.id);
    await supabase.from("schedules").update({ published: true }).in("id", ids);

    return Response.json({ published: schedules.length, notified });
  }

  // 刪除排班
  if (action === "delete") {
    const { schedule_id } = body;
    await supabase.from("schedules").delete().eq("id", schedule_id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
