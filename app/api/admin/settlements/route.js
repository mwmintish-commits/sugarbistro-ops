import { supabase } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // YYYY-MM
  const store_id = searchParams.get("store_id");

  let query = supabase
    .from("daily_settlements")
    .select("*, stores(name)")
    .order("date", { ascending: false });

  if (month) {
    query = query.gte("date", `${month}-01`).lte("date", `${month}-31`);
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
