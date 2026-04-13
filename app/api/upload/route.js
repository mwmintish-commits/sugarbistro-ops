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

  // AI 辨識 + 建立草稿記錄
  if (body.action === "analyze") {
    const { type, base64, store_id, store_name, employee_id, employee_name, image_urls } = body;
    const SITE = process.env.SITE_URL || "https://sugarbistro-ops.zeabur.app";

    try {
      if (type === "settlement") {
        const r = await analyzeDailySettlement(base64);
        if (!r) return Response.json({ error: "辨識失敗" }, { status: 500 });
        const rawDt = r.period_end?.split(" ")[0] || new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
        let dt = rawDt;
        const dtYear = parseInt(dt.split("-")[0]);
        if (dtYear > 100 && dtYear < 200) dt = (dtYear + 1911) + dt.slice(3);
        else if (dtYear < 2024) dt = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });

        const { data: draft } = await supabase.from("daily_settlements").upsert({
          store_id, date: dt, period_start: r.period_start, period_end: r.period_end,
          cashier_name: r.cashier_name, net_sales: r.net_sales || 0, discount_total: r.discount_total || 0,
          cash_amount: r.cash_amount || 0, line_pay_amount: r.line_pay_amount || 0,
          twqr_amount: r.twqr_amount || 0, uber_eat_amount: r.uber_eat_amount || 0,
          easy_card_amount: r.easy_card_amount || 0, remittance_amount: r.remittance_amount || 0,
          meal_voucher_amount: r.meal_voucher_amount || 0, line_credit_amount: r.line_credit_amount || 0,
          drink_voucher_amount: r.drink_voucher_amount || 0,
          invoice_count: r.invoice_count || 0, void_invoice_count: r.void_invoice_count || 0,
          void_invoice_amount: r.void_invoice_amount || 0,
          cash_in_register: r.cash_in_register || 0, petty_cash_reserved: r.petty_cash_reserved || 0,
          cash_to_deposit: r.cash_amount || 0,
          image_url: image_urls?.[0], ai_raw_data: { ...r, extra_images: image_urls?.slice(1) },
          submitted_by: employee_id, status: "draft",
        }, { onConflict: "store_id,date" }).select().single();

        return Response.json({ success: true, redirect: `${SITE}/settlement-review?id=${draft?.id}` });
      }

      if (type === "deposit") {
        const r = await analyzeDepositSlip(base64);
        if (!r) return Response.json({ error: "辨識失敗" }, { status: 500 });
        const depDate = r.deposit_date || new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });

        const { data: draft } = await supabase.from("deposits").insert({
          store_id, deposit_date: depDate, amount: r.deposit_amount || 0,
          bank_name: r.bank_name, bank_branch: r.bank_branch, account_number: r.account_number,
          depositor_name: employee_name, roc_date: r.roc_date,
          period_start: depDate, period_end: depDate,
          image_url: image_urls?.[0], ai_raw_data: { ...r, extra_images: image_urls?.slice(1) },
          submitted_by: employee_id, status: "draft",
        }).select().single();

        return Response.json({ success: true, deposit_id: draft?.id });
      }

      if (type === "expense") {
        const r = await analyzeExpenseReceipt(base64);
        if (!r) return Response.json({ error: "辨識失敗" }, { status: 500 });

        const { data: draft } = await supabase.from("expenses").insert({
          store_id, expense_type: "petty_cash", date: r.date || new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }),
          amount: r.total_amount || 0, vendor_name: r.vendor_name, description: r.description,
          category_suggestion: r.category_suggestion || "其他", invoice_number: r.invoice_number,
          image_url: image_urls?.[0], ai_raw_data: { ...r, extra_images: image_urls?.slice(1) },
          submitted_by: employee_id, submitted_by_name: employee_name,
          month_key: (r.date || "").slice(0, 7), status: "draft",
        }).select().single();

        return Response.json({ success: true, redirect: `${SITE}/expense-review?id=${draft?.id}` });
      }

      return Response.json({ error: "Unknown type" }, { status: 400 });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
