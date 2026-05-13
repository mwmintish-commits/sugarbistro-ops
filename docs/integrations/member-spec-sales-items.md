# 給 sugarbistro-member 的請求：新增銷售品項 API

> 這是給 sugarbistro-member 系統的 Claude 看的。請完整複製此檔案內容貼給對方 Claude，他幾乎不需要思考設計，只需要實作下面已寫好的 code。

---

## 任務說明

新增一支 API 給總部營運系統 (sugarbistro-ops) 用，把每天從 iChef 拉的 xlsx 解析成**品項級別的銷售統計**回傳。

ops 系統已經建好接收端 + mock endpoint 驗證工具，您實作完只要打 mock 比對結構即可。

---

## API 規格

```
GET https://sugarbistro-member.zeabur.app/api/admin/ichef/sales-items
Header: Authorization: Bearer <CRON_SECRET>
Query:
  start: YYYY-MM-DD  (預設昨天台北時區)
  end:   YYYY-MM-DD  (預設同 start)
  store: 店代碼 (可選，例 PT)
```

### 預期回傳結構（**請逐字一致**）

```json
{
  "start": "2026-05-10",
  "end": "2026-05-10",
  "storeFilter": null,
  "count": 287,
  "data": [
    {
      "storeCode": "PT",
      "storeName": "屏東店",
      "reportDate": "2026-05-10",
      "transactionCount": 41,
      "voidedCount": 1,
      "totalRevenue": 28450,
      "items": [
        {
          "name": "香草奶油檸檬嫩雞",
          "quantity": 8,
          "unitPrice": 340,
          "revenue": 2720,
          "bySource": { "內用": 6, "外帶": 1, "外送": 1 }
        },
        {
          "name": "指定飲品 無限續杯",
          "quantity": 12,
          "unitPrice": -10,
          "revenue": -120,
          "bySource": { "內用": 12 }
        }
      ],
      "syncedAt": "2026-05-11T03:10:23.456Z"
    }
  ]
}
```

---

## 完整實作 code（請直接貼）

### 1. `lib/ichef-sales-parser.js`（新檔案）

純解析函式，給 xlsx Buffer + metadata，回傳結構化品項統計。
無相依：用 SheetJS (`xlsx` npm 套件) 與內建 Node API。

