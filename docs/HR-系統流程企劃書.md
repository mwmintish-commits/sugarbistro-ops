# 小食糖人資系統 流程企劃書

> 版本：2026-04-17 | 目標上線日：2026-04-30

---

## 一、系統架構

```
┌─────────────────────────────────────────────┐
│                  員工端（LINE）                │
│  打卡 / 補打卡 / 請假 / 班表 / 假勤 / 面板      │
└──────────────────┬──────────────────────────┘
                   │ LINE Webhook
                   ▼
┌─────────────────────────────────────────────┐
│            Next.js API Routes               │
│  /api/clockin     打卡 + GPS + 遲到/早退      │
│  /api/webhook     LINE Bot 指令路由           │
│  /api/admin/*     後台管理 API               │
│  /api/cron/*      排程任務（缺勤掃描等）        │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│          Supabase (PostgreSQL)              │
│  employees / schedules / attendances        │
│  leave_requests / overtime_records          │
│  payroll_records / performance_reviews      │
└─────────────────────────────────────────────┘
```

---

## 二、核心流程圖

### 流程 A：員工生命週期

```
新增員工 → 產生報到連結 → 員工完成報到
                              │
                    ┌─────────┴──────────┐
                    │  文件齊全？          │
                    │  ✅ 綠色核准鈕       │
                    │  ⚠️ 橘色（可放行）   │
                    └─────────┬──────────┘
                              │
                         總部核准
                              │
                    ┌─────────┴──────────┐
                    │  is_active = true   │
                    │  推 LINE 通知員工    │
                    └─────────┬──────────┘
                              │
                    員工可開始打卡/排班
                              │
                   ┌──────────┴──────────┐
                   │  離職/停用           │
                   │  is_active = false   │
                   └─────────────────────┘
```

### 流程 B：每日打卡 → 出勤

```
排班（schedules）──┐
                   │
        員工 LINE「上班打卡」
                   │
            ┌──────┴──────┐
            │ 有排班？     │
            │ ❌ → 拒絕    │
            │ ✅ → 繼續    │
            └──────┬──────┘
                   │
            ┌──────┴──────┐
            │ GPS 範圍內？  │
            │ ❌ → 拒絕    │
            │ ✅ → 繼續    │
            └──────┬──────┘
                   │
         寫入 attendances
         ├── late_minutes（遲到分鐘）
         ├── work_type（day_type 帶入）
         └── 推 LINE 確認 + 通知主管（若遲到）

              ⋮（工作中）

        員工 LINE「下班打卡」
                   │
         寫入 attendances
         ├── early_leave_minutes（早退分鐘）
         ├── 自動偵測加班（≥30分 → overtime_records）
         └── 推 LINE 確認 + 通知主管（若早退）
```

### 流程 C：排班 → 休息日同意

```
管理者排班（day_type=rest_day）
         │
    系統自動推 LINE
   「📅 休息日加班同意書」
         │
    ┌────┴────┐
    │ 同意？   │
    │ ✅ 生效  │──→ 排班 status=scheduled
    │ ❌ 拒絕  │──→ 排班 status=cancelled
    └─────────┘     ＋通知主管重新安排
```

### 流程 D：請假 → 扣薪

```
員工 LINE「請假」
    │
    ├── 選假別（特休/病假/事假...）
    ├── 選天數（全天/半天）
    ├── 選日期（datetimepicker）
    │
    ▼
leave_requests（status=pending）
    │
    ▼ 主管後台審核
    │
    ├── 核准 → 自動更新排班 + 扣薪計算
    │         病假：扣半薪
    │         事假：扣全薪
    │         特休/婚喪：不扣
    │         補休：扣補休餘額
    │
    └── 駁回 → 通知員工
```

### 流程 E：月薪結算

```
薪資 Tab → 一鍵結算
    │
    ├── 查 attendances（出勤天數）
    ├── 查 overtime_records（加班費/補休）
    ├── 查 schedules day_type（休息日/國定假日）
    ├── 查 leave_requests（請假扣薪）
    ├── 查 employees（底薪/時薪/勞健保級距）
    │
    ▼ 計算公式
    實發 = 底薪
         + 平日加班費（1.34/1.67 階梯）
         + 休息日加班費（1.34/1.67/2.67 階梯）
         + 國定假日加班費（×2 + 加發一日）
         - 勞保自付額
         - 健保自付額
         - 補充保費
         - 請假扣款
         + 津貼加項
         - 扣項
    │
    ▼ 寫入 payroll_records
    │
    ▼ 發送 LINE 薪資條
```

### 流程 F：考核 → 獎金

```
考核 Tab → 一鍵產生（季度）
    │
    ├── 出勤紀律（30分）= 30 - 遲到×3 - 早退×3 - 缺勤×10
    ├── 工作完成度（30分）= 日誌完成率 + 手動調整±5
    ├── 服務態度（20分）= 基礎分 + 手動調整±5
    ├── 違規紀錄（20分）= 20 - 違規扣分
    │
    ▼ 總分 → 獎金係數
    │
    ▼ 獎金 Tab → 設獎金池
    │
    ▼ 按係數 × 加權工時 → 個人獎金
    │
    ▼ 發送 LINE 獎金條
```

