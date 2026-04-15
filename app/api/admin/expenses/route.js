import { supabase, auditLog } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type");
  const store_id = searchParams.get("store_id");
  const month = searchParams.get("month");
  const status = searchParams.get("status");

  if (id) {
    const { data, error } = await supabase.from("expenses").select("*, stores(name)").eq("id", id).single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (searchParams.get("invoice_check")) {
    const inv = searchParams.get("invoice_check");
    const excludeId = searchParams.get("exclude_id");
    let q = supabase.from("expenses").select("id, date, vendor_name, status").eq("invoice_number", inv).in("status", ["pending", "approved"]);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q.limit(1).single();
    return Response.json({ duplicate: data || null });
  }

  if (searchParams.get("categories")) {
    const { data } = await supabase.from("expense_categories").select("*").eq("is_active", true).order("sort_order");
    return Response.json({ data });
  }

  let q = supabase.from("expenses").select("*, stores(name), expense_categories(name, type), employees:submitted_by(name)").order("date", { ascending: false });
  if (type && type !== "all") q = q.eq("expense_type", type);
  if (store_id === "__hq__") q = q.is("store_id", null);
  else if (store_id) q = q.or(`store_id.eq.${store_id},store_id.is.null`);
  if (month) q = q.eq("month_key", month);
  if (status) q = q.eq("status", status);
  const { data, error } = await q.limit(200);
  if (error) {
    console.error("expenses GET error:", error);
    return Response.json({ error: error.message, hint: error.hint, code: error.code }, { status: 500 });
  }

  // 小計
  const total = (data || []).reduce((s, e) => s + Number(e.amount || 0), 0);
  const byCategory = {};
  for (const e of data || []) {
    const cat = e.expense_categories?.name || "未分類";
    byCategory[cat] = (byCategory[cat] || 0) + Number(e.amount || 0);
  }

  return Response.json({ data, total, byCategory });
}

