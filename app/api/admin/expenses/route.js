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

  if (searchParams.get("categories")) {
    const { data } = await supabase.from("expense_categories").select("*").eq("is_active", true).order("sort_order");
    return Response.json({ data });
  }

  let q = supabase.from("expenses").select("*, stores(name), expense_categories(name, type), employees:submitted_by(name)").order("date", { ascending: false });
  if (type && type !== "all") q = q.eq("expense_type", type);
  if (store_id) q = q.eq("store_id", store_id);
  if (month) q = q.eq("month_key", month);
  if (status) q = q.eq("status", status);
  const { data } = await q.limit(200);

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

  if (body.action === "create") {
    const { store_id, category_id, expense_type, date, amount, vendor_name, description, image_url, ai_raw_data, submitted_by } = body;
    const monthKey = date?.slice(0, 7);
    const { data, error } = await supabase.from("expenses").insert({
      store_id, category_id, expense_type, date, amount, vendor_name, description,
      image_url, ai_raw_data, submitted_by, month_key: monthKey,
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

    // 核准時自動建立撥款紀錄
    if (status === "approved" && data) {
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
    const { data, error } = await supabase.from("expenses")
      .update(updates).eq("id", expense_id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
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
