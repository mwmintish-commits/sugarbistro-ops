import crypto from "crypto";
import { supabase } from "@/lib/supabase";
import { pushText } from "@/lib/line";

async function sendContractEmail(email, name, storeName, signedAt) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) { console.log("No RESEND_API_KEY, skip email"); return; }
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({
        from: "小食糖 <noreply@sugarbistro.tw>",
        to: email,
        subject: "【小食糖】員工行為規範與工作守則 - 簽署確認書",
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2 style="text-align:center">🍯 小食糖 SUGARbISTRO</h2>
          <h3 style="text-align:center">員工行為規範與工作守則 - 簽署確認書</h3>
          <hr/>
          <p><b>員工姓名：</b>${name}</p>
          <p><b>所屬門市：</b>${storeName}</p>
          <p><b>簽署時間：</b>${new Date(signedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}</p>
          <hr/>
          <p>本人已詳細閱讀「小食糖 SUGARbISTRO 員工行為規範與工作守則」全文，瞭解並同意遵守所有規定。</p>
          <p style="color:#888;font-size:12px">此為系統自動發送之簽署確認副本，正本由總部存檔。</p>
        </div>`,
      }),
    });
  } catch (e) { console.error("Email error:", e); }
}

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return Response.json({ error: "Missing token" }, { status: 400 });
  const { data } = await supabase.from("onboarding_records").select("*").eq("token", token).single();
  if (!data) return Response.json({ error: "Invalid token" }, { status: 404 });
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "sign") {
    const { token, signature_name, birthday, id_number, phone, email, emergency_contact, emergency_phone, emergency_relation } = body;

    const signedAt = new Date().toISOString();
    const { data: record, error } = await supabase.from("onboarding_records").update({
      handbook_read: true, signed_at: signedAt, signature_name,
      birthday, id_number, phone, email, emergency_contact, emergency_phone, emergency_relation,
      status: "signed",
    }).eq("token", token).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });

    // 建立員工帳號（待啟用，總部核發權限）
    const { data: emp } = await supabase.from("employees").insert({
      name: record.name, phone, email, store_id: record.store_id, role: "staff",
      birthday, id_number, emergency_contact, emergency_phone, emergency_relation,
      employment_type: record.employment_type || "regular",
      hire_date: new Date().toLocaleDateString("sv-SE"),
      contract_signed: true, contract_signed_at: signedAt,
      onboarding_id: record.id, line_uid: record.line_uid,
      is_active: false, // 待總部啟用
    }).select().single();

    if (emp) await supabase.from("onboarding_records").update({ auto_employee_id: emp.id }).eq("id", record.id);

    // 寄合約副本到 Email
    if (email) await sendContractEmail(email, record.name, record.store_name, signedAt);

    // 通知新人
    if (record.line_uid) {
      await pushText(record.line_uid, `✅ 簽署完成！\n\n👤 ${record.name}\n🏠 ${record.store_name}\n📧 合約副本已寄至 ${email}\n\n⏳ 請等待總部核發帳號權限`).catch(() => {});
    }

    // 通知總部
    const { data: admins } = await supabase.from("employees").select("line_uid").eq("role", "admin").eq("is_active", true);
    if (admins) {
      for (const a of admins) {
        if (a.line_uid && a.line_uid !== record.line_uid) {
          await pushText(a.line_uid, `🆕 新人完成簽署\n👤 ${record.name}\n🏠 ${record.store_name}\n📱 ${phone}\n📧 ${email}\n\n⏳ 請到後台「員工管理」啟用帳號`).catch(() => {});
        }
      }
    }

    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
