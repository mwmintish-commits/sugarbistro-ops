import { supabase, eom } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year") || new Date().getFullYear();
  const month = searchParams.get("month");

  let query = supabase.from("national_holidays").select("*").eq("year", year).order("date");
  if (month) query = query.gte("date", month + "-01").lte("date", eom(month));

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "toggle") {
    const { holiday_id, is_active } = body;
    const { data, error } = await supabase.from("national_holidays")
      .update({ is_active }).eq("id", holiday_id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });

    // 同步更新該日既有班表的 day_type（僅針對排班，不動休假）
    let synced = 0;
    if (data?.date) {
      if (is_active) {
        // 啟用：work → national_holiday
        const { data: upd } = await supabase.from("schedules")
          .update({ day_type: "national_holiday" })
          .eq("date", data.date).eq("type", "shift").eq("day_type", "work").select("id");
        synced = (upd || []).length;
      } else {
        // 停用：national_holiday → work
        const { data: upd } = await supabase.from("schedules")
          .update({ day_type: "work" })
          .eq("date", data.date).eq("type", "shift").eq("day_type", "national_holiday").select("id");
        synced = (upd || []).length;
      }
    }
    return Response.json({ data, synced });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
