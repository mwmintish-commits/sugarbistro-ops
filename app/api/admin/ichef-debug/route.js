// 診斷端點：檢查環境變數與服務狀態（不洩漏實際值）
// GET /api/admin/ichef-debug
export async function GET() {
  const cronSecret = process.env.CRON_SECRET;
  return Response.json({
    cron_secret_present: !!cronSecret,
    cron_secret_length: cronSecret ? cronSecret.length : 0,
    cron_secret_preview: cronSecret ? cronSecret.slice(0, 3) + "***" + cronSecret.slice(-2) : null,
    node_env: process.env.NODE_ENV || "unknown",
    site_url: process.env.SITE_URL || "unset",
    server_time: new Date().toISOString(),
    server_time_taipei: new Date(Date.now() + 8 * 3600_000).toISOString().replace("Z", "+08:00"),
    deploy_check: "如果看到這個 response、cron_secret_present 是 false，代表 Zeabur 的 sugarbistro-ops 服務沒讀到 CRON_SECRET 環境變數",
  });
}
