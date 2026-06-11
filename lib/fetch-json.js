// 共用 fetch：AbortController timeout（LIFF webview 偶發 hang 的防線）
// + 可選 sessionStorage SWR 快取（低變動參照資料用，繞過全站 no-store）
export function fetchJSON(url, { timeoutMs = 8000, swrKey, swrTtl = 0, ...init } = {}) {
  const doFetch = () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    return fetch(url, { signal: ctrl.signal, ...init })
      .then((r) => r.json())
      .finally(() => clearTimeout(t));
  };

  if (!swrKey || !swrTtl || typeof window === "undefined") return doFetch();

  const cacheKey = `sb_swr_${swrKey}`;
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (raw) {
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts < swrTtl * 1000) {
        // 背景 revalidate，下次取得新資料
        doFetch().then((fresh) => {
          try { sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: fresh })); } catch (e) {}
        }).catch(() => {});
        return Promise.resolve(data);
      }
    }
  } catch (e) {}

  return doFetch().then((data) => {
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data })); } catch (e) {}
    return data;
  });
}
