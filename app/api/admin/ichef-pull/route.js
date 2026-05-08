import { pullIchefSettlements } from "@/lib/ichef-pull";

// 後台手動觸發補抓（不需 CRON_SECRET，但需登入後台才能呼叫）
// POST /api/admin/ichef-pull
//   body: { start?: "YYYY-MM-DD", end?: "YYYY-MM-DD", store?: "YK" }
export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch {}
  const result = await pullIchefSettlements({
    start: body.start || null,
    end: body.end || null,
    store: body.store || null,
  });
  return Response.json(result.body, { status: result.status });
}
