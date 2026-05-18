import { supabase, eom } from "@/lib/supabase";
import { computeDepositReconciliation } from "@/lib/deposit-utils";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const store_id = searchParams.get("store_id");

  let query = supabase
    .from("deposits")
    .select("*, stores(name)")
    .order("deposit_date", { ascending: false });

  if (month) {
    query = query.gte("deposit_date", `${month}-01`).lte("deposit_date", `${eom(month)}`);
  }
  if (store_id) {
    query = query.eq("store_id", store_id);
  }

  const { data, error } = await query.limit(100);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "update") {
    const { deposit_id, ...rest } = body;
    delete rest.action;
    const updates = {};
    ["difference_explanation","amount","period_start","period_end","deposit_date","status"].forEach(k=>{if(rest[k]!==undefined)updates[k]=rest[k];});

    // 若金額或對帳區間有變動 → 自動重算 expected_cash / difference / status
    const needsRecompute = ["amount","period_start","period_end"].some(k => rest[k] !== undefined);
    if (needsRecompute) {
      const { data: cur } = await supabase.from("deposits")
        .select("store_id, amount, period_start, period_end")
        .eq("id", deposit_id).single();
      if (cur) {
        const recon = await computeDepositReconciliation({
          store_id: cur.store_id,
          amount: updates.amount ?? cur.amount,
          period_start: updates.period_start ?? cur.period_start,
          period_end: updates.period_end ?? cur.period_end,
        });
        updates.expected_cash = recon.expected;
        updates.difference = recon.difference;
        // 使用者沒明確傳 status 才覆蓋；尊重手動標記
        if (rest.status === undefined) updates.status = recon.status;
      }
    }

    const { data, error } = await supabase.from("deposits")
      .update(updates).eq("id", deposit_id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (body.action === "delete") {
    const { error } = await supabase.from("deposits").delete().eq("id", body.deposit_id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
