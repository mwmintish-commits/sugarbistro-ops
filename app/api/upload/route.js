import { supabase } from "@/lib/supabase";
import { analyzeDailySettlement, analyzeDepositSlip, analyzeExpenseReceipt } from "@/lib/anthropic";
import { normalizeRocDate, todayTaipei } from "@/lib/date-utils";
import { computeDepositReconciliation } from "@/lib/deposit-utils";

export async function POST(request) {
  const body = await request.json();

  // 單張上傳到 Storage（支援 jpg/png/pdf/doc/xls 等任意檔案）
  if (!body.action) {
    const { base64, folder, filename, ext, mimeType } = body;
    if (!base64) return Response.json({ error: "Missing base64" }, { status: 400 });
    const buf = Buffer.from(base64, "base64");
    const safeFn = (filename || Date.now().toString()).replace(/[^a-zA-Z0-9_-]/g, "");
    const fileExt = (ext || "jpg").replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 10);
    const ct = mimeType || (fileExt === "pdf" ? "application/pdf"
      : fileExt === "png" ? "image/png"
      : fileExt === "webp" ? "image/webp"
      : fileExt === "gif" ? "image/gif"
      : fileExt === "doc" ? "application/msword"
      : fileExt === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : fileExt === "xls" ? "application/vnd.ms-excel"
      : fileExt === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "image/jpeg");
    const path = `${folder || "uploads"}/${safeFn}.${fileExt}`;
    await supabase.storage.from("receipts").upload(path, buf, { contentType: ct, upsert: true });
    const url = supabase.storage.from("receipts").getPublicUrl(path).data.publicUrl;
    return Response.json({ url });
  }

  // AI 辨識 + 建立草稿記錄（每張照片一筆）
  if (body.action === "analyze") {
    const { type, base64, store_id: rawStoreId, store_name, employee_id: rawEmpId, employee_name, image_url, image_urls, expense_type,
      // 預選的廠商/類別（月結與代付流程用：使用者先選好再上傳，AI 不需重辨）
      preset_vendor_name, preset_category } = body;
    const SITE = process.env.SITE_URL || "https://sugarbistro-ops.zeabur.app";
    const imgUrl = image_url || image_urls?.[0] || "";
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
    // UUID 欄位空字串要轉 null
    const store_id = rawStoreId === "" ? null : rawStoreId;
    const employee_id = rawEmpId === "" ? null : rawEmpId;

    try {
      if (type === "settlement") {
        const r = await analyzeDailySettlement(base64);
        if (!r) return Response.json({ error: "辨識失敗" });
        const normalized = normalizeRocDate(r.date);
        const dateNormalizeFailed = !normalized;
        const dt = normalized || today;

        const { data: draft } = await supabase.from("daily_settlements").upsert({
          store_id, date: dt, cashier_name: r.cashier_name,
          net_sales: r.net_sales || 0, discount_total: r.discount_total || 0,
          cash_amount: r.cash_amount || 0, line_pay_amount: r.line_pay_amount || 0,
          twqr_amount: r.twqr_amount || 0, uber_eat_amount: r.uber_eat_amount || 0,
          easy_card_amount: r.easy_card_amount || 0, remittance_amount: r.remittance_amount || 0,
          meal_voucher_amount: r.meal_voucher_amount || 0, line_credit_amount: r.line_credit_amount || 0,
          drink_voucher_amount: r.drink_voucher_amount || 0,
          invoice_count: r.invoice_count || 0, void_invoice_count: r.void_invoice_count || 0,
          void_invoice_amount: r.void_invoice_amount || 0,
          cash_in_register: r.cash_in_register || 0, petty_cash_reserved: r.petty_cash_reserved || 0,
          cash_to_deposit: r.cash_amount || 0,
          image_url: imgUrl,
          ai_raw_data: { ...r, _ai_date_raw: r.date, _date_normalize_failed: dateNormalizeFailed },
          submitted_by: employee_id, status: "draft",
        }, { onConflict: "store_id,date" }).select().single();
        return Response.json({
          success: true, draft_id: draft?.id, date: dt, date_warning: dateNormalizeFailed,
          redirect: `${SITE}/settlement-review?id=${draft?.id}`,
        });
      }

      if (type === "deposit") {
        const r = await analyzeDepositSlip(base64);
        const normalizedDate = r ? normalizeRocDate(r.deposit_date) : null;
        const depDate = normalizedDate || today;
        const amount = Number(r?.amount) || 0;
        const requiresManual = amount <= 0;

        // 推算對帳區間：上次存款的隔天 ~ 本次存款日
        let periodStart = depDate;
        if (store_id) {
          const { data: last } = await supabase.from("deposits")
            .select("deposit_date")
            .eq("store_id", store_id)
            .order("deposit_date", { ascending: false })
            .limit(1).maybeSingle();
          if (last?.deposit_date) {
            const next = new Date(new Date(last.deposit_date).getTime() + 86400000);
            periodStart = next.toLocaleDateString("sv-SE");
          }
        }

        // 對帳：撈區間內所有日結現金加總
        const { expected, status, difference } = await computeDepositReconciliation({
          store_id, amount, period_start: periodStart, period_end: depDate,
        });

        const { data: draft } = await supabase.from("deposits").insert({
          store_id, deposit_date: depDate, amount,
          bank_name: r?.bank_name || "", depositor_name: employee_name,
          period_start: periodStart, period_end: depDate,
          expected_cash: expected, difference, status,
          image_url: imgUrl, submitted_by: employee_id,
          ai_raw_data: r ? { ...r, _ai_date_raw: r.deposit_date, _requires_manual: requiresManual } : null,
        }).select().single();
        return Response.json({
          success: true, draft_id: draft?.id, amount,
          expected_cash: expected, difference, match_status: status,
          requires_manual: requiresManual,
          date_warning: !normalizedDate,
          message: requiresManual ? "⚠️ AI 無法辨識金額，請至後台手動填寫" : null,
        });
      }

      if (type === "expense") {
        const isHq = store_id === "__hq__";
        const normalizedStore = isHq ? null : store_id;
        // AI 辨識（失敗不阻擋建草稿，使用者可進 review 頁手動填）
        let r = null;
        let aiError = null;
        try { r = await analyzeExpenseReceipt(base64); }
        catch (e) { aiError = e.message; }
        const expDate = r?.date || today;

        // 若發票已存在且仍為 draft/pending/approved，直接重用避免重複
        if (r?.invoice_number) {
          const { data: existing } = await supabase.from("expenses")
            .select("id, status")
            .eq("invoice_number", r.invoice_number)
            .in("status", ["draft", "pending", "approved"])
            .limit(1).maybeSingle();
          if (existing) {
            return Response.json({
              success: true, draft_id: existing.id, reused: true,
              vendor_name: r?.vendor_name, amount: r?.total_amount,
              invoice_number: r?.invoice_number, date: expDate,
              redirect: `${SITE}/expense-review?id=${existing.id}`,
            });
          }
        }

        // 若使用者已預選廠商/類別（月結 / 代付），覆蓋 AI 結果
        const finalVendor = preset_vendor_name || r?.vendor_name || "";
        const finalCategory = preset_category || r?.category_suggestion || "其他";

        const { data: draft, error: insErr } = await supabase.from("expenses").insert({
          store_id: normalizedStore, expense_type: expense_type || "vendor",
          date: expDate, amount: r?.total_amount || 0,
          vendor_name: finalVendor, description: r?.description || "",
          category_suggestion: finalCategory,
          invoice_number: r?.invoice_number || null,
          image_url: imgUrl, submitted_by: employee_id,
          month_key: expDate.slice(0, 7), status: "draft",
        }).select().single();
        if (insErr) {
          console.error("expense insert failed:", insErr);
          return Response.json({ error: "建立草稿失敗：" + insErr.message }, { status: 500 });
        }
        return Response.json({
          success: true, draft_id: draft?.id,
          vendor_name: finalVendor, amount: r?.total_amount,
          invoice_number: r?.invoice_number, date: expDate,
          category_suggestion: finalCategory,
          description: r?.description || "",
          requires_manual: !r?.total_amount || r.total_amount <= 0,
          ai_error: aiError,
          redirect: `${SITE}/expense-review?id=${draft?.id}`,
        });
      }

      return Response.json({ error: "Unknown type" });
    } catch (e) {
      return Response.json({ error: e.message });
    }
  }

  // 上傳頁面內聯修正（不必跳到 expense-review）
  if (body.action === "quick_update_expense") {
    const { draft_id, amount, vendor_name, date, invoice_number, category_suggestion, description } = body;
    if (!draft_id) return Response.json({ error: "缺少 draft_id" }, { status: 400 });
    const updates = {};
    if (amount !== undefined) updates.amount = Number(amount) || 0;
    if (vendor_name !== undefined) updates.vendor_name = vendor_name;
    if (date !== undefined) { updates.date = date; updates.month_key = (date || "").slice(0, 7); }
    if (invoice_number !== undefined) updates.invoice_number = invoice_number || null;
    if (category_suggestion !== undefined) updates.category_suggestion = category_suggestion;
    if (description !== undefined) updates.description = description;
    const { data, error } = await supabase.from("expenses").update(updates).eq("id", draft_id).select().maybeSingle();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true, data });
  }

  // 上傳頁面直接送審（把 draft 改成 pending）
  if (body.action === "finalize_expense") {
    const { draft_id } = body;
    if (!draft_id) return Response.json({ error: "缺少 draft_id" }, { status: 400 });
    const { data: cur } = await supabase.from("expenses").select("amount").eq("id", draft_id).maybeSingle();
    if (!cur) return Response.json({ error: "找不到草稿" }, { status: 404 });
    if (!cur.amount || Number(cur.amount) <= 0) return Response.json({ error: "請先填寫金額" }, { status: 400 });
    const { error } = await supabase.from("expenses").update({ status: "pending" }).eq("id", draft_id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  // CSV/Excel 匯入費用
  if (body.action === "import_csv") {
    const { rows, store_id: rawStoreId, employee_id: rawEmpId, employee_name, expense_type } = body;
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
    const store_id = rawStoreId === "" ? null : rawStoreId;
    const employee_id = rawEmpId === "" ? null : rawEmpId;
    const isHq = store_id === "__hq__";
    const normalizedStore = isHq ? null : store_id;
    let imported = 0;
    let skipped = 0;
    for (const row of rows || []) {
      const date = row["日期"] || row["date"] || row["Date"] || today;
      const amount = Number(row["金額"] || row["amount"] || row["Amount"] || row["總計"] || row["合計"] || 0);
      const vendor = row["廠商"] || row["vendor"] || row["Vendor"] || row["商家"] || row["供應商"] || "";
      const desc = row["說明"] || row["description"] || row["品項"] || row["備註"] || row["摘要"] || "";
      const invoice = row["發票號碼"] || row["invoice"] || row["Invoice"] || row["發票"] || null;
      const category = row["分類"] || row["category"] || row["Category"] || "其他";
      if (amount <= 0) continue;

      // 去重：有發票號碼則以發票為主；無則以 (store, date, vendor, amount) 組合檢查
      let dupQ = supabase.from("expenses").select("id").limit(1);
      if (invoice) {
        dupQ = dupQ.eq("invoice_number", invoice).in("status", ["draft", "pending", "approved"]);
      } else {
        dupQ = dupQ.eq("date", date).eq("amount", amount).eq("vendor_name", vendor);
        dupQ = normalizedStore === null ? dupQ.is("store_id", null) : dupQ.eq("store_id", normalizedStore);
      }
      const { data: dup } = await dupQ.maybeSingle();
      if (dup) { skipped++; continue; }

      try {
        await supabase.from("expenses").insert({
          store_id: normalizedStore, expense_type: expense_type || "vendor",
          date, amount, vendor_name: vendor, description: desc,
          category_suggestion: category, invoice_number: invoice || null,
          submitted_by: employee_id, month_key: (date || today).slice(0, 7), status: "draft",
        });
        imported++;
      } catch {}
    }
    return Response.json({ success: true, imported, skipped, total: (rows || []).length });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
