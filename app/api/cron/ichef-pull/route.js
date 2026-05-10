import { pullIchefSettlements } from "@/lib/ichef-pull";

// 每日自動排程入口（給 cron-job.org 等外部排程呼叫）
// 支援 GET/POST/HEAD（cron-job.org 預設可能不是 GET）
//   /api/cron/ichef-pull?key=<CRON_SECRET>
// 參數可選 start, end, store
//
// 多日範圍會先觸發 member sync（4 店序列、每店 ~20s），可能跑超過 1 分鐘
export const maxDuration = 300;

async function handle(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (key !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await pullIchefSettlements({
    start: url.searchParams.get("start"),
    end: url.searchParams.get("end"),
    store: url.searchParams.get("store"),
  });
  return Response.json(result.body, { status: result.status });
}

export async function GET(request) { return handle(request); }
export async function POST(request) { return handle(request); }
export async function HEAD(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  return new Response(null, { status: key === process.env.CRON_SECRET ? 200 : 401 });
}

