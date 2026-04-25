import { supabase } from "@/lib/supabase";

// 員工面板（admin/manager）頂部稽核摘要：待審件數、未日結門市數
export async function GET() {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });

  const [leavesRes, expensesRes, amendsRes, settlementsRes, storesRes] = await Promise.all([
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("expenses").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("clock_amendments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("settlements").select("store_id").eq("date", today),
    supabase.from("stores").select("id").eq("is_active", true),
  ]);

  const pendingLeaves = leavesRes.count || 0;
  const pendingExpenses = expensesRes.count || 0;
  const pendingAmends = amendsRes.count || 0;
  const totalPending = pendingLeaves + pendingExpenses + pendingAmends;

  const settledStores = new Set((settlementsRes.data || []).map(r => r.store_id));
  const totalStores = (storesRes.data || []).length;
  const unsettledStoresCount = Math.max(0, totalStores - settledStores.size);

  return Response.json({
    pending: {
      total: totalPending,
      leaves: pendingLeaves,
      expenses: pendingExpenses,
      amendments: pendingAmends,
    },
    settlement: {
      unsettled: unsettledStoresCount,
      total: totalStores,
    },
  });
}
