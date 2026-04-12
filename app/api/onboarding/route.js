import crypto from "crypto";
import { supabase } from "@/lib/supabase";
import { pushText } from "@/lib/line";

async function sendContractEmail(email, name, storeName, signedAt) {
  // Legacy - kept for old flow
}

async function sendOnboardingEmails({ email, name, storeName, idNumber, hireDate, handbookContent, contractContent, handbookSig, contractSig }) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY || !email) { console.log("No RESEND_API_KEY or email, skip"); return; }
  const signDate = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
  const fromAddr = process.env.RESEND_FROM || "小食糖 <onboarding@resend.dev>";

  // 共用樣式
  const style = "font-family:'Noto Sans TC',sans-serif;max-width:700px;margin:0 auto;padding:30px;color:#333;line-height:1.8;";
  const headerHtml = "<div style='text-align:center;margin-bottom:20px'><h1 style='font-size:22px;margin:0'>🍯 小食糖 SUGARbISTRO</h1></div>";
  const footerHtml = "<hr style='margin:20px 0'/><div style='display:flex;justify-content:space-between;align-items:flex-end;margin-top:30px'>" +
    "<div><p><b>員工姓名：</b>" + name + "</p><p><b>簽署日期：</b>" + signDate + "</p></div>" +
    "<div style='text-align:center'><p style='font-size:10px;color:#888'>電子簽名</p>SIG_PLACEHOLDER</div></div>" +
    "<p style='font-size:10px;color:#aaa;text-align:center;margin-top:20px'>此為系統自動發送之簽署副本，正本由總部存檔。</p>";

  // 1. 員工守則 Email
  try {
    let hbHtml = "";
    const chapters = handbookContent || [];
    for (const ch of chapters) {
      const isWarn = (ch.title || "").includes("零容忍") || (ch.title || "").includes("最高");
      hbHtml += "<h3 style='background:" + (isWarn ? "#fde8e8;color:#b91c1c" : "#f5f5f5;color:#333") + ";padding:6px 10px;border-radius:4px;font-size:14px'>" + ch.title + "</h3>";
      for (const item of ch.items || []) hbHtml += "<p style='padding-left:16px;margin:4px 0;font-size:13px'>▸ " + item + "</p>";
    }
    const hbBody = "<div style='" + style + "'>" + headerHtml +
      "<h2 style='text-align:center;font-size:18px'>員工行為規範與工作守則</h2>" +
      "<p style='text-align:center;color:#888;font-size:12px'>適用對象：全體正職、兼職、試用期同仁</p>" +
      hbHtml +
      footerHtml.replace("SIG_PLACEHOLDER", handbookSig ? "<img src='" + handbookSig + "' style='height:50px' />" : "(已電子簽署)") +
      "</div>";
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + RESEND_KEY },
      body: JSON.stringify({ from: fromAddr, to: email, subject: "【小食糖】員工守則簽署確認 - " + name, html: hbBody }),
    });
  } catch (e) { console.error("Handbook email error:", e); }

  // 2. 工作合約 Email
  try {
    let ctHtml = "<p><b>甲方（雇主）：</b>小食糖 SUGARbISTRO</p>" +
      "<p><b>乙方（員工）：</b>" + name + "</p>" +
      "<p><b>身分證字號：</b>" + (idNumber || "") + "</p>" +
      "<p><b>服務門市：</b>" + (storeName || "") + "</p>" +
      "<p><b>到職日期：</b>" + (hireDate || "") + "</p>" +
      "<hr style='margin:15px 0'/><p style='font-weight:600'>雙方同意依下列條款訂定本勞動契約：</p>";
    const lines = (contractContent || "").split("\n").filter(Boolean);
    for (const line of lines) ctHtml += "<p style='padding-left:8px;margin:6px 0;font-size:13px'>" + line + "</p>";
    const ctBody = "<div style='" + style + "'>" + headerHtml +
      "<h2 style='text-align:center;font-size:18px'>勞動契約書</h2>" +
      ctHtml +
      footerHtml.replace("SIG_PLACEHOLDER", contractSig ? "<img src='" + contractSig + "' style='height:50px' />" : "(已電子簽署)") +
      "</div>";
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + RESEND_KEY },
      body: JSON.stringify({ from: fromAddr, to: email, subject: "【小食糖】工作合約簽署確認 - " + name, html: ctBody }),
    });
  } catch (e) { console.error("Contract email error:", e); }
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

    // 通知總部（含後台連結）
    const baseUrl = process.env.SITE_URL || "https://sugarbistro-ops.zeabur.app";
    const { data: admins } = await supabase.from("employees").select("line_uid").eq("role", "admin").eq("is_active", true);
    if (admins) {
      const { lineClient } = await import("@/lib/line");
      for (const a of admins) {
        if (a.line_uid && a.line_uid !== record.line_uid) {
          await lineClient.pushMessage({
            to: a.line_uid,
            messages: [
              { type: "text", text: `🆕 新人完成簽署\n👤 ${record.name}\n🏠 ${record.store_name}\n📱 ${phone}\n📧 ${email}\n\n⏳ 請到後台啟用帳號` },
              { type: "template", altText: "前往員工管理", template: { type: "buttons", title: "👥 員工管理", text: "點擊下方按鈕前往後台啟用新人帳號", actions: [{ type: "uri", label: "前往後台啟用", uri: baseUrl }] } },
            ],
          }).catch(() => {});
        }
      }
    }

    return Response.json({ success: true });
  }

  // 6步驟報到完成（現有員工）
  if (body.action === "complete") {
    try {
    const { token, signature_name, birthday, id_number, phone, email, address,
      emergency_contact, emergency_phone, emergency_relation,
      bank_name, bank_account,
      health_check_url, id_front_url, id_back_url,
      handbook_signature, contract_signature,
      handbook_content, contract_content } = body;

    // 找員工（by bind_code or token）
    let emp = null;
    const { data: byCode } = await supabase.from("employees")
      .select("id, name, store_id, line_uid, stores(name)")
      .eq("bind_code", token).single();
    if (byCode) emp = byCode;

    if (!emp) {
      const { data: byRecord } = await supabase.from("onboarding_records")
        .select("auto_employee_id").eq("token", token).single();
      if (byRecord?.auto_employee_id) {
        const { data: e } = await supabase.from("employees")
          .select("id, name, store_id, line_uid, stores(name)")
          .eq("id", byRecord.auto_employee_id).single();
        emp = e;
      }
    }

    if (!emp && phone) {
      const { data: byPhone } = await supabase.from("employees")
        .select("id, name, store_id, line_uid, stores(name), hire_date")
        .eq("phone", phone).eq("is_active", true).single().catch(() => ({ data: null }));
      if (byPhone) emp = byPhone;
    }

    if (!emp) return Response.json({ error: "找不到員工。請確認後台已新增此員工，並使用最新的報到連結。" }, { status: 404 });

    // 更新員工資料
    const { error: updateErr } = await supabase.from("employees").update({
      phone, email, birthday, id_number, address,
      emergency_contact, emergency_phone,
      bank_name, bank_account,
      contract_signed: true, handbook_signed: true, bonus_policy_signed: true,
      onboarding_completed: true, onboarding_step: 5,
    }).eq("id", emp.id);
    if (updateErr) return Response.json({ error: "更新員工資料失敗：" + updateErr.message }, { status: 500 });

    // 儲存文件（身分證正反面分開）
    const docs = [
      { doc_type: "health_check", file_url: health_check_url },
      { doc_type: "id_card_front", file_url: id_front_url },
      { doc_type: "id_card_back", file_url: id_back_url },
      { doc_type: "handbook_sign", signature_url: handbook_signature, signed_at: new Date().toISOString(), notes: JSON.stringify(handbook_content || []) },
      { doc_type: "contract_sign", signature_url: contract_signature, signed_at: new Date().toISOString(), notes: contract_content || "" },
    ];
    for (const d of docs) {
      if (d.file_url || d.signature_url) {
        await supabase.from("employee_documents").insert({ employee_id: emp.id, ...d });
      }
    }

    // 通知 + Email
    if (emp.line_uid) {
      await pushText(emp.line_uid, "✅ 報到完成！\n👤 " + emp.name + "\n📝 合約已簽署，可以開始打卡了。" + (email ? "\n📧 合約副本已寄至 " + email : "")).catch(() => {});
    }
    // 寄送守則+合約副本
    if (email) {
      await sendOnboardingEmails({
        email, name: signature_name || emp.name,
        storeName: emp.stores?.name || "",
        idNumber: id_number, hireDate: emp.hire_date || new Date().toLocaleDateString("sv-SE"),
        handbookContent: handbook_content, contractContent: contract_content,
        handbookSig: handbook_signature, contractSig: contract_signature,
      });
    }
    const { data: admins } = await supabase.from("employees").select("line_uid").eq("role", "admin").eq("is_active", true);
    for (const a of admins || []) {
      if (a.line_uid) await pushText(a.line_uid, "🆕 " + emp.name + " 已完成報到（含合約+體檢+守則簽署）" + (email ? "\n📧 副本已寄 " + email : "")).catch(() => {});
    }

    return Response.json({ success: true });
    } catch (e) {
      console.error("Onboarding complete error:", e);
      return Response.json({ error: "報到失敗：" + (e.message || "伺服器錯誤") }, { status: 500 });
    }
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
