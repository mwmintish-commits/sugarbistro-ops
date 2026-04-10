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

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    if (!t) { setError("缺少打卡 Token"); setLoading(false); return; }
    setToken(t);
    fetch("/api/clockin?token=" + t).then(r => r.json()).then(data => {
      if (data.error) setError(data.error === "Token already used" ? "已打卡過" : data.error === "Token expired" ? "連結已過期" : data.error);
      else setInfo(data);
      setLoading(false);
    }).catch(() => { setError("載入失敗"); setLoading(false); });
  }, []);

  function calcDist(lat1, lon1, lat2, lon2) {
    const R = 6371000, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  async function getLocation() {
    setGpsLoading(true); setError(null);
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }));
      const c = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) };
      setPosition(c);
      if (info?.store?.latitude && info?.store?.longitude) {
        setDistance(calcDist(c.lat, c.lng, info.store.latitude, info.store.longitude));
      }
    } catch { setError("無法定位，請開啟 GPS 並允許權限"); }
    setGpsLoading(false);
  }

  async function submit() {
    if (!position) return;
    setSubmitting(true); setError(null);
    try {
      const res = await fetch("/api/clockin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, latitude: position.lat, longitude: position.lng }) });
      const data = await res.json();
      if (data.error) setError(data.error); else setResult(data);
    } catch { setError("提交失敗，請重試"); }
    setSubmitting(false);
  }

  const hasStoreGPS = info?.store?.latitude && info?.store?.longitude;
  const maxRange = info?.store?.radius_m || 200;
  const isInRange = hasStoreGPS && distance !== null ? distance <= maxRange : !hasStoreGPS;
  const hasSchedule = !!info?.schedule;
  const canClock = hasSchedule && isInRange;
  const typeLabel = info?.type === "clock_in" ? "上班打卡" : "下班打卡";

  if (loading) return <C>載入中...</C>;

  if (result) return (
    <Box><C>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>{typeLabel}成功</h1>
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: 16, marginTop: 16, width: "100%" }}>
        <R l="姓名" v={info?.employee_name} /><R l="門市" v={result.store_name} />
        <R l="時間" v={<b style={{ fontSize: 18 }}>{result.time}</b>} />
        {distance !== null && <R l="距離" v={`${result.distance}m`} />}
        {result.late_minutes > 0 && <R l="遲到" v={<span style={{ color: "#b91c1c" }}>{result.late_minutes} 分鐘</span>} />}
      </div>
      <p style={{ fontSize: 13, color: "#999", marginTop: 16 }}>可以關閉此頁面了</p>
    </C></Box>
  );

  return (
    <Box>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 28 }}>🍯</div>
        <h1 style={{ fontSize: 17, fontWeight: 600, marginTop: 4 }}>{typeLabel}</h1>
        <p style={{ fontSize: 12, color: "#999" }}>👤 {info?.employee_name}｜🏠 {info?.store?.name || ""}</p>
      </div>

      {error && <div style={{ background: "#fde8e8", color: "#b91c1c", padding: 8, borderRadius: 6, fontSize: 12, marginBottom: 10 }}>{error}</div>}

      {/* 排班檢查 */}
      {!hasSchedule && (
        <div style={{ background: "#fde8e8", borderRadius: 10, padding: 16, marginBottom: 12, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🚫</div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#b91c1c" }}>今日無排班，無法打卡</p>
          <p style={{ fontSize: 12, color: "#888", marginTop: 6 }}>請確認排班表或聯繫主管</p>
        </div>
      )}

      {hasSchedule && (
        <>
          <div style={{ background: "#e6f1fb", borderRadius: 8, padding: 10, marginBottom: 12, textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "#185fa5" }}>📅 今日排班：{info.schedule.shift_name} {info.schedule.start_time}~{info.schedule.end_time}</p>
          </div>

          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: 14, marginBottom: 10 }}>
            {!position ? (
              <button onClick={getLocation} disabled={gpsLoading} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: gpsLoading ? "#ccc" : "#4361ee", color: "#fff", fontSize: 15, cursor: "pointer" }}>
                {gpsLoading ? "📍 定位中..." : "📍 取得目前位置"}
              </button>
            ) : (
              <div>
                <R l="你的位置" v={<span style={{ fontSize: 10, fontFamily: "monospace" }}>{position.lat.toFixed(6)}, {position.lng.toFixed(6)}</span>} />
                <R l="精度" v={"±" + position.accuracy + "m"} />
                {hasStoreGPS && distance !== null && (
                  <R l="距門市" v={<span style={{ fontWeight: 600, fontSize: 16, color: isInRange ? "#0a7c42" : "#b91c1c" }}>
                    {distance}m {isInRange ? "✅ 範圍內" : `❌ 超出範圍（限${maxRange}m）`}
                  </span>} />
                )}
                {!hasStoreGPS && <R l="門市GPS" v="未設定（請聯繫總部設定門市座標）" />}
                <button onClick={getLocation} style={{ marginTop: 8, padding: "4px 12px", borderRadius: 6, border: "1px solid #ddd", background: "transparent", fontSize: 11, cursor: "pointer" }}>🔄 重新定位</button>
              </div>
            )}
          </div>

          {/* 位置異常警告 */}
          {position && !isInRange && hasStoreGPS && (
            <div style={{ background: "#fde8e8", borderRadius: 10, padding: 14, marginBottom: 10, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🚫</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#b91c1c" }}>位置異常，無法打卡</p>
              <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>你的位置距離門市 {distance}m，超出允許範圍 {maxRange}m</p>
              <p style={{ fontSize: 12, color: "#888" }}>請移動到門市附近後重新定位</p>
            </div>
          )}

          {/* 打卡按鈕 */}
          {position && canClock && (
            <button onClick={submit} disabled={submitting} style={{
              width: "100%", padding: "14px", borderRadius: 10, border: "none", fontSize: 16, fontWeight: 600,
              cursor: submitting ? "default" : "pointer", background: submitting ? "#ccc" : "#0a7c42", color: "#fff",
            }}>
              {submitting ? "提交中..." : `✅ 確認${typeLabel}`}
            </button>
          )}
        </>
      )}
    </Box>
  );
}

function R({ l, v }) { return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f0eeea", fontSize: 13 }}><span style={{ color: "#888" }}>{l}</span><span>{v}</span></div>; }
function Box({ children }) { return <div style={{ maxWidth: 420, margin: "0 auto", padding: "16px 12px", fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#faf8f5" }}>{children}</div>; }
function C({ children }) { return <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>{children}</div>; }
