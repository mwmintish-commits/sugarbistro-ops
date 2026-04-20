import { supabase, eom } from "@/lib/supabase";
import { pushText } from "@/lib/line";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const employee_id = searchParams.get("employee_id");
  const store_id = searchParams.get("store_id");

  let query = supabase
    .from("leave_requests")
    .select("*, employees(name, store_id, employment_type, stores!store_id(name))")
    .eq("request_type", "unavailable")
    .order("start_date");

  if (month) query = query.gte("start_date", `${month}-01`).lte("start_date", eom(month));
  if (employee_id) query = query.eq("employee_id", employee_id);

  const { data, error } = await query.limit(500);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const filtered = store_id
    ? (data || []).filter(r => r.employees?.store_id === store_id)
    : data;

  return Response.json({ data: filtered });
}

export async function POST(request) {
  const body = await request.json();

  // 儲存員工不可出勤回報（先清除該月舊資料，再整批插入）
  if (body.action === "save") {
    const { employee_id, month, slots, notes } = body;
    // slots: [{ date, half_day }]  half_day: null=整天, 'am'=上午, 'pm'=下午

    // 刪除該員工該月舊回報
    await supabase.from("leave_requests")
      .delete()
      .eq("employee_id", employee_id)
      .eq("request_type", "unavailable")
      .gte("start_date", `${month}-01`)
      .lte("start_date", eom(month));

    if ((slots || []).length > 0) {
      const rows = slots.map(({ date, half_day }) => ({
        employee_id,
        leave_type: "unavailable",
        start_date: date,
        end_date: date,
        half_day: half_day || null,
        reason: notes || null,
        request_type: "unavailable",
        status: "noted",
      }));
      const { error } = await supabase.from("leave_requests").insert(rows);
      if (error) return Response.json({ error: error.message }, { status: 500 });
    }

    // 通知門市主管/管理員
    const { data: emp } = await supabase.from("employees")
      .select("name, store_id").eq("id", employee_id).single();
    const { data: managers } = await supabase.from("employees")
      .select("line_uid")
      .in("role", ["admin", "manager", "store_manager"])
      .eq("is_active", true);

    if (emp && managers && (slots || []).length > 0) {
      const halfMap = { am: "上午", pm: "下午" };
      const sorted = [...slots].sort((a, b) => a.date.localeCompare(b.date));
      const preview = sorted.slice(0, 5).map(s => {
        const d = s.date.slice(5); // MM-DD
        return s.half_day ? `${d}(${halfMap[s.half_day]})` : d;
      }).join("、");
      const suffix = sorted.length > 5 ? ` 等共 ${sorted.length} 天` : "";
      for (const mgr of managers) {
        if (mgr.line_uid) await pushText(mgr.line_uid,
          `📋 不可出勤回報\n👤 ${emp.name}\n📅 ${month}\n❌ ${preview}${suffix}\n💬 ${notes || "無備註"}`
        ).catch(() => {});
      }
    }

    return Response.json({ ok: true, count: (slots || []).length });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
