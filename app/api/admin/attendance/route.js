import { supabase } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // records or settings
  const store_id = searchParams.get("store_id");
  const month = searchParams.get("month");
  const date = searchParams.get("date");

  if (type === "settings") {
    const { data } = await supabase.from("attendance_settings").select("*").limit(1).single();
    return Response.json({ data });
  }

  // 出勤紀錄
  let query = supabase.from("attendances").select("*, employees(name), stores(name), shifts(name)").order("timestamp", { ascending: false });
  if (store_id) query = query.eq("store_id", store_id);
  if (month) {
    const start = `${month}-01T00:00:00`;
    const end = `${month}-31T23:59:59`;
    query = query.gte("timestamp", start).lte("timestamp", end);
  }
  if (date) {
    query = query.gte("timestamp", `${date}T00:00:00`).lte("timestamp", `${date}T23:59:59`);
  }

  const { data, error } = await query.limit(200);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();

  // 更新打卡設定
  if (body.action === "update_settings") {
    const { late_grace_minutes, late_threshold_minutes, early_leave_minutes, overtime_min_minutes, require_photo, work_hours_per_day, work_hours_per_week } = body;
    const updates = {};
    if (late_grace_minutes !== undefined) updates.late_grace_minutes = late_grace_minutes;
    if (late_threshold_minutes !== undefined) updates.late_threshold_minutes = late_threshold_minutes;
    if (early_leave_minutes !== undefined) updates.early_leave_minutes = early_leave_minutes;
    if (overtime_min_minutes !== undefined) updates.overtime_min_minutes = overtime_min_minutes;
    if (require_photo !== undefined) updates.require_photo = require_photo;
    if (work_hours_per_day !== undefined) updates.work_hours_per_day = work_hours_per_day;
    if (work_hours_per_week !== undefined) updates.work_hours_per_week = work_hours_per_week;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from("attendance_settings").update(updates).not("id", "is", null).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (body.action === "delete") {
    const { attendance_id } = body;
    const { error } = await supabase.from("attendances").delete().eq("id", attendance_id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
