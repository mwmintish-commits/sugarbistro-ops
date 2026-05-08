import { pullIchefSettlements } from "@/lib/ichef-pull";

// 後台手動觸發補抓（不需 CRON_SECRET，但需登入後台才能呼叫）
// POST /api/admin/ichef-pull
//   body: { start?: "YYYY-MM-DD", end?: "YYYY-MM-DD", store?: "YK" }
// 多日範圍會先觸發 member sync（4 店序列、每店 ~20s），可能跑超過 1 分鐘
export const maxDuration = 300;

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
