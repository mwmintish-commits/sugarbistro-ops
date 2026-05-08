import { pullIchefSettlements } from "@/lib/ichef-pull";

// 每日自動排程入口（給 cron-job.org 等外部排程呼叫）
// GET /api/cron/ichef-pull?key=<CRON_SECRET>
//   參數可選 start, end, store
export async function GET(request) {
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
