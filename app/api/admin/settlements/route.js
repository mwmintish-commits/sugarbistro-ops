import { supabase, eom, auditLog } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const month = searchParams.get("month");
  const store_id = searchParams.get("store_id");

  // 單筆查詢（用於日結確認頁）
  if (id) {
    const { data, error } = await supabase.from("daily_settlements").select("*, stores(name)").eq("id", id).single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  let query = supabase
    .from("daily_settlements")
    .select("*, stores(name)")
    .order("date", { ascending: false });

  if (month) {
    query = query.gte("date", `${month}-01`).lte("date", `${eom(month)}`);
  }
  if (store_id) {
    query = query.eq("store_id", store_id);
  }

  const { data, error } = await query.limit(100);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // 計算彙總
  const summary = {
    total_net_sales: 0,
    total_cash: 0,
    total_line_pay: 0,
    total_twqr: 0,
    total_uber_eat: 0,
    total_easy_card: 0,
    total_meal_voucher: 0,
    total_cash_to_deposit: 0,
    count: data?.length || 0,
  };

  for (const row of data || []) {
    summary.total_net_sales += Number(row.net_sales || 0);
    summary.total_cash += Number(row.cash_amount || 0);
    summary.total_line_pay += Number(row.line_pay_amount || 0);
    summary.total_twqr += Number(row.twqr_amount || 0);
    summary.total_uber_eat += Number(row.uber_eat_amount || 0);
    summary.total_easy_card += Number(row.easy_card_amount || 0);
    summary.total_meal_voucher += Number(row.meal_voucher_amount || 0);
    summary.total_cash_to_deposit += Number(row.cash_to_deposit || 0);
  }

  return Response.json({ data, summary });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "update") {
    const { settlement_id, ...updates } = body;
    delete updates.action;
    const { data, error } = await supabase.from("daily_settlements")
      .update(updates).eq("id", settlement_id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    await auditLog(null, null, "settlement_update", "settlement", settlement_id, { date: data?.date, store_id: data?.store_id, changes: updates });
    return Response.json({ data });
  }

  if (body.action === "delete") {
    const sid = body.settlement_id;
    if (!sid) return Response.json({ error: "缺少 settlement_id" }, { status: 400 });
    try {
      // 先刪除所有 FK 關聯表
      const r1 = await supabase.from("voucher_serials").delete().eq("settlement_id", sid);
      const r2 = await supabase.from("settlement_receipts").delete().eq("settlement_id", sid);
      const { error } = await supabase.from("daily_settlements").delete().eq("id", sid);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      // 日誌在刪除成功後才寫（不阻擋主流程）
      try { await supabase.from("audit_logs").insert({ action: "settlement_delete", target_type: "settlement", target_id: String(sid) }); } catch(e2) {}
      return Response.json({ success: true });
    } catch(e) {
      return Response.json({ error: "刪除失敗：" + (e.message || String(e)) }, { status: 500 });
    }
  }

  if (body.action === "import_csv") {
    const { store_id, rows } = body;
    if (!store_id) return Response.json({ error: "請先選擇門市" }, { status: 400 });
    if (!Array.isArray(rows) || rows.length === 0) return Response.json({ error: "CSV 內容為空" }, { status: 400 });

    // 欄位關鍵字對應：CSV 表頭包含關鍵字 → 對應到 daily_settlements 欄位
    const FIELD_MAP = [
      { key: "date", kws: ["日期", "date", "營業日"] },
      { key: "net_sales", kws: ["淨銷售", "淨營業", "總營業", "營業額", "net sales", "總計"] },
      { key: "discount_total", kws: ["折扣", "折讓", "discount"] },
      { key: "cash_amount", kws: ["現金", "cash"] },
      { key: "line_pay_amount", kws: ["line pay", "linepay", "line_pay"] },
      { key: "twqr_amount", kws: ["twqr", "tw qr", "台灣qr", "qr code"] },
      { key: "uber_eat_amount", kws: ["uber"] },
      { key: "easy_card_amount", kws: ["悠遊卡", "easy card", "easycard"] },
      { key: "meal_voucher_amount", kws: ["餐券", "振興", "voucher", "禮券"] },
      { key: "line_credit_amount", kws: ["line points", "line 點數", "line積分"] },
      { key: "drink_voucher_amount", kws: ["飲料券", "飲品券"] },
      { key: "invoice_count", kws: ["發票張數", "發票數", "invoice count"] },
      { key: "invoice_start", kws: ["起號", "起始", "起發票", "invoice start"] },
      { key: "invoice_end", kws: ["迄號", "結束", "末發票", "invoice end"] },
      { key: "void_invoice_count", kws: ["作廢張數", "作廢數", "void count"] },
      { key: "void_invoice_amount", kws: ["作廢金額", "void amount"] },
      { key: "cashier_name", kws: ["收銀", "cashier", "經手人"] },
    ];
    const matchField = (header) => {
      const h = String(header || "").trim().toLowerCase();
      for (const f of FIELD_MAP) for (const kw of f.kws) if (h.includes(kw.toLowerCase())) return f.key;
      return null;
    };
    const parseNum = (v) => {
      const s = String(v || "").replace(/[$,\s]/g, "");
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    };
    const parseDate = (v) => {
      if (!v) return null;
      const s = String(v).trim();
      // 常見格式：2026-04-25 / 2026/4/25 / 04/25/2026 / 2026.4.25
      const m1 = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
      if (m1) return `${m1[1]}-${m1[2].padStart(2,"0")}-${m1[3].padStart(2,"0")}`;
      const m2 = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
      if (m2) return `${m2[3]}-${m2[1].padStart(2,"0")}-${m2[2].padStart(2,"0")}`;
      const m3 = s.match(/^(\d{2,3})[-\/.](\d{1,2})[-\/.](\d{1,2})/); // 民國
      if (m3) { const y = Number(m3[1]) + 1911; return `${y}-${m3[2].padStart(2,"0")}-${m3[3].padStart(2,"0")}`; }
      return null;
    };

    let inserted = 0, updated = 0, skipped = 0, errors = [];
    for (const raw of rows) {
      try {
        const rec = { store_id };
        let hasDate = false;
        for (const [header, value] of Object.entries(raw)) {
          const field = matchField(header);
          if (!field) continue;
          if (field === "date") {
            const d = parseDate(value);
            if (d) { rec.date = d; hasDate = true; }
          } else if (["invoice_start","invoice_end","cashier_name"].includes(field)) {
            rec[field] = String(value || "").trim() || null;
          } else if (["invoice_count","void_invoice_count"].includes(field)) {
            rec[field] = Math.round(parseNum(value));
          } else {
            rec[field] = parseNum(value);
          }
        }
        if (!hasDate) { skipped++; continue; }
        // upsert by (store_id, date)
        const { data: ex } = await supabase.from("daily_settlements")
          .select("id").eq("store_id", store_id).eq("date", rec.date).maybeSingle();
        if (ex?.id) {
          await supabase.from("daily_settlements").update({ ...rec, manually_corrected: true }).eq("id", ex.id);
          updated++;
        } else {
          await supabase.from("daily_settlements").insert({ ...rec, manually_corrected: true });
          inserted++;
        }
      } catch (e) {
        errors.push(e.message || String(e));
      }
    }
    await auditLog(null, null, "settlement_import_csv", "settlement", null, { store_id, inserted, updated, skipped, errors: errors.slice(0,3) });
    return Response.json({ inserted, updated, skipped, errors: errors.slice(0, 5), message: `匯入完成：新增 ${inserted}、更新 ${updated}、略過 ${skipped}` });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
