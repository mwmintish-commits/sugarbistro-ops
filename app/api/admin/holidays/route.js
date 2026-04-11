import { supabase } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year") || new Date().getFullYear();
  const month = searchParams.get("month");

  let query = supabase.from("national_holidays").select("*").eq("year", year).order("date");
  if (month) query = query.gte("date", month + "-01").lte("date", month + "-31");

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}
