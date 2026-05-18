// 把 AI 辨識/使用者輸入的雜亂日期字串轉成合法的 YYYY-MM-DD
// 失敗時回傳 null（讓呼叫端自己決定 fallback，例如改用今天）
export function normalizeRocDate(input) {
  if (!input || typeof input !== "string") return null;
  const s = input.trim().replace(/[／.]/g, "-").replace(/\s+/g, " ");

  // 取出 yyyy-mm-dd / yy-m-d 之類的數字三段
  const m = s.match(/^(\d{1,4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  let y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;

  // 民國年（1-200）→ 西元（+1911）
  if (y >= 1 && y < 200) y = y + 1911;
  // 兩位數年（20-30）→ 20xx
  else if (y >= 20 && y < 100) y = y + 2000;

  // 合理範圍：2020 到「今年+1」
  const thisYear = new Date().getFullYear();
  if (y < 2020 || y > thisYear + 1) return null;

  // 不能晚於今天（+1 天容錯，跨時區用）
  const dt = new Date(Date.UTC(y, mo - 1, d));
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dt > tomorrow) return null;

  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// 今日（台北時區）YYYY-MM-DD
export function todayTaipei() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}
