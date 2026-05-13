// Mock endpoint：供 sugarbistro-member 那邊實作 sales-items API 時對照結構
// 完成實作後，兩邊 JSON 結構（key 命名/層級/型別）應該完全一致
//
// GET /api/_mock/ichef-sales-items?start=2026-05-10&end=2026-05-10&store=PT
// Auth: Bearer <CRON_SECRET>

function yesterdayTaipei() {
  const t = new Date(Date.now() + 8 * 3600_000);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

export async function GET(request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const start = url.searchParams.get("start") || yesterdayTaipei();
  const end = url.searchParams.get("end") || start;
  const storeFilter = url.searchParams.get("store") || null;

  // 模擬：屏東 5/10 真實資料的縮影版（依該日 xlsx 內容估算）
  const items = [
    { name: "香草奶油檸檬嫩雞", quantity: 8, unitPrice: 380, revenue: 3040, bySource: { 內用: 6, 外帶: 1, 外送: 1 } },
    { name: "鬱金香咖哩嫩雞", quantity: 5, unitPrice: 326, revenue: 1630, bySource: { 內用: 5 } },
    { name: "棕櫚糖戚風蛋糕", quantity: 4, unitPrice: 160, revenue: 640, bySource: { 外帶: 3, 外送: 1 } },
    { name: "鬱金香咖哩鮮蝦", quantity: 3, unitPrice: 405, revenue: 1215, bySource: { 內用: 3 } },
    { name: "柬式酸辣椰奶鮮蝦", quantity: 3, unitPrice: 392, revenue: 1175, bySource: { 內用: 3 } },
    { name: "原味奶油厚鬆餅", quantity: 3, unitPrice: 167, revenue: 500, bySource: { 內用: 3 } },
    { name: "指定飲品 無限續杯", quantity: 18, unitPrice: -3, revenue: -50, bySource: { 內用: 18 } },
    { name: "法式奶油濃湯（+49優惠）", quantity: 2, unitPrice: 49, revenue: 98, bySource: { 內用: 2 } },
    { name: "咖啡拿鐵", quantity: 2, unitPrice: 150, revenue: 300, bySource: { 內用: 1, 外送: 1 } },
    { name: "手標泰式鮮奶茶", quantity: 2, unitPrice: 160, revenue: 320, bySource: { 內用: 1, 外送: 1 } },
    { name: "8吋棕糖戚風蛋糕", quantity: 1, unitPrice: 1280, revenue: 1280, bySource: { 外帶: 1 } },
    { name: "其他收入", quantity: 1, unitPrice: 200, revenue: 200, bySource: { 外帶: 1 } },
  ];

  const allStores = [
    { storeCode: "PT", storeName: "屏東店" },
    { storeCode: "YK", storeName: "永康本店" },
    { storeCode: "SKM_ZY", storeName: "新光左營店" },
    { storeCode: "SKM_OUTLET", storeName: "SKM Outlet" },
  ];
  const stores = storeFilter ? allStores.filter(s => s.storeCode === storeFilter) : allStores;

  const data = [];
  let total = 0;
  let cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    const date = cur.toISOString().slice(0, 10);
    for (const s of stores) {
      const result = {
        storeCode: s.storeCode,
        storeName: s.storeName,
        reportDate: date,
        transactionCount: 41,
        voidedCount: 1,
        totalRevenue: 28450,
        items,
        syncedAt: new Date().toISOString(),
      };
      data.push(result);
      total += items.length;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return Response.json({
    start, end, storeFilter,
    count: total,
    data,
    _note: "此為 mock，供 sugarbistro-member 對照結構用。完成實作後請替換來源。",
  });
}
