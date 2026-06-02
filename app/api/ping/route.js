// Keep-warm 端點：給 cron-job.org 每 5 分鐘 ping 一次，避免 Zeabur serverless 冷啟動
// GET /api/ping → 立即回 200，不碰 DB，極輕量
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: true, ts: Date.now() });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
