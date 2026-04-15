import { supabase, eom } from "@/lib/supabase";
import { pushText } from "@/lib/line";

const fmt = n => "$" + Number(n || 0).toLocaleString();

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const quarter = Number(searchParams.get("quarter"));
  if (!year || !quarter) return Response.json({ error: "需指定年度季度" }, { status: 400 });

  const qMonths = [(quarter - 1) * 3 + 1, (quarter - 1) * 3 + 2, (quarter - 1) * 3 + 3];

  // 各門市各月達標率+損益
  const { data: allStores } = await supabase.from("stores").select("id, name, daily_target").eq("is_active", true);
  const storeData = [];

  for (const store of allStores || []) {
    const months = [];
    let qRevenue = 0, qExpense = 0;

    for (const m of qMonths) {
      const mk = year + "-" + String(m).padStart(2, "0");
      const dim = new Date(year, m, 0).getDate();
      const target = (store.daily_target || 0) * dim;

      const { data: stls } = await supabase.from("daily_settlements").select("net_sales")
        .eq("store_id", store.id).gte("date", mk + "-01").lte("date", eom(mk));
      const revenue = (stls || []).reduce((s, r) => s + Number(r.net_sales || 0), 0);

      const { data: exps } = await supabase.from("expenses").select("amount")
        .eq("store_id", store.id).in("status", ["pending", "approved"])
        .gte("date", mk + "-01").lte("date", eom(mk));
      const expense = (exps || []).reduce((s, e) => s + Number(e.amount || 0), 0);

      const rate = target > 0 ? Math.round(revenue / target * 100) : 0;
      months.push({ month: mk, revenue, target, rate, expense });
      qRevenue += revenue;
      qExpense += expense;
    }

    const qNet = qRevenue - qExpense;
    const isLoss = qNet < 0;

    // 獎金池
    const { data: pool } = await supabase.from("bonus_pools")
      .select("*").eq("store_id", store.id).eq("year", year).eq("quarter", quarter).single()
      .catch(() => ({ data: null }));

    storeData.push({
      store_id: store.id, name: store.name,
      months, q_revenue: qRevenue, q_expense: qExpense, q_net: qNet, is_loss: isLoss,
      pool: pool || null
    });
  }

  // 考核結果
  const { data: reviews } = await supabase.from("performance_reviews")
    .select("*, employees:employee_id(name, role, is_active, store_id, line_uid)")
    .eq("year", year).eq("quarter", quarter);

  // 獎金明細
  const { data: bonuses } = await supabase.from("bonus_records")
    .select("*, employees:employee_id(name, is_active, store_id)")
    .eq("year", year).eq("quarter", quarter);

  return Response.json({ stores: storeData, reviews, bonuses });
}

export async function POST(request) {
  const body = await request.json();

  // 儲存獎金池（總部填入）
  if (body.action === "set_pool") {
    const { store_id, year, quarter, total_amount, pay_date } = body;
    const { data } = await supabase.from("bonus_pools").upsert({
      store_id, year, quarter, total_amount, pay_date, status: "draft"
    }, { onConflict: "store_id,year,quarter" }).select().single();
    return Response.json({ data });
  }

  // 計算個人獎金
  if (body.action === "calculate") {
    const { year, quarter } = body;

    const { data: pools } = await supabase.from("bonus_pools").select("*")
      .eq("year", year).eq("quarter", quarter);

    const qMonths = [(quarter - 1) * 3 + 1, (quarter - 1) * 3 + 2, (quarter - 1) * 3 + 3];
    const startDate = year + "-" + String(qMonths[0]).padStart(2, "0") + "-01";
    const endDate = eom(year + "-" + String(qMonths[2]).padStart(2, "0"));

    const { data: reviews } = await supabase.from("performance_reviews")
      .select("employee_id, store_id, bonus_coefficient, employees:employee_id(name, role, is_active)")
      .eq("year", year).eq("quarter", quarter).eq("status", "approved");

    let calculated = 0;
    for (const pool of pools || []) {
      if (!pool.total_amount || pool.total_amount <= 0) continue;

      const storeReviews = (reviews || []).filter(r => r.store_id === pool.store_id && r.employees?.is_active);

      // 計算每人加權工時
      const empHours = [];
      for (const rev of storeReviews) {
        const { data: clocks } = await supabase.from("attendances")
          .select("work_hours").eq("employee_id", rev.employee_id).eq("type", "clock_out")
          .gte("date", startDate).lte("date", endDate);
        const hours = (clocks || []).reduce((s, c) => s + Number(c.work_hours || 8), 0);
        const weight = rev.employees?.role === "store_manager" ? 1.2 : 1.0;
        empHours.push({
          employee_id: rev.employee_id, hours, weight,
          weighted: hours * weight, coefficient: rev.bonus_coefficient
        });
      }

      const totalWeighted = empHours.reduce((s, e) => s + e.weighted, 0);

      for (const eh of empHours) {
        const ratio = totalWeighted > 0 ? eh.weighted / totalWeighted : 0;
        const gross = Math.round(pool.total_amount * ratio * eh.coefficient);
        const excluded = eh.coefficient === 0 || !reviews.find(r => r.employee_id === eh.employee_id)?.employees?.is_active;

        await supabase.from("bonus_records").upsert({
          employee_id: eh.employee_id, store_id: pool.store_id,
          year, quarter, weighted_hours: eh.weighted,
          review_coefficient: eh.coefficient, share_ratio: ratio,
          gross_amount: excluded ? 0 : gross,
          excluded, exclude_reason: excluded ? (eh.coefficient === 0 ? "考核未達標" : "已離職") : null
        }, { onConflict: "employee_id,year,quarter" });
        calculated++;
      }
    }
    return Response.json({ success: true, calculated });
  }

  // LINE發送獎金條
  if (body.action === "send_line") {
    const { year, quarter } = body;
    const { data: bonuses } = await supabase.from("bonus_records")
      .select("*, employees:employee_id(name, line_uid)")
      .eq("year", year).eq("quarter", quarter).eq("excluded", false);

    let sent = 0;
    for (const b of bonuses || []) {
      if (!b.employees?.line_uid || b.gross_amount <= 0) continue;
      const msg = "🏆 " + year + " Q" + quarter + " 績效獎金\n━━━━━━━━━━\n👤 " + b.employees.name +
        "\n💰 獎金 " + fmt(b.gross_amount) +
        "\n📊 考核係數 ×" + b.review_coefficient +
        "\n\n感謝你的付出！";
      await pushText(b.employees.line_uid, msg).catch(() => {});
      sent++;
    }
    return Response.json({ success: true, sent });
  }

  // 確認發放
  if (body.action === "confirm") {
    const { year, quarter } = body;
    await supabase.from("bonus_pools").update({
      status: "confirmed", confirmed_at: new Date().toISOString()
    }).eq("year", year).eq("quarter", quarter);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
