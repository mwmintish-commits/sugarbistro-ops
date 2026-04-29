import { supabase, eom, auditLog } from "@/lib/supabase";
import { pushText } from "@/lib/line";
import { getStoreManagers } from "@/lib/notify";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const employee_id = searchParams.get("employee_id");
  const month = searchParams.get("month");

  const request_type = searchParams.get("request_type");

  // 明確指定走 employee_id FK（leave_requests 還有 reviewed_by FK 指向 employees，不指明會 500）
  let query = supabase.from("leave_requests").select("*, employees!leave_requests_employee_id_fkey(name, store_id, line_uid, stores!store_id(name))").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (employee_id) query = query.eq("employee_id", employee_id);
  if (month) query = query.gte("start_date", `${month}-01`).lte("start_date", `${eom(month)}`);
  // 預設排除 unavailable 回報（availability reporting 走獨立 API）
  if (request_type) query = query.eq("request_type", request_type);
  else query = query.neq("request_type", "unavailable");

  const { data, error } = await query.limit(100);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const store_id = searchParams.get("store_id");
  const filtered = store_id ? (data || []).filter(l => l.employees && l.employees.store_id === store_id) : data;
  return Response.json({ data: filtered });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "create") {
    const { employee_id, leave_type, start_date, end_date, half_day, reason, request_type } = body;
    const { data, error } = await supabase.from("leave_requests").insert({
      employee_id, leave_type, start_date, end_date: end_date || start_date,
      half_day: half_day || null, reason,
      request_type: request_type || "leave",
      status: "pending",
    }).select("*, employees(name, store_id)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });

    // 分層通知：該店店長 + 區經理（不再推總部 admin）
    const recipients = await getStoreManagers(supabase, data.employees?.store_id);
    const typeMap = { annual: "特休", sick: "病假", personal: "事假", menstrual: "生理假", official: "公假", off: "例假", rest: "休息日", comp_time: "補休" };
    const label = request_type === "pre_arranged" ? "📆 預排假申請" : "🙋 請假申請";
    for (const a of recipients) {
      await pushText(a.line_uid, `${label}\n👤 ${data.employees?.name}\n📋 ${typeMap[leave_type] || leave_type}\n📅 ${start_date}${end_date && end_date !== start_date ? ` ~ ${end_date}` : ""}${half_day ? `（${half_day === "am" ? "上午" : "下午"}半天）` : ""}\n💬 ${reason || "無"}\n\n請到後台審核`).catch(() => {});
    }
    return Response.json({ data });
  }

  if (body.action === "batch_create") {
    const { employee_id, dates, leave_type, half_day, reason } = body;
    const results = [];
    for (const date of (dates || [])) {
      const { data, error } = await supabase.from("leave_requests").insert({
        employee_id, leave_type, start_date: date, end_date: date,
        half_day: half_day || null, reason: reason || "預排假申請",
        request_type: "pre_arranged", status: "pending",
      }).select("id").single();
      if (!error && data) results.push(data);
    }
    const { data: emp } = await supabase.from("employees").select("name, store_id").eq("id", employee_id).single();
    if (emp) {
      const recipients = await getStoreManagers(supabase, emp.store_id);
      const typeMap = { annual: "特休", sick: "病假", personal: "事假", off: "例假", rest: "休息日", comp_time: "補休" };
      const sorted = [...(dates || [])].sort();
      const dateList = sorted.length <= 5 ? sorted.join("、") : sorted.slice(0, 5).join("、") + ` 等 ${sorted.length} 天`;
      for (const a of recipients) {
        await pushText(a.line_uid, `📆 預排假申請\n👤 ${emp.name}\n📋 ${typeMap[leave_type] || leave_type}\n📅 ${dateList}\n💬 ${reason || "無"}\n\n請到後台審核`).catch(() => {});
      }
    }
    return Response.json({ data: results });
  }

  if (body.action === "review") {
    const { request_id, status, reviewed_by } = body;
    const { data, error } = await supabase.from("leave_requests").update({
      status, reviewed_by, reviewed_at: new Date().toISOString(),
    }).eq("id", request_id).select("*, employees(name, line_uid)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    await auditLog(reviewed_by, null, "leave_" + status, "leave", request_id, { employee: data?.employees?.name, leave_type: data?.leave_type, start: data?.start_date, end: data?.end_date });

    if (data?.employees?.line_uid) {
      const emoji = status === "approved" ? "✅" : "❌";
      await pushText(data.employees.line_uid, `${emoji} 你的${status === "approved" ? "休假已核准" : "休假被駁回"}\n📅 ${data.start_date}${data.end_date !== data.start_date ? ` ~ ${data.end_date}` : ""}${data.half_day ? `（${data.half_day === "am" ? "上午" : "下午"}）` : ""}`).catch(() => {});
    }

    if (status === "approved") {
      // day_type 依假別決定
      const UNPAID = ["personal", "family_care"];
      const HALF_PAY = ["sick", "menstrual"];
      const dayType = UNPAID.includes(data.leave_type) ? "unpaid_leave"
        : HALF_PAY.includes(data.leave_type) ? "half_pay_leave" : "paid_leave";
      const leaveHrs = Number(data.leave_hours || 0);
      const isPartial = leaveHrs > 0 && leaveHrs < 8;

      let current = new Date(data.start_date);
      const end = new Date(data.end_date);
      while (current <= end) {
        const dateStr = current.toLocaleDateString("sv-SE");
        if (isPartial) {
          // 部分請假：保留原排班 day_type=work，只記 leave_hours + leave_type
          await supabase.from("schedules").update({
            leave_hours: leaveHrs, leave_type: data.leave_type,
          }).eq("employee_id", data.employee_id).eq("date", dateStr).catch(() => {});
        } else {
          // 整天或半天請假：覆蓋排班
          await supabase.from("schedules").upsert({
            employee_id: data.employee_id, date: dateStr, type: "leave",
            leave_type: data.leave_type, half_day: data.half_day, note: data.reason,
            leave_hours: data.half_day ? 4 : 8,
            status: "confirmed", day_type: dayType,
          }, { onConflict: "employee_id,date" }).catch(() => {});
        }
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
