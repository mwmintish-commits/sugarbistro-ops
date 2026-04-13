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

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
