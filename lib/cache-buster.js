// 自動清快取機制：解決員工/管理員看到舊版本卡住的問題
// 用法：在每個頁面 useEffect 開頭呼叫 checkAppVersion()
// 一旦 APP_VERSION 跳號，所有客戶端會自動清 localStorage + reload 一次

export const APP_VERSION = "2026.06.11.1"; // 改這裡會強制所有 client 清快取一次（本次：全站設計系統改版）

export function checkAppVersion() {
  if (typeof window === "undefined") return;
  try {
    const stored = localStorage.getItem("app_version");
    if (stored !== APP_VERSION) {
      // 保留打卡 token 等臨時資料以外，其他全清
      const keysToKeep = []; // 如果有要保留的 key 加這裡
      const backup = {};
      for (const k of keysToKeep) backup[k] = localStorage.getItem(k);
      localStorage.clear();
      sessionStorage.clear();
      for (const [k, v] of Object.entries(backup)) if (v) localStorage.setItem(k, v);
      localStorage.setItem("app_version", APP_VERSION);
      // 同時清掉 caches API + service workers（fire-and-forget，不 await）
      try { if ("caches" in window) caches.keys().then(ks => ks.forEach(k => caches.delete(k))); } catch {}
      try { if ("serviceWorker" in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())); } catch {}
      // 第一次部署時不 reload（怕無限循環），有舊版本才 reload
      if (stored) {
        console.info("App version changed, clearing cache and reloading:", stored, "→", APP_VERSION);
        window.location.reload();
      }
    }
  } catch (e) {
    console.warn("checkAppVersion failed:", e);
  }
}

// 驗證 auth state 是否符合預期 shape；不符合就清掉
export function validateAuth(auth) {
  if (!auth || typeof auth !== "object") return null;
  // login API 回傳的是 employee_id 不是 id；同時兼容兩種寫法
  if (!auth.role) return null;
  if (!auth.employee_id && !auth.id) return null;
  return auth;
}

// 強制清掉所有 client 端 storage + cookie（給「強制清快取」按鈕用）
export function nukeCache() {
  try {
    localStorage.clear();
    sessionStorage.clear();
    // 清掉所有 cookies（同網域）
    document.cookie.split(";").forEach(c => {
      const eq = c.indexOf("=");
      const name = eq > -1 ? c.substr(0, eq).trim() : c.trim();
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    });
    // 清掉 service worker（如有）
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
    }
    // 清掉 caches API
    if ("caches" in window) {
      caches.keys().then(ks => ks.forEach(k => caches.delete(k)));
    }
    return true;
  } catch (e) {
    console.error("nukeCache failed:", e);
    return false;
  }
}
