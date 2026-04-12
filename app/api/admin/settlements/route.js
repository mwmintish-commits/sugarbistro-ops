import { supabase, eom } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // YYYY-MM
  const store_id = searchParams.get("store_id");

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
    return Response.json({ data });
  }

  if (body.action === "delete") {
    const { error } = await supabase.from("daily_settlements").delete().eq("id", body.settlement_id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
