# 小食糖營運系統 — 轉移到 Claude Code 指南

## 前置準備（一次性，約 20 分鐘）

### Step 1：確認 Claude 帳號方案

你需要 Claude Pro ($20/月) 或以上方案。
確認方式：登入 claude.ai → 左下角看是否顯示 "Pro"

如果還沒訂閱：claude.ai → Settings → Billing → 升級到 Pro

---

### Step 2：安裝 Git

**Mac：**
打開「終端機」（Terminal），輸入：
```
git --version
```
如果出現版本號 → 已安裝，跳到 Step 3
如果提示安裝 → 按確認安裝

**Windows：**
1. 到 https://git-scm.com/download/win
2. 下載安裝，全部預設選項
3. 安裝完成後開啟 PowerShell 驗證：`git --version`

---

### Step 3：設定 Git（第一次使用）

打開終端機，輸入：
```
git config --global user.name "你的名字"
git config --global user.email "你的email@example.com"
```

---

### Step 4：複製專案到電腦

```
cd ~/Desktop
git clone https://github.com/你的帳號/sugarbistro-ops.git
cd sugarbistro-ops
```

如果還沒有 GitHub repository，先到 GitHub 建立一個名為 `sugarbistro-ops` 的 repository。

---

### Step 5：安裝 Claude Code

**Mac / Linux：**
```
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows (PowerShell)：**
```
irm https://claude.ai/install.ps1 | iex
```

安裝完成後，**關閉終端機，重新開啟**，然後驗證：
```
claude --version
```

---

### Step 6：登入 Claude Code

```
claude
```

第一次會開啟瀏覽器要你登入，用你的 Claude 帳號登入即可。

---

## 開始使用（每次操作）

### 進入專案

```
cd ~/Desktop/sugarbistro-ops
claude
```

你會看到：
```
🤖 Welcome to Claude Code!
   Project: sugarbistro-ops
   Files: 59 files
```

### 日常對話範例

**修改功能：**
```
你：費用辨識完成後，LINE 要顯示辨識結果讓上傳者確認
```
Claude Code 會自動讀取相關檔案、修改、詢問你確認。

**修 Bug：**
```
你：/fix-bug 門市儲存按鈕沒反應
```

**部署：**
```
你：/deploy 修正費用辨識流程
```
自動 git add + commit + push，Zeabur 自動部署。

**跑 SQL：**
```
你：幫我跑 migrations/schedule-rest-day.sql 到 Supabase
```

---

## 常用指令

| 你說的 | Claude Code 做的 |
|--------|-----------------|
| `/deploy 描述` | git add → commit → push |
| `/fix-bug 問題描述` | 找問題 → 修正 → 確認 |
| `/sql-migrate` | 建立 SQL 遷移檔案 |
| `/compact` | 壓縮對話紀錄（太長時用） |
| `/clear` | 清除對話重新開始 |

---

## 跟 Claude.ai 網頁版的差異

| | Claude.ai（現在） | Claude Code |
|--|--|--|
| 在哪操作 | 瀏覽器聊天 | 終端機 |
| 看得到程式碼 | ❌ 每次重新給 | ✅ 直接讀你的檔案 |
| 改程式 | 下載 ZIP → 手動換 | ✅ 直接改你的檔案 |
| 部署 | 手動上傳 GitHub | ✅ 自動 git push |
| 跑 SQL | 手動貼到 Supabase | ✅ 可以自動執行 |
| 記住專案 | ❌ 每次要重新說明 | ✅ 讀 CLAUDE.md |
| 費用 | 含在 Pro 方案 | 含在 Pro 方案 |

---

## 注意事項

1. **每次修改前，Claude Code 會詢問你確認**，不會自動改
2. **如果改壞了**，可以用 `git checkout -- .` 還原
3. **大型修改**建議先開 branch：`git checkout -b feature/新功能`
4. **CLAUDE.md** 是專案說明書，Claude Code 啟動時會讀取
5. **不需要同時用 Claude.ai 和 Claude Code**，Claude Code 可以完全取代目前的開發流程

---

## 遇到問題？

```
claude doctor        # 自動檢測問題
claude --help        # 查看所有指令
```
