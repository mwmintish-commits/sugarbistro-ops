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

  // 更新 resignation
  const { error: upErr } = await supabase.from("resignations").update({
    status: "signed",
    signed_at: new Date().toISOString(),
    signature_url: signatureUrl,
    signer_ip: signerIp,
  }).eq("id", r.id);
  if (upErr) return Response.json({ error: upErr.message }, { status: 500 });

  // 連動：停用員工帳號 + 清 LINE 綁定 + 寫 resignation_date / last_working_date
  await supabase.from("employees").update({
    is_active: false,
    line_uid: null,
    resignation_date: r.last_working_date,
    last_working_date: r.last_working_date,
  }).eq("id", r.employee_id);

  // 建立特休結算撥款（若 settlement_amount > 0 且還沒建過）
  if (r.settlement_amount > 0) {
    try {
      const { data: pm } = await supabase.from("payments").insert({
        type: "leave_settlement",
        employee_id: r.employee_id,
        amount: r.settlement_amount,
        recipient: r.employee_name,
        notes: "離職特休結算 " + r.annual_leave_remaining_days + " 天（簽署完成）",
        month_key: r.last_working_date.slice(0, 7),
      }).select().single();
      if (pm) {
        await supabase.from("resignations").update({ settlement_payment_id: pm.id }).eq("id", r.id);
      }
    } catch (e) { console.error("payment create on resignation sign failed:", e?.message); }
  }

  // 通知 admin
  try {
    const { data: adm } = await supabase.from("employees")
      .select("line_uid, name").eq("role", "admin").eq("is_active", true);
    for (const a of adm || []) {
      if (a.line_uid) {
        await pushText(a.line_uid,
          `✅ 離職同意書已簽署\n👤 ${r.employee_name}（${r.store_name || ""}）\n📅 離職日：${r.last_working_date}\n💰 特休結算：$${(r.settlement_amount || 0).toLocaleString()}`
        ).catch(() => {});
      }
    }
  } catch {}

  auditLog(r.employee_id, r.employee_name, "sign", "resignations", r.id, { last_working_date: r.last_working_date }).catch(() => {});
  return Response.json({ success: true });
}
