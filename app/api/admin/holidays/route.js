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
    return Response.json({ data });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
