import { supabase, auditLog } from "@/lib/supabase";
import { pushText } from "@/lib/line";

// 員工簽署用 API（不需後台登入，靠 token）

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return Response.json({ error: "Missing token" }, { status: 400 });
  const { data, error } = await supabase.from("resignations")
    .select("id, employee_name, employee_id_number, store_name, hire_date, resignation_type, last_working_date, reason, service_months, notice_days, annual_leave_remaining_days, settlement_amount, additional_notes, status, signed_at")
    .eq("token", token).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Invalid token" }, { status: 404 });
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();
  if (body.action !== "sign") return Response.json({ error: "Unknown action" }, { status: 400 });

  const { token, signature_base64 } = body;
  if (!token || !signature_base64) return Response.json({ error: "缺少 token 或簽名" }, { status: 400 });

  const { data: r } = await supabase.from("resignations")
    .select("id, employee_id, employee_name, store_name, last_working_date, settlement_amount, annual_leave_remaining_days, status")
    .eq("token", token).maybeSingle();
  if (!r) return Response.json({ error: "Invalid token" }, { status: 404 });
  if (r.status === "signed") return Response.json({ error: "此離職單已簽署完成" }, { status: 400 });
  if (r.status === "cancelled") return Response.json({ error: "此離職單已被取消" }, { status: 400 });

  // 上傳簽名圖
  let signatureUrl = "";
  try {
    const cleanBase64 = signature_base64.replace(/^data:image\/[a-z]+;base64,/, "");
    const buf = Buffer.from(cleanBase64, "base64");
    const path = `resignations/${r.id}_${Date.now()}.png`;
    await supabase.storage.from("receipts").upload(path, buf, { contentType: "image/png", upsert: true });
    signatureUrl = supabase.storage.from("receipts").getPublicUrl(path).data.publicUrl;
  } catch (e) {
    return Response.json({ error: "簽名上傳失敗：" + e.message }, { status: 500 });
  }

  const signerIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "";

  // 更新 resignation：只記錄簽名，**不動 employees、不建撥款**
  // 員工權限解除留待 /api/cron/process-resignations 在離職日次日 00:00 處理；
  // 薪資與特休結算為獨立流程，由 admin 走撥款 / 薪資 Tab 處理
  const { error: upErr } = await supabase.from("resignations").update({
    status: "signed",
    signed_at: new Date().toISOString(),
    signature_url: signatureUrl,
    signer_ip: signerIp,
  }).eq("id", r.id);
  if (upErr) return Response.json({ error: upErr.message }, { status: 500 });

  // 員工 resignation_date 寫一下方便後台查看（不停用、不清 line_uid）
  try {
    await supabase.from("employees").update({
      resignation_date: r.last_working_date,
      last_working_date: r.last_working_date,
    }).eq("id", r.employee_id);
  } catch {}

  // 通知 admin
  try {
    const { data: adm } = await supabase.from("employees")
      .select("line_uid, name").eq("role", "admin").eq("is_active", true);
    for (const a of adm || []) {
      if (a.line_uid) {
        await pushText(a.line_uid,
          `✅ 離職同意書已簽署\n👤 ${r.employee_name}（${r.store_name || ""}）\n📅 預計最後工作日：${r.last_working_date}\n⏳ 系統將於該日次日 00:00 自動解除 LINE 權限`
        ).catch(() => {});
      }
    }
  } catch {}

  auditLog(r.employee_id, r.employee_name, "sign", "resignations", r.id, { last_working_date: r.last_working_date }).catch(() => {});
  return Response.json({ success: true });
}
