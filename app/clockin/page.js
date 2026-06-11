"use client";
import { useState, useEffect } from "react";

export default function ClockInPage() {
  const [token, setToken] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [position, setPosition] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [distance, setDistance] = useState(null);

  // 打卡成功後 3 秒自動跳轉工作日誌（用 useEffect 避免每次 render 都重排定時器）
  useEffect(() => {
    if (!result) return;
    const wlUrl = `/worklog?eid=${info?.employee_id||""}&sid=${info?.store?.id||""}&name=${encodeURIComponent(info?.employee_name||"")}`;
    const t = setTimeout(() => { window.location.href = wlUrl; }, 3000);
    return () => clearTimeout(t);
  }, [result, info?.employee_id, info?.employee_name, info?.store?.id]);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    if (!t) { setError("缺少打卡 Token"); setLoading(false); return; }
    setToken(t);
    // 加 10 秒 timeout，避免 LIFF 偶發 hang
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    fetch("/api/clockin?token=" + t, { signal: ctrl.signal })
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error === "Token already used" ? "已打卡過" : data.error === "Token expired" ? "連結已過期" : data.error);
        else setInfo(data);
        setLoading(false);
      })
      .catch(e => { setError(e?.name === "AbortError" ? "載入逾時，請重新整理或從 LINE 重新開啟" : "載入失敗"); setLoading(false); })
      .finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, []);

  function calcDist(lat1, lon1, lat2, lon2) {
    const R = 6371000, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  // 兩段式定位：先 high-accuracy 8 秒；若超時或失敗，降級為 low-accuracy 再試 8 秒
  // （LINE 內建瀏覽器/室內訊號弱時 high-accuracy 常超時，降級可救回大多數打卡）
  function tryGetPosition(highAccuracy, timeoutMs) {
    return Promise.race([
      new Promise((res, rej) => navigator.geolocation.getCurrentPosition(
        res,
        (err) => rej(Object.assign(new Error(
          err.code === 1 ? "請開啟位置權限（LINE → 設定 → 位置 → 允許）" :
          err.code === 2 ? "無法取得位置，請確認 GPS 已開啟" :
          err.code === 3 ? "定位逾時" :
          "定位失敗"
        ), { code: err.code })),
        { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: highAccuracy ? 0 : 30000 }
      )),
      new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error("定位逾時"), { code: 3 })), timeoutMs + 2000)),
    ]);
  }

  async function getLocation() {
    setGpsLoading(true); setError(null);
    let pos;
    try {
      pos = await tryGetPosition(true, 8000);
    } catch (e) {
      // 權限錯誤直接顯示（重試也沒用）；其他錯誤降級重試
      if (e.code === 1) { setError(e.message); setGpsLoading(false); return; }
      try {
        pos = await tryGetPosition(false, 8000);
      } catch (e2) {
        setError((e2.message || "無法定位") + "。請到戶外或開啟 GPS 後重試；若一直失敗請點右上角「⋯」用 Safari/Chrome 開啟。");
        setGpsLoading(false);
        return;
      }
    }
    const c = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) };
    setPosition(c);
    if (info?.store?.latitude && info?.store?.longitude) {
      setDistance(calcDist(c.lat, c.lng, info.store.latitude, info.store.longitude));
    }
    setGpsLoading(false);
  }

  async function submit() {
    if (!position) return;
    setSubmitting(true); setError(null);
    // 加 15 秒 timeout 防 hang；失敗自動重試一次
    const doFetch = () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      return fetch("/api/clockin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, latitude: position.lat, longitude: position.lng }),
        signal: ctrl.signal,
      }).finally(() => clearTimeout(t));
    };
    let data;
    try {
      const res = await doFetch();
      data = await res.json();
    } catch (e1) {
      // 第一次失敗（網路抖動 / timeout）→ 自動重試一次
      try {
        const res2 = await doFetch();
        data = await res2.json();
      } catch (e2) {
        setError("網路不穩，提交失敗，請稍後重試（" + (e2?.name === "AbortError" ? "逾時 15 秒" : e2?.message || "未知") + "）");
        setSubmitting(false);
        return;
      }
    }
    if (data?.error) setError(data.error); else setResult(data);
    setSubmitting(false);
  }

  const hasStoreGPS = info?.store?.latitude && info?.store?.longitude;
  const maxRange = info?.store?.radius_m || 200;
  const isInRange = hasStoreGPS && distance !== null ? distance <= maxRange : !hasStoreGPS;
  const hasSchedule = !!info?.schedule;
  const canClock = hasSchedule && isInRange;
  const typeLabel = info?.type === "clock_in" ? "上班打卡" : "下班打卡";

  if (loading) return <C>載入中...</C>;

  if (result) {
    const wlUrl = `/worklog?eid=${info?.employee_id||""}&sid=${info?.store?.id||""}&name=${encodeURIComponent(info?.employee_name||"")}`;
    return (
    <Box><C>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>{typeLabel}成功</h1>
      <div className="sb-card" style={{ borderRadius: 10, padding: 16, marginTop: 16, width: "100%", boxSizing: "border-box" }}>
        <R l="姓名" v={info?.employee_name} /><R l="門市" v={result.store_name} />
        <R l="時間" v={<b style={{ fontSize: 18 }}>{result.time}</b>} />
        {distance !== null && <R l="距離" v={`${result.distance}m`} />}
        {result.late_minutes > 0 && <R l="遲到" v={<span style={{ color: "var(--danger)" }}>{result.late_minutes} 分鐘</span>} />}
      </div>
      <div style={{ marginTop: 16, textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>3 秒後自動進入工作日誌...</div>
      <a href={wlUrl} style={{ display: "block", width: "100%", padding: 14, borderRadius: 10, background: "var(--success)", color: "#fff", fontSize: 15, fontWeight: 600, textAlign: "center", textDecoration: "none", marginTop: 8, boxSizing: "border-box" }}>📋 立即進入工作日誌</a>
    </C></Box>
    );
  }

  return (
    <Box>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 28 }}>🍯</div>
        <h1 style={{ fontSize: 17, fontWeight: 600, marginTop: 4 }}>{typeLabel}</h1>
        <p style={{ fontSize: 12, color: "var(--text-3)" }}>👤 {info?.employee_name}｜🏠 {info?.store?.name || ""}</p>
      </div>

      {error && (
        <div style={{ background: "var(--danger-bg)", color: "var(--danger)", padding: 10, borderRadius: 6, fontSize: 12, marginBottom: 10 }}>
          <div>{error}</div>
          {(error.includes("定位") || error.includes("位置") || error.includes("逾時")) && (
            <a href={typeof window !== "undefined" ? window.location.href : "#"} target="_blank" rel="noreferrer"
               style={{ display: "block", marginTop: 8, padding: "10px", background: "var(--surface)", color: "var(--danger)", borderRadius: 6, textDecoration: "none", textAlign: "center", border: "1px solid var(--danger)", fontWeight: 600 }}>
              🌐 用 Safari/Chrome 開啟（推薦）
            </a>
          )}
        </div>
      )}

      {/* 排班檢查 */}
      {!hasSchedule && (
        <div style={{ background: "var(--danger-bg)", borderRadius: 10, padding: 16, marginBottom: 12, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🚫</div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--danger)" }}>今日無排班，無法打卡</p>
          <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 6 }}>請確認排班表或聯繫主管</p>
        </div>
      )}

      {hasSchedule && (
        <>
          <div style={{ background: "var(--info-bg)", borderRadius: 8, padding: 10, marginBottom: 12, textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--info)" }}>📅 今日排班：{info.schedule.shift_name}{(info.schedule.shift_name || "").includes("~") ? "" : ` ${(info.schedule.start_time || "").slice(0, 5)}~${(info.schedule.end_time || "").slice(0, 5)}`}</p>
          </div>

          <div className="sb-card" style={{ borderRadius: 10, padding: 14, marginBottom: 10 }}>
            {!position ? (
              <button onClick={getLocation} disabled={gpsLoading} className="sb-btn sb-btn-primary" style={{ fontSize: 15 }}>
                {gpsLoading ? "📍 定位中（約5秒）..." : "📍 取得目前位置"}
              </button>
            ) : (
              <div>
                {/* 小地圖 */}
                {hasStoreGPS && (
                  <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 8 }}>
                    <iframe
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${Math.min(position.lng,info.store.longitude)-0.002},${Math.min(position.lat,info.store.latitude)-0.001},${Math.max(position.lng,info.store.longitude)+0.002},${Math.max(position.lat,info.store.latitude)+0.001}&layer=mapnik&marker=${position.lat},${position.lng}`}
                      style={{ width: "100%", height: 130, border: "none" }} loading="lazy" />
                  </div>
                )}
                <R l="GPS精度" v={<span style={{ color: position.accuracy <= 30 ? "var(--success)" : position.accuracy <= 100 ? "var(--warning)" : "var(--danger)", fontWeight: 600 }}>
                  {"±" + position.accuracy + "m "}{position.accuracy <= 30 ? "🟢 精準" : position.accuracy <= 100 ? "🟡 普通" : "🔴 較差"}
                </span>} />
                {hasStoreGPS && distance !== null && (
                  <R l="距門市" v={<span style={{ fontWeight: 600, fontSize: 16, color: isInRange ? "var(--success)" : "var(--danger)" }}>
                    {distance}m {isInRange ? "✅ 範圍內" : `❌ 超出（限${maxRange}m）`}
                  </span>} />
                )}
                {!hasStoreGPS && <R l="門市GPS" v="未設定（請聯繫總部）" />}
                <button onClick={getLocation} style={{ marginTop: 8, padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-2)", fontSize: 12, cursor: "pointer" }}>🔄 重新定位</button>
              </div>
            )}
          </div>

          {/* 位置異常警告 */}
          {position && !isInRange && hasStoreGPS && (
            <div style={{ background: "var(--danger-bg)", borderRadius: 10, padding: 14, marginBottom: 10, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🚫</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--danger)" }}>位置異常，無法打卡</p>
              <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>你的位置距離門市 {distance}m，超出允許範圍 {maxRange}m</p>
              <p style={{ fontSize: 12, color: "var(--text-3)" }}>請移動到門市附近後重新定位</p>
            </div>
          )}

          {/* 打卡按鈕 */}
          {position && canClock && (
            <button onClick={submit} disabled={submitting} className="sb-btn sb-btn-success" style={{ fontSize: 16, minHeight: 52 }}>
              {submitting ? "提交中..." : `✅ 確認${typeLabel}`}
            </button>
          )}
        </>
      )}
    </Box>
  );
}

function R({ l, v }) { return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--divider)", fontSize: 13 }}><span style={{ color: "var(--text-3)" }}>{l}</span><span>{v}</span></div>; }
function Box({ children }) { return <div style={{ maxWidth: 420, margin: "0 auto", padding: "16px 12px", minHeight: "100dvh", background: "var(--bg)", boxSizing: "border-box" }}>{children}</div>; }
function C({ children }) { return <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>{children}</div>; }
