import { supabase, eom } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const store_id = searchParams.get("store_id");
  const compare = searchParams.get("compare"); // "stores" for ✦26

  if (!month) return Response.json({ error: "需要指定月份" }, { status: 400 });

  // 收入：門市營收
  let revQ = supabase.from("daily_settlements").select("net_sales, store_id, stores(name)")
    .gte("date", month + "-01").lte("date", eom(month));
  if (store_id) revQ = revQ.eq("store_id", store_id);
  const { data: revenues } = await revQ;

  const totalRevenue = (revenues || []).reduce((s, r) => s + Number(r.net_sales || 0), 0);
  const revenueByStore = {};
  for (const r of revenues || []) {
    const name = r.stores?.name || "未知";
    revenueByStore[name] = (revenueByStore[name] || 0) + Number(r.net_sales || 0);
  }

  // ✦25 B2B/OEM訂單收入
  let ordQ = supabase.from("orders").select("total_amount, status, clients(name, type)")
    .in("status", ["delivered", "paid"])
    .gte("order_date", month + "-01").lte("order_date", eom(month));
  const { data: orders } = await ordQ;
  const b2bRevenue = (orders || []).filter(o => o.clients?.type === "b2b")
    .reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const oemRevenue = (orders || []).filter(o => o.clients?.type === "oem")
    .reduce((s, o) => s + Number(o.total_amount || 0), 0);

  // 支出
  let expQ = supabase.from("expenses").select("amount, expense_type, stores(name)")
    .gte("date", month + "-01").lte("date", eom(month)).in("status", ["pending", "approved"]);
  if (store_id) expQ = expQ.eq("store_id", store_id);
  const { data: expenses } = await expQ;

  const vendorTotal = (expenses || []).filter(e => e.expense_type === "vendor").reduce((s, e) => s + Number(e.amount || 0), 0);
  const pettyTotal = (expenses || []).filter(e => e.expense_type === "petty_cash").reduce((s, e) => s + Number(e.amount || 0), 0);
  const hqTotal = (expenses || []).filter(e => e.expense_type === "hq_advance").reduce((s, e) => s + Number(e.amount || 0), 0);
  const expenseByStore = {};
  for (const e of expenses || []) {
    const name = e.stores?.name || "未知";
    expenseByStore[name] = (expenseByStore[name] || 0) + Number(e.amount || 0);
  }

  // 人事成本
  const [y, m] = month.split("-").map(Number);
  const { data: payrolls } = await supabase.from("payroll_records").select("net_salary, store_id, stores(name)")
    .eq("year", y).eq("month", m);
  const laborTotal = (payrolls || []).reduce((s, p) => s + Number(p.net_salary || 0), 0);
  const laborByStore = {};
  for (const p of payrolls || []) {
    const name = p.stores?.name || "未知";
    laborByStore[name] = (laborByStore[name] || 0) + Number(p.net_salary || 0);
  }

  const totalExpense = vendorTotal + pettyTotal + hqTotal + laborTotal;
  const totalIncome = totalRevenue + b2bRevenue + oemRevenue;
  const net = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? Math.round(net / totalIncome * 100) : 0;

  // ✦26 門市比較
  let storeComparison = null;
  if (compare === "stores") {
    const { data: allStores } = await supabase.from("stores").select("id, name").eq("is_active", true);
    storeComparison = (allStores || []).map(st => ({
      name: st.name,
      revenue: revenueByStore[st.name] || 0,
      expense: (expenseByStore[st.name] || 0) + (laborByStore[st.name] || 0),
      profit: (revenueByStore[st.name] || 0) - (expenseByStore[st.name] || 0) - (laborByStore[st.name] || 0),
      margin: (revenueByStore[st.name] || 0) > 0
        ? Math.round(((revenueByStore[st.name] || 0) - (expenseByStore[st.name] || 0) - (laborByStore[st.name] || 0)) / (revenueByStore[st.name] || 0) * 100)
        : 0,
    }));
  }

  // ✦27 趨勢（最近6個月）
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const td = new Date(y, m - 1 - i, 1);
    const tm = td.getFullYear() + "-" + String(td.getMonth() + 1).padStart(2, "0");
    const { data: tr } = await supabase.from("daily_settlements").select("net_sales")
      .gte("date", tm + "-01").lte("date", eom(tm));
    trend.push({ month: tm, revenue: (tr || []).reduce((s, r) => s + Number(r.net_sales || 0), 0) });
  }

  return Response.json({
    revenue: { total: totalRevenue, byStore: revenueByStore, b2b: b2bRevenue, oem: oemRevenue },
    expenses: { total: totalExpense, vendor: vendorTotal, petty_cash: pettyTotal, hq_advance: hqTotal, labor: laborTotal, byStore: expenseByStore },
    profit: { net, margin, total_income: totalIncome },
    storeComparison,
    trend,
  });
}
