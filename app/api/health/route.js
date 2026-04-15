export async function GET() {
  return Response.json({
    status: "ok",
    service: "小食糖營運系統",
    timestamp: new Date().toISOString(),
  });
}
