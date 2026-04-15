# 小食糖營運系統 (sugarbistro-ops)

## 專案概覽
餐飲品牌「小食糖 Sugar Bistro」的全方位營運管理系統，透過 LINE Bot + Web 後台管理 4 間門市、約 30 名員工。

## 技術架構
- **框架**: Next.js 14 (App Router)
- **資料庫**: Supabase (PostgreSQL) + Storage (圖片)
- **部署**: Zeabur (GitHub 自動部署)
- **API**: LINE Messaging API, Anthropic Claude API, Google Vision API
- **網址**: https://sugarbistro-ops.zeabur.app

## 環境變數
```
SUPABASE_URL, SUPABASE_ANON_KEY
LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET
ANTHROPIC_API_KEY
SITE_URL (https://sugarbistro-ops.zeabur.app)
GOOGLE_VISION_API_KEY
```

## 門市資料
| 門市 | 特性 |
|------|------|
| 台北 | 2人單班，前場+後場，有餐食 |
| 屏東 | 同台北，多義大利麵 |
| 新光左營(百貨) | 單人班，禮盒/麵包/外帶咖啡，做泡芙餅乾 |
| SKM | 早晚班重疊3hr，鬆餅/甜點/咖啡/禮盒 |

## 核心檔案
| 檔案 | 行數 | 功能 |
|------|------|------|
| `app/page.js` | ~2250 | 管理後台 SPA（所有 Tab） |
| `app/api/webhook/route.js` | ~1080 | LINE Bot 主要邏輯 |
| `lib/anthropic.js` | ~274 | AI 辨識（Google Vision OCR + Claude Haiku） |
| `lib/supabase.js` | ~50 | Supabase 客戶端 |
| `lib/line.js` | ~80 | LINE SDK |
| `app/components/SettingsMgr.js` | ~580 | 設定頁面元件 |
| `app/components/WorklogMgr.js` | ~400 | 工作日誌元件 |
| `app/components/utils.js` | ~185 | 共用工具函數 |

## 重要限制
- **Zeabur serverless 超時 10-15 秒**：webhook 內不能做 AI 辨識，必須 3 秒內完成
- **Supabase 查詢不支援 .catch()**：必須用 try-catch
- **LINE replyToken 只能用一次**：後續訊息用 pushMessage
- **費用照片辨識**：webhook 只做存照片+建草稿，AI 在 expense-review 網頁端做
- **expenses insert 只用最小必要欄位**：避免缺欄位 crash
- **store_id="__hq__" 要轉為 null**：總部均攤費用

## 後台 Tab 結構
```
總覽 | 員工 | 排班 | 請假 | 出勤 | 休假表 | 薪資 | 考核 | 獎金
日結 | 存款 | 費用 | 撥款 | 損益
日誌 | 盤點 | 公告 | 設定
```

## LINE Bot 指令
| 指令 | 功能 |
|------|------|
| 打卡 | GPS 打卡（上班/下班） |
| 日結回報 | 拍 POS 日結單 → AI 辨識 |
| 存款回報 | 拍存款單 → AI 辨識 |
| 月結單據 | 拍廠商送貨單 → 存檔+網頁AI |
| 零用金 | 拍收據 → 存檔+網頁AI |
| 總部代付 | 可選「總部」均攤全店 |
| 我的班表 | 查看個人排班 |

## AI 辨識架構
```
Google Vision OCR → 純文字 → Claude Haiku 解析 → JSON
（免費 1000張/月）    （$0.001/張）
失敗時 fallback → Claude Haiku 直接看圖
```

## 部署流程
```bash
git add . && git commit -m "描述" && git push
# Zeabur 自動偵測 GitHub push → 自動部署
```

## SQL 遷移
所有新欄位用 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`，不會破壞現有資料。
遷移檔案在 `migrations/` 目錄。

## 程式碼風格
- 用戶介面語言：繁體中文
- 變數/函數名：英文
- 金額格式：`$1,234`（用 `fmt()` 函數）
- 日期格式：`YYYY-MM-DD`
- 時區：`Asia/Taipei`
- 民國年轉換：民國年 + 1911 = 西元年
