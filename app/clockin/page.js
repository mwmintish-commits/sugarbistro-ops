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
    fetch(`/api/clockin?token=${t}`).then(r => r.json()).then(data => {
      if (data.error) setError(data.error === "Token already used" ? "已打卡過" : data.error === "Token expired" ? "連結已過期" : data.error);
      else setInfo(data);
      setLoading(false);
    }).catch(() => { setError("載入失敗"); setLoading(false); });
  }, []);

  function calcDist(lat1, lon1, lat2, lon2) {
    const R = 6371000, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return Math.round(R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  }

  async function getLocation() {
    setGpsLoading(true); setError(null);
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }));
      const c = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) };
      setPosition(c);
      if (info?.store?.latitude) setDistance(calcDist(c.lat, c.lng, info.store.latitude, info.store.longitude));
    } catch { setError("無法定位，請開啟 GPS 並允許權限"); }
    setGpsLoading(false);
  }

  async function submit() {
    if (!position) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/clockin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, latitude: position.lat, longitude: position.lng }) });
      const data = await res.json();
      if (data.error) setError(data.error); else setResult(data);
    } catch { setError("提交失敗"); }
    setSubmitting(false);
  }

  const isInRange = distance !== null && info?.store?.radius_m ? distance <= info.store.radius_m : null;
  const typeLabel = info?.type === "clock_in" ? "上班打卡" : "下班打卡";

  if (loading) return <div style={S.center}><p>載入中...</p></div>;

  if (result) return (
    <div style={S.container}>
      <div style={S.center}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{result.is_valid ? "✅" : "⚠️"}</div>
        <h1 style={S.title}>{typeLabel}成功</h1>
        <div style={S.card}>
          <div style={S.row}><span style={S.label}>姓名</span><span>{info?.employee_name}</span></div>
          <div style={S.row}><span style={S.label}>門市</span><span>{result.store_name}</span></div>
          <div style={S.row}><span style={S.label}>時間</span><span style={{ fontSize: 20, fontWeight: 600 }}>{result.time}</span></div>
          <div style={S.row}><span style={S.label}>距離</span><span>{result.distance}m {result.is_valid ? "✅" : "❌"}</span></div>
          {result.late_minutes > 0 && <div style={{ ...S.row, color: "#b91c1c" }}><span style={S.label}>遲到</span><span>{result.late_minutes} 分鐘</span></div>}
        </div>
        <p style={{ fontSize: 13, color: "#999", marginTop: 20 }}>可以關閉此頁面了</p>
      </div>
    </div>
  );

  return (
    <div style={S.container}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🍯</div>
        <h1 style={S.title}>{typeLabel}</h1>
        <p style={{ fontSize: 13, color: "#999" }}>👤 {info?.employee_name}｜🏠 {info?.store?.name || ""}</p>
        {info?.schedule && <p style={{ fontSize: 12, color: "#4361ee" }}>{info.schedule.shift_name} {info.schedule.start_time}~{info.schedule.end_time}</p>}
      </div>

      {error && <div style={S.error}>{error}<button onClick={() => setError(null)} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#b91c1c" }}>✕</button></div>}

      <div style={S.card}>
        {!position ? (
          <button onClick={getLocation} disabled={gpsLoading} style={{ ...S.btn, background: gpsLoading ? "#ccc" : "#4361ee" }}>
            {gpsLoading ? "📍 定位中..." : "📍 取得目前位置"}
          </button>
        ) : (
          <div>
            <div style={S.row}><span style={S.label}>你的位置</span><span style={{ fontSize: 11, fontFamily: "monospace" }}>{position.lat.toFixed(6)}, {position.lng.toFixed(6)}</span></div>
            <div style={S.row}><span style={S.label}>精度</span><span>±{position.accuracy}m</span></div>
            {info?.store?.latitude && (
              <div style={{ ...S.row, borderBottom: "none" }}>
                <span style={S.label}>距門市</span>
                <span style={{ fontWeight: 600, fontSize: 18, color: isInRange ? "#0a7c42" : "#b91c1c" }}>
                  {distance}m {isInRange ? "✅" : `❌ 超出${info.store.radius_m}m`}
                </span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={getLocation} style={S.btnSmall}>🔄 重新定位</button>
            </div>
          </div>
        )}
      </div>

      {position && (
        <button onClick={submit} disabled={submitting} style={{
          ...S.btn, marginTop: 8, fontSize: 16, padding: "14px 0",
          background: submitting ? "#ccc" : isInRange ? "#0a7c42" : "#b91c1c",
        }}>
          {submitting ? "提交中..." : isInRange ? `✅ 確認${typeLabel}` : `⚠️ 位置異常，仍要打卡`}
        </button>
      )}
    </div>
  );
}

const S = {
  container: { maxWidth: 420, margin: "0 auto", padding: "20px 16px", fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#faf8f5" },
  center: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh" },
  title: { fontSize: 20, fontWeight: 600, margin: "0 0 8px" },
  card: { background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", padding: 16, marginBottom: 12, width: "100%" },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f0eeea", fontSize: 14 },
  label: { color: "#888", fontSize: 13 },
  btn: { width: "100%", padding: "12px 0", borderRadius: 10, border: "none", color: "#fff", fontSize: 15, fontWeight: 500, cursor: "pointer" },
  btnSmall: { padding: "6px 14px", borderRadius: 8, border: "1px solid #ddd", background: "transparent", fontSize: 12, cursor: "pointer" },
  error: { background: "#fde8e8", color: "#b91c1c", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12, display: "flex", justifyContent: "space-between" },
};
