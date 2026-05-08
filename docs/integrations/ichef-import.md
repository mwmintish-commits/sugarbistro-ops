# iCHEF 日結自動匯入

## 架構

```
iCHEF API
   │
   ▼ 03:10 cron 抓
sugarbistro-member（會員系統）
   │  GET /api/admin/ichef/account-report
   │  Header: Authorization: Bearer <CRON_SECRET>
   ▼ 04:00 cron 拉
sugarbistro-ops（本系統）
   │  daily_settlements 表 upsert by (store_id, date)
   ▼
管理後台 顯示
```

## 上線步驟（一次性設定）

### 1. 跑 SQL 遷移

在 Supabase SQL Editor 執行 `migrations/ichef-integration.sql`：

```sql
ALTER TABLE stores ADD COLUMN IF NOT EXISTS ichef_code TEXT;
CREATE INDEX IF NOT EXISTS stores_ichef_code_idx ON stores(ichef_code) WHERE ichef_code IS NOT NULL;
ALTER TABLE daily_settlements ADD COLUMN IF NOT EXISTS ichef_synced_at TIMESTAMPTZ;
ALTER TABLE daily_settlements ADD COLUMN IF NOT EXISTS ichef_short_amount NUMERIC DEFAULT 0;
```

### 2. 在 Zeabur 設定環境變數

`sugarbistro-ops` 服務的環境變數加：

```
CRON_SECRET=<跟會員系統一樣的密鑰>
```

⚠️ 必須跟 `sugarbistro-member` Zeabur 上的 `CRON_SECRET` 完全一樣，否則會員系統的 API 會 401。

### 3. 設定門市對應碼

進後台 → 設定 → 門市管理，每個門市填「iCHEF 對應碼」：

| 小食糖門市 | iCHEF 對應碼 |
|-----------|-----|
| （請依實際填） | YK |
| （請依實際填） | PT |
| （請依實際填） | SKM_ZY |
| （請依實際填） | SKM_OUTLET |

或直接在 Supabase SQL Editor 跑：

```sql
UPDATE stores SET ichef_code = 'YK'         WHERE name = '永康本店';
UPDATE stores SET ichef_code = 'PT'         WHERE name = '屏東門市';
UPDATE stores SET ichef_code = 'SKM_ZY'     WHERE name = '新光左營店';
UPDATE stores SET ichef_code = 'SKM_OUTLET' WHERE name = 'SKM Outlet';
```

### 4. 設定 cron-job.org（每日 04:00 自動拉）

到 https://cron-job.org/ 新增一個 job：

- **URL**：`https://sugarbistro-ops.zeabur.app/api/cron/ichef-pull?key=<CRON_SECRET>`
- **Schedule**：`0 4 * * *`（每天 04:00）
- **Timezone**：Asia/Taipei
- **Method**：GET

⚠️ URL 裡的 `<CRON_SECRET>` 直接填值，跟會員系統那邊同一個。

### 5. 立即測試

- 後台 → 設定 → 「🍽️ iCHEF 自動同步」區塊 → 「🔄 立即補抓」按鈕
- 預設抓昨天，可指定日期範圍
- 結果會回 `inserted / updated / skippedNoMap / skippedManual`

## API 規格

### GET `/api/cron/ichef-pull?key=<CRON_SECRET>`

外部 cron 用。需要 query string 提供 secret。

**Query**：
| 參數 | 說明 | 預設 |
|------|------|------|
| `key` | CRON_SECRET（必要） | - |
| `start` | YYYY-MM-DD | 昨天（台北時區） |
| `end` | YYYY-MM-DD | 同 start |
| `store` | 單店過濾（會員系統 storeCode） | 全部 |

### POST `/api/admin/ichef-pull`

後台手動觸發用。Body：
```json
{ "start": "2026-05-01", "end": "2026-05-08", "store": "YK" }
```

### 回傳格式

```json
{
  "success": true,
  "range": { "start": "2026-05-08", "end": "2026-05-08" },
  "fetched": 4,
  "inserted": 2,
  "updated": 2,
  "skippedNoMap": 0,
  "skippedManual": 0,
  "unmapped_codes": [],
  "errors": [],
  "message": "匯入完成：新增 2、更新 2、未對應門市 0、已對帳跳過 0"
}
```

## 欄位對應

| 會員系統欄位 | 我們系統欄位 | 說明 |
|------------|------------|------|
| `storeCode` | 透過 `stores.ichef_code` 對應到 `store_id` | YK / PT / SKM_ZY / SKM_OUTLET |
| `reportDate` | `date` | YYYY-MM-DD |
| `totalAmount` | `net_sales` | 營業淨額 |
| `cancelledCount` | `void_invoice_count` | 作廢張數 |
| `shortAmount` | `ichef_short_amount` | 短少金額 |
| - | `ichef_synced_at` | 最後同步時間 |

⚠️ 會員系統目前**沒給支付方式拆分**（cash / line_pay / twqr 等不會自動填），這些欄位需手動填，或請會員系統 API 增加細項。

## 安全規則

- **已對帳的記錄不覆蓋**：若 `daily_settlements.deposit_id` 已連結存款單，則僅更新 `ichef_synced_at` / `ichef_short_amount`，**不覆蓋** `net_sales` / `void_invoice_count`，避免改動已核對的數字
- **未對應 storeCode 跳過**：若會員系統送來的 storeCode 在我們 stores 表裡找不到對應，記到 audit log 但不報錯
- **idempotent**：重複呼叫同日期不會重複插入（用 `(store_id, date)` 做 upsert key）

## 檔案位置

| 檔案 | 用途 |
|------|------|
| `lib/ichef-pull.js` | 核心 pull 邏輯（共用） |
| `app/api/cron/ichef-pull/route.js` | 外部 cron 入口（key 認證） |
| `app/api/admin/ichef-pull/route.js` | 後台手動入口 |
| `app/components/SettingsMgr.js` | 設定頁 UI |
| `migrations/ichef-integration.sql` | 資料表遷移 |
