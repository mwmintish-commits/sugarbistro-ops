import { supabase } from "@/lib/supabase";

export async function GET(request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return Response.json({ error: "Missing key" }, { status: 400 });
  const { data, error } = await supabase.from("system_settings").select("*").eq("key", key).maybeSingle();
  return Response.json({ data: data || null });
}

export async function POST(request) {
  const body = await request.json();

  // 一鍵清除
  if (body.action === "cleanup") {
    const map = {
      schedules: ["schedules"],
      worklogs: ["work_log_items", "work_logs", "incident_reports"],
      expenses: ["payments", "expenses"],
      settlements: ["settlement_receipts", "voucher_serials", "daily_settlements"],
      deposits: ["deposits"],
      attendance: ["attendances", "clock_amendments", "attendance_alerts", "attendance_monthly_reports"],
      overtime: ["overtime_records", "overtime_applications"],
    };
    const tables = map[body.target];
    if (!tables) return Response.json({ error: "Unknown target" }, { status: 400 });
    let total = 0;
    for (const t of tables) {
      const { error, count } = await supabase.from(t).delete().not("id", "is", null);
      if (!error) total += count || 0;
    }
    return Response.json({ success: true, deleted: total, tables });
  }

  // key-value 儲存
  const { key, value } = body;
  if (!key) return Response.json({ error: "Missing key" }, { status: 400 });
  const { data, error } = await supabase.from("system_settings").upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  ).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}
