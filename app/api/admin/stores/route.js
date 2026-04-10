import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}
