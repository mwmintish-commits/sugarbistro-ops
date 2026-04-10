import { supabase } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const store_id = searchParams.get("store_id");

  if (!month) return Response.json({ error: "需要指定月份" }, { status: 400 });

  // 收入：日結營業額
  let revQ = supabase.from("daily_settlements").select("net_sales, cash_amount, line_pay_amount, twqr_amount, uber_eat_amount, easy_card_amount, meal_voucher_amount, line_credit_amount, drink_voucher_amount, stores(name)").gte("date", `${month}-01`).lte("date", `${month}-31`);
  if (store_id) revQ = revQ.eq("store_id", store_id);
  const { data: revenues } = await revQ;

  const totalRevenue = (revenues || []).reduce((s, r) => s + Number(r.net_sales || 0), 0);
  const revenueByStore = {};
  for (const r of revenues || []) {
    const name = r.stores?.name || "未知";
    revenueByStore[name] = (revenueByStore[name] || 0) + Number(r.net_sales || 0);
  }

  // 支出：月結廠商 + 零用金
  let expQ = supabase.from("expenses").select("amount, expense_type, expense_categories(name, type), stores(name)").eq("month_key", month).in("status", ["pending", "approved"]);
  if (store_id) expQ = expQ.eq("store_id", store_id);
  const { data: expenses } = await expQ;

  const vendorTotal = (expenses || []).filter(e => e.expense_type === "vendor").reduce((s, e) => s + Number(e.amount || 0), 0);
  const pettyTotal = (expenses || []).filter(e => e.expense_type === "petty_cash").reduce((s, e) => s + Number(e.amount || 0), 0);
  const hqAdvanceTotal = (expenses || []).filter(e => e.expense_type === "hq_advance").reduce((s, e) => s + Number(e.amount || 0), 0);
  const expenseByCategory = {};
  for (const e of expenses || []) {
    const cat = e.expense_categories?.name || "未分類";
    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(e.amount || 0);
  }

  // 人事成本：薪資
  let payQ = supabase.from("payroll").select("base_salary, overtime_pay, bonus, labor_insurance_self, health_insurance_self, net_salary").eq("year", parseInt(month.split("-")[0])).eq("month", parseInt(month.split("-")[1]));
  const { data: payrolls } = await payQ;
  const laborTotal = (payrolls || []).reduce((s, p) => s + Number(p.net_salary || 0), 0);
  const laborInsurance = (payrolls || []).reduce((s, p) => s + Number(p.labor_insurance_self || 0) + Number(p.health_insurance_self || 0), 0);

  const totalExpense = vendorTotal + pettyTotal + hqAdvanceTotal + laborTotal;
  const grossProfit = totalRevenue - vendorTotal - pettyTotal;
  const netProfit = totalRevenue - totalExpense;

  return Response.json({
    month,
    revenue: {
      total: totalRevenue,
      byStore: revenueByStore,
      days: (revenues || []).length,
    },
    expenses: {
      vendor: vendorTotal,
      petty_cash: pettyTotal,
      hq_advance: hqAdvanceTotal,
      labor: laborTotal,
      labor_insurance: laborInsurance,
      total: totalExpense,
      byCategory: expenseByCategory,
    },
    profit: {
      gross: grossProfit,
      net: netProfit,
      margin: totalRevenue ? (netProfit / totalRevenue * 100).toFixed(1) : 0,
    },
  });
}
