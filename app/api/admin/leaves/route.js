import { supabase } from "@/lib/supabase";
import { pushText } from "@/lib/line";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const employee_id = searchParams.get("employee_id");
  const month = searchParams.get("month");

  let query = supabase.from("leave_requests").select("*, employees(name, store_id, line_uid, stores(name))").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (employee_id) query = query.eq("employee_id", employee_id);
  if (month) query = query.gte("start_date", `${month}-01`).lte("start_date", `${month}-31`);

  const { data, error } = await query.limit(100);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const store_id = searchParams.get("store_id");
  const filtered = store_id ? (data || []).filter(l => l.employees && l.employees.store_id === store_id) : data;
  return Response.json({ data: filtered });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "create") {
    const { employee_id, leave_type, start_date, end_date, half_day, reason } = body;
    const { data, error } = await supabase.from("leave_requests").insert({
      employee_id, leave_type, start_date, end_date: end_date || start_date,
      half_day: half_day || null, reason,
    }).select("*, employees(name)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });

    const { data: admins } = await supabase.from("employees").select("line_uid").in("role", ["admin", "manager"]).eq("is_active", true);
    if (admins) {
      const typeMap = { annual: "特休", sick: "病假", personal: "事假", menstrual: "生理假", official: "公假" };
      for (const a of admins) {
        if (a.line_uid) await pushText(a.line_uid, `🙋 預休假申請\n👤 ${data.employees?.name}\n📋 ${typeMap[leave_type] || leave_type}\n📅 ${start_date}${end_date && end_date !== start_date ? ` ~ ${end_date}` : ""}${half_day ? `（${half_day === "am" ? "上午" : "下午"}半天）` : ""}\n💬 ${reason || "無"}\n\n請到後台審核`).catch(() => {});
      }
    }
    return Response.json({ data });
  }

  if (body.action === "review") {
    const { request_id, status, reviewed_by } = body;
    const { data, error } = await supabase.from("leave_requests").update({
      status, reviewed_by, reviewed_at: new Date().toISOString(),
    }).eq("id", request_id).select("*, employees(name, line_uid)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });

    if (data?.employees?.line_uid) {
      const emoji = status === "approved" ? "✅" : "❌";
      await pushText(data.employees.line_uid, `${emoji} 你的${status === "approved" ? "休假已核准" : "休假被駁回"}\n📅 ${data.start_date}${data.end_date !== data.start_date ? ` ~ ${data.end_date}` : ""}${data.half_day ? `（${data.half_day === "am" ? "上午" : "下午"}）` : ""}`).catch(() => {});
    }

    if (status === "approved") {
      let current = new Date(data.start_date);
      const end = new Date(data.end_date);
      while (current <= end) {
        const dateStr = current.toLocaleDateString("sv-SE");
        await supabase.from("schedules").upsert({
          employee_id: data.employee_id, date: dateStr, type: "leave",
          leave_type: data.leave_type, half_day: data.half_day, note: data.reason,
          status: "confirmed",
        }, { onConflict: "employee_id,date" }).catch(() => {});
        current.setDate(current.getDate() + 1);
      }

      // 補休核准：扣除最早到期的補休時數
      if (data.leave_type === "comp_time") {
        const days = data.half_day ? 0.5
          : Math.ceil((new Date(data.end_date) - new Date(data.start_date)) / 86400000) + 1;
        const hoursNeeded = days * 8;
        let remaining = hoursNeeded;
        const today = new Date().toLocaleDateString("sv-SE");

        const { data: compRecords } = await supabase.from("overtime_records")
          .select("id, comp_hours")
          .eq("employee_id", data.employee_id).eq("status", "approved")
          .eq("comp_type", "comp").eq("comp_used", false).eq("comp_converted", false)
          .gte("comp_expiry_date", today)
          .order("comp_expiry_date"); // 先用最早到期的

        for (const cr of compRecords || []) {
          if (remaining <= 0) break;
          await supabase.from("overtime_records")
            .update({ comp_used: true }).eq("id", cr.id);
          remaining -= Number(cr.comp_hours || 0);
        }
      }
    }
    return Response.json({ data });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