export async function POST(request) {
  const body = await request.json();

  // AI 辨識（從 expense-review 頁面呼叫，不在 webhook 裡）
  if (body.action === "ai_recognize") {
    const { expense_id, image_url } = body;
    let imgSrc = image_url;
    if (!imgSrc && expense_id) {
      const { data: exp } = await supabase.from("expenses").select("image_url").eq("id", expense_id).single();
      imgSrc = exp?.image_url;
    }
    if (!imgSrc) return Response.json({ error: "無圖片" });
    try {
      // 下載圖片轉 base64
      const imgRes = await fetch(imgSrc);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const b64 = buf.toString("base64");
      // AI 辨識
      const { analyzeExpenseReceipt } = await import("@/lib/anthropic");
      const r = await analyzeExpenseReceipt(b64);
      return Response.json({ data: r });
    } catch (e) {
      return Response.json({ error: e.message });
    }
  }

  if (body.action === "create") {
    const { store_id, category_id, expense_type, date, amount, vendor_name, description, image_url, ai_raw_data, submitted_by } = body;
    const monthKey = date?.slice(0, 7);
    const isShared = store_id === "__hq__" || store_id === null;
    const { data, error } = await supabase.from("expenses").insert({
      store_id: isShared ? null : store_id, category_id, expense_type, date, amount, vendor_name, description,
      image_url, ai_raw_data, submitted_by, month_key: monthKey, is_shared: isShared,
    }).select("*, expense_categories(name)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (body.action === "review") {
    const { expense_id, status, reviewed_by, reviewer_role } = body;

    // ✦09 審批層級檢查
    if (status === "approved" && reviewer_role) {
      const { data: exp } = await supabase.from("expenses")
        .select("amount").eq("id", expense_id).single();
      const amt = Number(exp?.amount || 0);
      if (reviewer_role === "store_manager" && amt > 500) {
        return Response.json({ error: "金額超過$500，需管理層或總部核准", needs_escalation: true }, { status: 403 });
      }
      if (reviewer_role === "manager" && amt > 5000) {
        return Response.json({ error: "金額超過$5,000，需總部核准", needs_escalation: true }, { status: 403 });
      }
    }

    const { data, error: updateErr } = await supabase.from("expenses").update({
      status, reviewed_by, reviewed_at: new Date().toISOString(),
    }).eq("id", expense_id).select("*, employees:submitted_by(name)").single();

    if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 });
    await auditLog(reviewed_by, null, "expense_" + status, "expense", expense_id, { amount: data?.amount, vendor: data?.vendor_name });

    // 核准時自動建立撥款紀錄（若已存在則跳過，避免重複請款）
    if (status === "approved" && data) {
      const { data: existing } = await supabase.from("payments")
        .select("id").eq("reference_id", data.id).limit(1).maybeSingle();
      if (existing) {
        return Response.json({ data });
      }

      const pmtType = data.expense_type === "vendor" ? "vendor"
        : data.expense_type === "hq_advance" ? "hq_advance" : "petty_cash";
      const recipient = data.expense_type === "vendor"
        ? (data.vendor_name || "未知廠商")
        : (data.employees?.name || data.submitted_by_name || "未知");
      const mk = data.month_key || data.date?.slice(0, 7) || new Date().toISOString().slice(0, 7);

      const { error: pmtErr } = await supabase.from("payments").insert({
        type: pmtType,
        reference_id: data.id,
        store_id: data.store_id,
        employee_id: data.expense_type !== "vendor" ? data.submitted_by : null,
        amount: data.amount,
        recipient: recipient,
        month_key: mk,
        notes: (data.vendor_name || "") + (data.invoice_number ? " #" + data.invoice_number : ""),
      });

      if (pmtErr) {
        console.error("撥款建立失敗:", pmtErr.message);
        // 仍然回傳成功（費用已核准），但帶撥款錯誤訊息
        return Response.json({ data, payment_error: pmtErr.message });
      }
    }
    return Response.json({ data });
  }

  if (body.action === "update") {
    const { expense_id, amount, vendor_name, category_suggestion, description, date, invoice_number, status, edit_reason, edit_changes, edited_at } = body;
    const updates = {};
    if (amount !== undefined) updates.amount = amount;
    if (vendor_name !== undefined) updates.vendor_name = vendor_name;
    if (category_suggestion !== undefined) updates.category_suggestion = category_suggestion;
    if (description !== undefined) updates.description = description;
    if (date !== undefined) updates.date = date;
    if (invoice_number !== undefined) updates.invoice_number = invoice_number;
    if (status !== undefined) updates.status = status;
    if (edit_reason !== undefined) updates.edit_reason = edit_reason;
    if (edit_changes !== undefined) updates.edit_changes = edit_changes;
    if (edited_at !== undefined) updates.edited_at = edited_at;
    if (body.month_key !== undefined) updates.month_key = body.month_key;
    const { data, error } = await supabase.from("expenses")
      .update(updates).eq("id", expense_id).select("*, stores(name), employees:submitted_by(line_uid, name)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });

    // 若狀態轉為 pending（網頁送出），推 LINE 確認 + 清除使用者狀態 + 推主選單
    if (status === "pending" && data?.employees?.line_uid) {
      const uid = data.employees.line_uid;
      try { await supabase.from("user_states").delete().eq("line_uid", uid); } catch {}
      try {
        const { pushText, lineClient } = await import("@/lib/line");
        const typeLabel = data.expense_type === "vendor" ? "📦 月結"
          : data.expense_type === "hq_advance" ? "🏢 總部代付" : "💰 零用金";
        const storeLabel = data.stores?.name || "🏢 總部均攤";
        const fmt = n => "$" + Number(n || 0).toLocaleString();
        await pushText(uid,
          typeLabel + " ✅ 已送出，等待審核\n" +
          "🏠 " + storeLabel + "\n" +
          "🏪 " + (data.vendor_name || "(無)") + "\n" +
          "💰 " + fmt(data.amount) + "\n" +
          "📆 " + (data.date || "") +
          (data.invoice_number ? "\n🧾 " + data.invoice_number : "")
        );
        // 推回主選單
        await lineClient.pushMessage({ to: uid, messages: [{
          type: "text",
          text: "🍯 " + (data.employees.name || "") + "，請選擇下一步：",
          quickReply: { items: [
            { type: "action", action: { type: "message", label: "📦 月結單據", text: "月結單據" } },
            { type: "action", action: { type: "message", label: "💰 零用金", text: "零用金" } },
            { type: "action", action: { type: "message", label: "🏢 總部代付", text: "總部代付" } },
            { type: "action", action: { type: "message", label: "📋 選單", text: "選單" } },
          ]}
        }]});
      } catch (e) { console.error("notify line:", e); }
    }
    return Response.json({ data });
  }

  // 刪除全部費用（測試用）
  if (body.action === "delete_all") {
    await supabase.from("payments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("expenses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    return Response.json({ success: true, message: "已清除所有費用和撥款紀錄" });
  }

  // 清除過期駁回單據
  if (body.action === "cleanup_rejected") {
    const days = body.days || 30;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const { data: deleted } = await supabase.from("expenses")
      .delete().eq("status", "rejected").lt("reviewed_at", cutoff)
      .select("id");
    return Response.json({ success: true, deleted: (deleted || []).length });
  }

  return Response.json({ error: "Unknown" }, { status: 400 });
}