```javascript
// lib/ichef-sales-parser.js
import * as XLSX from "xlsx";

/**
 * 解析 iChef 每日結帳明細 xlsx，聚合成品項層級統計
 * @param {Buffer} xlsxBuffer  - xlsx 檔案 Buffer
 * @param {Object} meta        - { storeCode, storeName, reportDate }
 * @returns {Object} 結構同 API data[] 內每筆
 */
export function parseIchefSalesXlsx(xlsxBuffer, meta) {
  const wb = XLSX.read(xlsxBuffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // 第 1 列是欄位標題，從第 2 列開始
  // 欄位 index：
  //   1=發票號碼, 3=結帳時間, 6=訂單來源, 7=訂單種類,
  //   12=發票金額, 13=支付模組, 17=目前概況, 21=品項
  const COL = { invoice: 1, time: 3, source: 6, type: 7, amount: 12, payment: 13, status: 17, items: 21 };

  const seenInvoices = new Set();      // 同發票號碼的多列只處理 1 次（分期付款 / 部分用券）
  const itemMap = {};                  // { name → { qty, total, prices, by_source } }
  const seenForRevenue = new Set();    // 計營收用（同發票要把多列加總）
  let voidedCount = 0;
  let validTxCount = 0;
  let totalRevenue = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[COL.invoice] || row[COL.invoice] === "--") continue;

    const invoice = String(row[COL.invoice]);
    const status = String(row[COL.status] || "");
    const isVoided = status.startsWith("已作廢");

    // 作廢的整筆不算（每張發票只計算 1 次 voided）
    if (isVoided) {
      if (!seenInvoices.has(invoice)) {
        voidedCount++;
        seenInvoices.add(invoice);
      }
      continue;
    }

    // 營收：每列的「發票金額」都要加（同發票多列代表分期/部分用券，分別記）
    if (!seenForRevenue.has(invoice + "|" + i)) {
      const amount = Number(row[COL.amount] || 0);
      if (Number.isFinite(amount)) totalRevenue += amount;
      seenForRevenue.add(invoice + "|" + i);
    }

    // 品項：同發票只解析 1 次（avoid 雙重計算）
    if (seenInvoices.has(invoice)) continue;
    seenInvoices.add(invoice);
    validTxCount++;

    const items = parseItemString(row[COL.items]);
    const source = classifySource(row[COL.source], row[COL.type]);

    for (const it of items) {
      const key = it.name;
      if (!itemMap[key]) {
        itemMap[key] = { name: it.name, quantity: 0, total: 0, by_source: {} };
      }
      itemMap[key].quantity += 1;
      itemMap[key].total += it.price;
      itemMap[key].by_source[source] = (itemMap[key].by_source[source] || 0) + 1;
    }
  }

  const itemList = Object.values(itemMap)
    .map(it => ({
      name: it.name,
      quantity: it.quantity,
      unitPrice: Math.round((it.total / it.quantity) * 100) / 100,
      revenue: Math.round(it.total * 100) / 100,
      bySource: it.by_source,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    storeCode: meta.storeCode,
    storeName: meta.storeName,
    reportDate: meta.reportDate,
    transactionCount: validTxCount,
    voidedCount,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    items: itemList,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * 解析「品項」欄位字串
 * 範例：「香草奶油檸檬嫩雞 $340.0,指定飲品 無限續杯 $-40.0」
 * 回傳: [{ name: "香草奶油檸檬嫩雞", price: 340 }, ...]
 */
function parseItemString(str) {
  if (!str || str === "--") return [];
  const result = [];
  for (const piece of String(str).split(",")) {
    const m = piece.trim().match(/^(.+?)\s+\$(-?\d+(?:\.\d+)?)$/);
    if (m) {
      result.push({ name: m[1].trim(), price: parseFloat(m[2]) });
    }
  }
  return result;
}

/**
 * 訂單來源分類：iChef 的 (訂單來源, 訂單種類) 組合 → 我們的「內用 / 外帶 / 外送 / 其他」
 */
function classifySource(orderSource, orderType) {
  const src = String(orderSource || "").trim();
  const typ = String(orderType || "").trim();
  if (src === "Uber Eats" || src === "UberEats" || typ === "外送") return "外送";
  if (typ === "外帶") return "外帶";
  if (typ === "內用") return "內用";
  return "其他";
}
```

### 2. `app/api/admin/ichef/sales-items/route.js`（新檔案）

路由處理：認證 + 多店日期範圍迭代 + 呼叫 parser。

⚠️ 您需要把以下兩處的 `// TODO` 換成實際邏輯（您系統怎麼存 / 取 xlsx）：
- `fetchStores()`：回傳要處理的店清單
- `fetchXlsxBuffer(storeCode, date)`：拿到該店該日的 xlsx Buffer