---

## 三、排程任務

| 任務 | 頻率 | URL | 功能 |
|------|------|-----|------|
| 缺勤掃描 | 每 15 分鐘（08:00-23:00） | /api/cron/missed-clockin | 有排班未打卡 → LINE 推員工+主管 |
| 每日提醒 | 每日 09:00 | /api/cron | 生日/試用到期/合約到期/補休到期/庫存不足 |

設定方式：cron-job.org 免費帳號，建兩個排程任務。

---

## 四、資料庫關鍵表

| 表名 | 用途 | 關鍵欄位 |
|------|------|---------|
| employees | 員工主檔 | role, is_active, store_id, monthly_salary, hourly_rate |
| schedules | 排班 | employee_id, date, shift_id, day_type, rest_consent |
| attendances | 打卡紀錄 | type(clock_in/out), late_minutes, early_leave_minutes, work_type |
| leave_requests | 請假 | leave_type, status, start_date, end_date, half_day |
| overtime_records | 加班 | overtime_minutes, comp_type(pay/comp), comp_hours, comp_expiry_date |
| payroll_records | 薪資 | base_salary, overtime_pay, holiday_pay, rest_day_pay, net_salary |
| performance_reviews | 考核 | attendance_score, performance_score, service_score, violation_score |
| attendance_alerts | 出勤警告 | alert_type(no_clockin), date |
| clock_amendments | 補打卡 | date, type, amended_time, reason, status |
| shifts | 班別定義 | name, start_time, end_time, role |
| national_holidays | 國定假日 | date, name |
| leave_balances | 假期餘額 | annual_total, year |

---

## 五、缺漏盤點與修繕計畫

### 🔴 尚未完成（建議月底前處理）

| # | 項目 | 現況 | 建議 |
|---|------|------|------|
| 1 | 調班申請 | swap_requests 表存在但無 UI | 加「調班」Tab 或在排班 Tab 增調班按鈕 |
| 2 | 違規管理 | violations 表存在但無管理介面 | 加「違規」Tab：新增違規 → 自動影響考核 |
| 3 | Rich Menu 更新 | 目前 6 格文字按鈕 | 改為 1 個「開啟面板」大按鈕，或設計圖版 Rich Menu |
| 4 | cron-job.org 設定 | 已開發，未部署排程 | 需手動到 cron-job.org 設定 2 個排程 |

### 🟡 部分完成（可月底後優化）

| # | 項目 | 現況 | 建議 |
|---|------|------|------|
| 5 | 績效考核手動分數 | 完成度/服務需手動 ±5 | 長期可接入客訴系統、POS 數據自動計算 |
| 6 | 班表範本 UI | 快速排班可用，但無「另存範本」按鈕 | 加儲存按鈕 + 範本管理列表 |
| 7 | 我的假勤網頁版 | 目前只有 LINE 文字回覆 | 建 /my-attendance 頁面，圖表化呈現 |
| 8 | 合約管理 | 合約簽署完存檔，但無到期追蹤 UI | 在員工詳情加「合約狀態」區塊 |
| 9 | 補休到期 LINE 提醒 | cron 已有判斷，但推送邏輯未接員工 | cron 目前只推管理員，應同時推員工本人 |

### 🟢 已知可接受的限制

| 項目 | 說明 |
|------|------|
| 門市無差異化排班規則 | 4 店同一邏輯；如需差異可用 shifts 定義不同班別 |
| 無 LIFF SDK | 面板透過 oaMessage URL 跳轉，非原生 LIFF webview |
| 無 Homebrew / psql | 本機無法直接跑 SQL，需透過 Supabase SQL Editor |
| 報到文件選填 | 已加後台文件完整度提示，管理者可自行決定是否放行 |

---

## 六、月底上線前 Checklist

- [ ] Supabase 執行 `migrations/add-day-type.sql`（排班 day_type 欄位）
- [ ] Supabase 執行 `migrations/add-early-leave.sql`（早退欄位）
- [ ] Supabase 執行 `migrations/fix-duplicate-payments.sql`（撥款去重 index）
- [ ] cron-job.org 設定缺勤掃描排程（每 15 分鐘）
- [ ] cron-job.org 設定每日提醒排程（每日 09:00）
- [ ] 測試打卡流程（上班 → 下班 → 檢查遲到/早退）
- [ ] 測試補打卡（datetimepicker → 原因選擇 → 主管審核）
- [ ] 測試請假流程（LINE 申請 → 後台審核 → 確認扣薪）
- [ ] 測試排班休息日同意流程
- [ ] 測試薪資結算 → LINE 薪資條
- [ ] 確認所有員工已完成報到 + 啟用
- [ ] 確認各門市排班已建好
- [ ] 通知員工 LINE 輸入「面板」可開啟功能面板
