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

  // 先查 onboarding_records
  const { data } = await supabase.from("onboarding_records").select("*").eq("token", token).single();
  if (data) return Response.json({ data });

  // fallback: 查 employees.bind_code（後台產生的報到連結）
  const { data: emp } = await supabase.from("employees")
    .select("id, name, phone, email, store_id, stores!store_id(name), hire_date, bind_code, onboarding_completed, contract_signed")
    .eq("bind_code", token).single();
  if (emp) return Response.json({ data: { ...emp, store_name: emp.stores?.name || "", token } });

  return Response.json({ error: "連結無效或已過期" }, { status: 404 });
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
    const { token, employee_id, signature_name, birthday, id_number, phone, email, address,
      emergency_contact, emergency_phone, emergency_relation,
      bank_name, bank_account,
      health_check_url, id_front_url, id_back_url,
      handbook_signature, contract_signature,
      handbook_content, contract_content } = body;

    // 找員工（優先用 employee_id）
    let emp = null;
    if (employee_id) {
      const { data } = await supabase.from("employees")
        .select("id, name, store_id, line_uid, stores!store_id(name)")
        .eq("id", employee_id).single();
      emp = data;
    }
    if (!emp && token) {
      const { data } = await supabase.from("employees")
        .select("id, name, store_id, line_uid, stores!store_id(name)")
        .eq("bind_code", token).single();
      emp = data;
    }
    if (!emp && phone) {
      const { data } = await supabase.from("employees")
        .select("id, name, store_id, line_uid, stores!store_id(name)")
        .eq("phone", phone).eq("is_active", true).limit(1).single();
      emp = data;
    }

    // 找不到 → 自動建立員工（LINE 新人報到流程）
    if (!emp) {
      const rec = await supabase.from("onboarding_records").select("*").eq("token", token).single();
      const r = rec.data || {};
      const { data: newEmp, error: createErr } = await supabase.from("employees").insert({
        name: signature_name || r.name || "新員工",
        phone, email, birthday, id_number, address,
        store_id: r.store_id || null,
        line_uid: r.line_uid || null,
        role: "staff",
        employment_type: "regular",
        hire_date: new Date().toLocaleDateString("sv-SE"),
        is_active: false,  // 待主管核准
        contract_signed: true, handbook_signed: true, bonus_policy_signed: true,
        onboarding_completed: true, onboarding_step: 5,
        emergency_contact, emergency_phone, bank_name, bank_account,
      }).select("id, name, store_id, line_uid, stores!store_id(name)").single();
      if (createErr) return Response.json({ error: "建立員工失敗：" + createErr.message }, { status: 500 });
      emp = newEmp;
      // 更新 onboarding_record 的 auto_employee_id
      if (r.id) await supabase.from("onboarding_records").update({ auto_employee_id: emp.id }).eq("id", r.id);
    } else {
      // 已有員工 → 更新資料
      const { error: updateErr } = await supabase.from("employees").update({
        phone, email, birthday, id_number, address,
        emergency_contact, emergency_phone,
        bank_name, bank_account,
        contract_signed: true, handbook_signed: true, bonus_policy_signed: true,
        onboarding_completed: true, onboarding_step: 5,
      }).eq("id", emp.id);
      if (updateErr) return Response.json({ error: "更新員工資料失敗：" + updateErr.message }, { status: 500 });
    }

    // 儲存文件（身分證正反面分開）
    const signedAt = new Date().toISOString();
    const hireDate = emp.hire_date || new Date().toLocaleDateString("sv-SE");
    const storeName = emp.stores?.name || "";
    const empName = signature_name || emp.name;
    const docs = [
      { doc_type: "health_check", file_url: health_check_url },
      { doc_type: "id_card_front", file_url: id_front_url },
      { doc_type: "id_card_back", file_url: id_back_url },
      { doc_type: "handbook_sign", signature_url: handbook_signature, signed_at: signedAt, notes: JSON.stringify(handbook_content || []) },
      { doc_type: "contract_sign", signature_url: contract_signature, signed_at: signedAt, notes: contract_content || "" },
    ];
    // 產生可列印合約 HTML
    const contractHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>勞動契約書 - ${empName}</title><style>body{font-family:'Noto Sans TC',system-ui,sans-serif;max-width:700px;margin:40px auto;padding:20px;color:#333;line-height:1.8}h1{text-align:center;font-size:22px;border-bottom:2px solid #333;padding-bottom:8px}table.info{width:100%;margin:16px 0}table.info td{padding:4px 8px;font-size:14px}table.info td:first-child{font-weight:bold;width:120px}.clause{margin:8px 0;font-size:14px}.sig{margin-top:30px;display:flex;gap:40px;align-items:flex-end}.sig img{border:1px solid #ddd;border-radius:4px;max-height:80px}.footer{text-align:center;font-size:11px;color:#888;margin-top:40px}@media print{body{margin:0;padding:20px}}</style></head><body><h1>勞動契約書</h1><table class="info"><tr><td>甲方（雇主）</td><td>小食糖 SUGARbISTRO</td></tr><tr><td>乙方（員工）</td><td>${empName}</td></tr><tr><td>身分證字號</td><td>${id_number||""}</td></tr><tr><td>服務門市</td><td>${storeName}</td></tr><tr><td>到職日期</td><td>${hireDate}</td></tr></table><hr><p>雙方同意依下列條款訂定本勞動契約：</p>${(contract_content||"一、乙方同意遵守甲方之員工行為規範與工作守則。\n二、乙方了解並同意季績效獎金制度之計算方式與發放條件。\n三、乙方之薪資、工時、休假依勞動基準法及甲方規定辦理。\n四、乙方同意甲方依法代扣勞健保及所得稅。\n五、乙方應對甲方之營業秘密負保密義務，離職後仍有效。\n六、任一方得依勞動基準法規定終止本合約。\n七、本合約自到職日起生效。\n八、本合約一式兩份，甲乙雙方各執一份為憑。").split("\n").map(l=>"<div class='clause'>"+l+"</div>").join("")}<div class="sig"><div><div style="font-size:12px;color:#888">員工簽名</div>${contract_signature?"<img src='"+contract_signature+"' />":""}<div style="font-size:12px">${empName}</div></div><div><div style="font-size:12px;color:#888">簽署日期</div><div>${signedAt.slice(0,10)}</div></div></div><div class="footer">小食糖 SUGARbISTRO ─ 此為電子簽署文件</div></body></html>`;
    docs.push({ doc_type: "contract_pdf", file_url: "data:text/html;base64," + Buffer.from(contractHtml).toString("base64"), signed_at: signedAt, notes: "可列印合約" });
    for (const d of docs) {
      if (d.file_url || d.signature_url) {
        await supabase.from("employee_documents").insert({ employee_id: emp.id, ...d });
      }
    }

    // 通知（待審核）
    if (emp.line_uid) {
      await pushText(emp.line_uid, "✅ 報到資料已送出！\n👤 " + empName + "\n📝 合約已簽署\n\n⏳ 請等待總部審核，核准後即可開始打卡。" + (email ? "\n📧 合約副本已寄至 " + email : "")).catch(() => {});
    }
    // 寄送守則+合約副本
    if (email) {
      await sendOnboardingEmails({
        email, name: empName, storeName,
        idNumber: id_number, hireDate,
        handbookContent: handbook_content, contractContent: contract_content,
        handbookSig: handbook_signature, contractSig: contract_signature,
      });
    }
    const { data: admins } = await supabase.from("employees").select("line_uid").eq("role", "admin").eq("is_active", true);
    for (const a of admins || []) {
      if (a.line_uid) await pushText(a.line_uid, "🆕 新人報到待審核\n👤 " + empName + "\n🏠 " + storeName + "\n\n📋 已簽署合約+守則\n👉 請至後台「員工」→「待審核」核准").catch(() => {});
    }

    return Response.json({ success: true });
    } catch (e) {
      console.error("Onboarding complete error:", e);
      return Response.json({ error: "報到失敗：" + (e.message || "伺服器錯誤") }, { status: 500 });
    }
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