```javascript
// app/api/admin/ichef/sales-items/route.js
import { parseIchefSalesXlsx } from "@/lib/ichef-sales-parser";
// import { supabase } from "@/lib/supabase"; // 您的 DB client

export const maxDuration = 300; // 5 分鐘（多日 × 多店可能跑久）

function yesterdayTaipei() {
  const t = new Date(Date.now() + 8 * 3600_000);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

function* dateRange(start, end) {
  let cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    yield cur.toISOString().slice(0, 10);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
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

  // TODO: 把這裡換成您系統真實的 store 清單（建議從 Store table 撈）
  const stores = await fetchStores(storeFilter); // [{ code, name }, ...]

  const data = [];
  let total = 0;
  for (const store of stores) {
    for (const date of dateRange(start, end)) {
      // TODO: 把這裡換成您系統實際拿 xlsx 的方式
      // 例如 Supabase Storage 下載 / 本地 fs / S3 等
      const buf = await fetchXlsxBuffer(store.code, date);
      if (!buf) continue;
      try {
        const result = parseIchefSalesXlsx(buf, {
          storeCode: store.code,
          storeName: store.name,
          reportDate: date,
        });
        data.push(result);
        total += result.items.length;
      } catch (e) {
        console.error(`parse failed ${store.code} ${date}:`, e?.message);
      }
    }
  }

  return Response.json({
    start, end,
    storeFilter,
    count: total,
    data,
  });
}

// ============ TODO：請依您系統實際結構實作這兩個 helper ============

async function fetchStores(filter) {
  // 範例：從 Store table 撈
  // const { data } = await supabase.from("Store").select("code, name").eq("is_active", true);
  // if (filter) return (data || []).filter(s => s.code === filter);
  // return data || [];

  // 暫時 hardcode（請依實際代碼調整）
  const all = [
    { code: "YK", name: "永康本店" },
    { code: "PT", name: "屏東店" },
    { code: "SKM_ZY", name: "新光左營店" },
    { code: "SKM_OUTLET", name: "SKM Outlet" },
  ];
  return filter ? all.filter(s => s.code === filter) : all;
}

async function fetchXlsxBuffer(storeCode, date) {
  // 範例 1：Supabase Storage
  // const path = `ichef-sales/${storeCode}/${date}.xlsx`;
  // const { data, error } = await supabase.storage.from("reports").download(path);
  // if (error || !data) return null;
  // return Buffer.from(await data.arrayBuffer());

  // 範例 2：本機檔案
  // const fs = await import("fs/promises");
  // const path = `/var/data/ichef/${storeCode}/${date}.xlsx`;
  // try { return await fs.readFile(path); } catch { return null; }

  throw new Error("請實作 fetchXlsxBuffer：依您系統實際存放方式取 xlsx Buffer");
}
```

### 3. `package.json` 加入依賴

如果還沒裝 SheetJS：

```bash
npm install xlsx
```

或編輯 `package.json`：
```json
"dependencies": {
  "xlsx": "^0.18.5"
}
```

---

## 驗證實作正確性（兩步驟）

實作完成後：

### Step 1：自我測試
```bash
curl 'https://sugarbistro-member.zeabur.app/api/admin/ichef/sales-items?start=2026-05-10&end=2026-05-10&store=PT' \
  -H "Authorization: Bearer $CRON_SECRET"
```

確認回傳結構**逐欄逐字**符合上方規格。

### Step 2：對照 ops 的 mock endpoint

打 ops 那邊的 mock：
```bash
curl 'https://sugarbistro-ops.zeabur.app/api/_mock/ichef-sales-items?start=2026-05-10&end=2026-05-10' \
  -H "Authorization: Bearer $CRON_SECRET"
```

兩邊回傳的 **key 命名 / 結構 / 型別** 必須完全一致（金額可不同，因為一個是真資料一個是 mock）。

---

## 邊界 case 處理（已寫進 parser，僅供您理解）

| 情境 | 處理 |
|------|------|
| 已作廢交易（status 開頭「已作廢」）| 整筆跳過，計入 voidedCount |
| 同發票多列（分期/部分用券）| 品項只解析 1 次（避免雙重計算），但 totalRevenue 把多列 amount 加總 |
| 兌換券 `$0` 品項 | 保留，revenue 為 0 |
| 折抵 `$-40` 品項 | 保留，revenue 為負（會抵消主品項） |
| 套餐升級「(+49優惠) $49.0」 | 視為獨立品項 |

---

## 完成標準

✅ 打 sales-items endpoint 能回傳 JSON
✅ 結構與本文「預期回傳結構」逐字一致
✅ 5/10 屏東店資料 transactionCount = 41, voidedCount = 1（依實際資料）
✅ items 列表按 revenue 由大到小排序
✅ 401 if no Authorization Bearer

完成後請告知 ops 端，ops 會打這支 API 拉資料寫進 daily_sales_items 表。
