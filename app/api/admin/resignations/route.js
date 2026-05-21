import crypto from "crypto";
import { supabase, auditLog } from "@/lib/supabase";
import { pushText, lineClient } from "@/lib/line";

// 預告期計算（勞基法 §16）
function calcNoticeDays(serviceMonths) {
  if (!serviceMonths || serviceMonths < 3) return 0;
  if (serviceMonths < 12) return 10;
  if (serviceMonths < 36) return 20;
  return 30;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const employee_id = searchParams.get("employee_id");
  const status = searchParams.get("status");

  if (id) {
    const { data, error } = await supabase.from("resignations")
      .select("*, employees(name, role)").eq("id", id).maybeSingle();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  let q = supabase.from("resignations").select("*").order("created_at", { ascending: false });
  if (employee_id) q = q.eq("employee_id", employee_id);
  if (status) q = q.eq("status", status);
  const { data, error } = await q.limit(200);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();
  const SITE = process.env.SITE_URL || "https://sugarbistro-ops.zeabur.app";

  if (body.action === "create") {
    const {
      employee_id, resignation_type, last_working_date, reason,
      additional_notes, settlement_override, notice_days_override,
      created_by,
    } = body;

    if (!employee_id || !last_working_date) {
      return Response.json({ error: "缺少必要欄位（員工、最後工作日）" }, { status: 400 });
    }

    // 取得員工完整資料
    const { data: emp } = await supabase.from("employees")
      .select("*, stores!store_id(name)").eq("id", employee_id).maybeSingle();
    if (!emp) return Response.json({ error: "找不到員工" }, { status: 404 });

    // 計算年資、預告期、未休特休、結算金額
    const months = emp.hire_date
      ? (new Date().getFullYear() - new Date(emp.hire_date).getFullYear()) * 12
        + (new Date().getMonth() - new Date(emp.hire_date).getMonth())
      : 0;
    const noticeDays = notice_days_override != null ? Number(notice_days_override) : calcNoticeDays(months);

    const year = new Date().getFullYear();
    const { data: balance } = await supabase.from("leave_balances")
      .select("annual_remaining").eq("employee_id", employee_id).eq("year", year).maybeSingle();
    const remaining = Number(balance?.annual_remaining || 0);
    const dailyPay = emp.monthly_salary ? Math.round(emp.monthly_salary / 30)
      : (emp.hourly_rate ? Number(emp.hourly_rate) * 8 : 0);
    const settlementAmount = settlement_override != null
      ? Number(settlement_override) : Math.round(remaining * dailyPay);

    // 檢查是否已有未完成的離職單
    const { data: existing } = await supabase.from("resignations")
      .select("id, status").eq("employee_id", employee_id).in("status", ["pending"]).maybeSingle();
    if (existing) {
      return Response.json({ error: "此員工已有待簽署的離職單（id: " + existing.id + "），請先處理或取消" }, { status: 400 });
    }

    const token = crypto.randomBytes(24).toString("hex");
    const { data: r, error: insErr } = await supabase.from("resignations").insert({
      employee_id, employee_name: emp.name, employee_id_number: emp.id_number,
      store_id: emp.store_id, store_name: emp.stores?.name, hire_date: emp.hire_date,
      resignation_type: resignation_type || "voluntary",
      last_working_date, reason: reason || "",
      service_months: months, notice_days: noticeDays,
      annual_leave_remaining_days: remaining,
      settlement_amount: settlementAmount,
      additional_notes: additional_notes || "",
      token, status: "pending",
      created_by: created_by || null,
    }).select().single();
    if (insErr) return Response.json({ error: insErr.message }, { status: 500 });

    // 推送 LINE 給員工，含簽署連結
    const signUrl = `${SITE}/resignation-sign?token=${token}`;
    if (emp.line_uid) {
      try {
        await lineClient.pushMessage({
          to: emp.line_uid,
          messages: [{
            type: "template", altText: "離職同意書簽署",
            template: {
              type: "buttons", title: "📋 離職同意書",
              text: `${emp.name} 您好\n離職日：${last_working_date}\n請點下方按鈕線上簽署`,
              actions: [{ type: "uri", label: "開啟簽署頁", uri: signUrl }],
            },
          }],
        });
      } catch (e) { console.error("LINE push resignation failed:", e?.message); }
    }

    auditLog(created_by, null, "create", "resignations", r.id, { employee_id, last_working_date }).catch(() => {});
    return Response.json({ success: true, data: r, sign_url: signUrl });
  }

  if (body.action === "cancel") {
    const { resignation_id, cancel_reason, cancelled_by } = body;
    if (!resignation_id) return Response.json({ error: "缺少 resignation_id" }, { status: 400 });
    const { data: r } = await supabase.from("resignations").select("status").eq("id", resignation_id).maybeSingle();
    if (!r) return Response.json({ error: "找不到離職單" }, { status: 404 });
    if (r.status !== "pending") return Response.json({ error: "只能取消「待簽署」的離職單" }, { status: 400 });
    const { error } = await supabase.from("resignations").update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: cancelled_by || null,
      cancel_reason: cancel_reason || "",
    }).eq("id", resignation_id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  if (body.action === "resend") {
    const { resignation_id } = body;
    if (!resignation_id) return Response.json({ error: "缺少 resignation_id" }, { status: 400 });
    const { data: r } = await supabase.from("resignations")
      .select("*, employees(line_uid, name)").eq("id", resignation_id).maybeSingle();
    if (!r) return Response.json({ error: "找不到離職單" }, { status: 404 });
    if (r.status !== "pending") return Response.json({ error: "只能重發「待簽署」的離職單" }, { status: 400 });
    if (!r.employees?.line_uid) return Response.json({ error: "員工未綁定 LINE，無法推送" }, { status: 400 });
    const signUrl = `${SITE}/resignation-sign?token=${r.token}`;
    try {
      await lineClient.pushMessage({
        to: r.employees.line_uid,
        messages: [{
          type: "template", altText: "離職同意書（提醒）",
          template: {
            type: "buttons", title: "📋 離職同意書（提醒）",
            text: `${r.employee_name} 您好\n離職日：${r.last_working_date}\n請盡快線上簽署`,
            actions: [{ type: "uri", label: "開啟簽署頁", uri: signUrl }],
          },
        }],
      });
    } catch (e) { return Response.json({ error: "LINE 推送失敗：" + e.message }, { status: 500 }); }
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
