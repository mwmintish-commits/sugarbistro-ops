import { supabase } from "@/lib/supabase";
import { analyzeDailySettlement, analyzeDepositSlip, analyzeExpenseReceipt } from "@/lib/anthropic";

export async function POST(request) {
  const body = await request.json();

  // 單張上傳到 Storage
  if (!body.action) {
    const { base64, folder, filename } = body;
    if (!base64) return Response.json({ error: "Missing base64" }, { status: 400 });
    const buf = Buffer.from(base64, "base64");
    const safeFn = (filename || Date.now().toString()).replace(/[^a-zA-Z0-9_-]/g, "");
    const path = `${folder || "uploads"}/${safeFn}.jpg`;
    await supabase.storage.from("receipts").upload(path, buf, { contentType: "image/jpeg", upsert: true });
    const url = supabase.storage.from("receipts").getPublicUrl(path).data.publicUrl;
    return Response.json({ url });
  }

  // AI 辨識 + 建立草稿記錄（每張照片一筆）
  if (body.action === "analyze") {
    const { type, base64, store_id: rawStoreId, store_name, employee_id: rawEmpId, employee_name, image_url, image_urls, expense_type } = body;
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
        let dt = r.date || today;
        const dtYear = parseInt(dt.split("-")[0]);
        if (dtYear > 100 && dtYear < 200) dt = (dtYear + 1911) + dt.slice(3);
        else if (dtYear < 2024) dt = today;

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
          image_url: imgUrl, ai_raw_data: r,
          submitted_by: employee_id, status: "draft",
        }, { onConflict: "store_id,date" }).select().single();
        return Response.json({ success: true, draft_id: draft?.id, redirect: `${SITE}/settlement-review?id=${draft?.id}` });
      }

      if (type === "deposit") {
        const r = await analyzeDepositSlip(base64);
        const depDate = r?.deposit_date || today;
        const { data: draft } = await supabase.from("deposits").insert({
          store_id, deposit_date: depDate, amount: r?.amount || 0,
          bank_name: r?.bank_name || "", depositor_name: employee_name,
          period_start: depDate, period_end: depDate,
          image_url: imgUrl, submitted_by: employee_id, status: "draft",
        }).select().single();
        return Response.json({ success: true, draft_id: draft?.id, amount: r?.amount });
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

        const { data: draft, error: insErr } = await supabase.from("expenses").insert({
          store_id: normalizedStore, expense_type: expense_type || "vendor",
          date: expDate, amount: r?.total_amount || 0,
          vendor_name: r?.vendor_name || "", description: r?.description || "",
          category_suggestion: r?.category_suggestion || "其他",
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
          vendor_name: r?.vendor_name, amount: r?.total_amount,
          invoice_number: r?.invoice_number, date: expDate,
          ai_error: aiError,
          redirect: `${SITE}/expense-review?id=${draft?.id}`,
        });
      }

      return Response.json({ error: "Unknown type" });
    } catch (e) {
      return Response.json({ error: e.message });
    }
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
