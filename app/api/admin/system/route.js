import { supabase } from "@/lib/supabase";

export async function GET(request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return Response.json({ error: "Missing key" }, { status: 400 });
  const { data } = await supabase.from("system_settings").select("*").eq("key", key).single();
  return Response.json({ data: data ? data.value : null });
}

export async function POST(request) {
  const body = await request.json();
  const { key, value } = body;
  if (!key) return Response.json({ error: "Missing key" }, { status: 400 });
  const { data, error } = await supabase.from("system_settings").upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  ).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}
