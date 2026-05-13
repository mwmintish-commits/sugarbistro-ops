import { pullIchefSalesItems } from "@/lib/sales-pull";

// 每日自動排程拉品項銷售（給 cron-job.org 用）
// GET /api/cron/ichef-sales-pull?key=<CRON_SECRET>
//   start / end / store 可選
//   mock=1 → 改打 ops mock，給 member API 還沒實作時測試

export const maxDuration = 300;

async function handle(request) {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await pullIchefSalesItems({
    start: url.searchParams.get("start"),
    end: url.searchParams.get("end"),
    store: url.searchParams.get("store"),
    useMock: url.searchParams.get("mock") === "1",
  });
  return Response.json(result.body, { status: result.status });
}

export async function GET(request) { return handle(request); }
export async function POST(request) { return handle(request); }
