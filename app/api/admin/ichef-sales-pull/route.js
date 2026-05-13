import { pullIchefSalesItems } from "@/lib/sales-pull";

// 後台手動觸發品項銷售匯入
// POST /api/admin/ichef-sales-pull
//   body: { start?, end?, store?, useMock? }

export const maxDuration = 300;

export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch {}
  const result = await pullIchefSalesItems({
    start: body.start || null,
    end: body.end || null,
    store: body.store || null,
    useMock: !!body.useMock,
  });
  return Response.json(result.body, { status: result.status });
}
