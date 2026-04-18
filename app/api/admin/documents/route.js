import { supabase } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const employee_id = searchParams.get("employee_id");

  // 批次彙總：回傳各員工已上傳的 doc_type 清單（僅型別，不含內容，供「文件完整度」欄顯示）
  if (searchParams.get("summary")) {
    const idsParam = searchParams.get("employee_ids");
    let q = supabase.from("employee_documents").select("employee_id, doc_type, file_url, signature_url");
    if (idsParam) q = q.in("employee_id", idsParam.split(",").filter(Boolean));
    const { data } = await q;
    const map = {};
    for (const d of data || []) {
      if (!map[d.employee_id]) map[d.employee_id] = [];
      if (d.file_url || d.signature_url) map[d.employee_id].push(d.doc_type);
    }
    return Response.json({ map });
  }

  if (!employee_id) return Response.json({ error: "需指定員工" }, { status: 400 });
  const { data } = await supabase.from("employee_documents")
    .select("*").eq("employee_id", employee_id).order("created_at");
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();

  // 重寄合約 Email
  if (body.action === "resend_email") {
    const { employee_id } = body;
    const { data: emp } = await supabase.from("employees").select("*, stores!store_id(name)").eq("id", employee_id).single();
    if (!emp) return Response.json({ error: "找不到員工" }, { status: 404 });
    if (!emp.email) return Response.json({ error: "此員工沒有設定 Email" }, { status: 400 });

    // 找合約文件
    const { data: docs } = await supabase.from("employee_documents").select("*").eq("employee_id", employee_id);
    const contractDoc = (docs || []).find(d => d.doc_type === "contract_pdf");
    const contractSig = (docs || []).find(d => d.doc_type === "contract_sign");

    let html = "";
    if (contractDoc && contractDoc.file_url?.startsWith("data:text/html;base64,")) {
      html = Buffer.from(contractDoc.file_url.replace("data:text/html;base64,", ""), "base64").toString("utf8");
    } else {
      html = "<h2>勞動契約書</h2><p>甲方：小食糖 SUGARbISTRO</p><p>乙方：" + emp.name + "</p><p>門市：" + (emp.stores?.name || "") + "</p><p>到職日：" + (emp.hire_date || "") + "</p><p>合約已於線上簽署完成。</p>";
      if (contractSig?.signature_url) html += "<p>簽名：<img src='" + contractSig.signature_url + "' style='max-height:60px' /></p>";
    }

    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "小食糖 <onboarding@resend.dev>",
          to: emp.email,
          subject: "【小食糖】勞動契約副本 - " + emp.name,
          html: html,
        }),
      });
      return Response.json({ success: true });
    } catch (e) {
      return Response.json({ error: "寄送失敗：" + e.message }, { status: 500 });
    }
  }

  // 上傳文件（支援 action:"upload" 或直接傳入）
  const { employee_id, doc_type, file_url, signature_url, notes } = body;
  if (employee_id && doc_type) {
    const { data, error } = await supabase.from("employee_documents").insert({
      employee_id, doc_type, file_url, signature_url,
      signed_at: signature_url ? new Date().toISOString() : null, notes
    }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (body.action === "delete") {
    await supabase.from("employee_documents").delete().eq("id", body.document_id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
