"use client";
import { useState, useEffect } from "react";

const fmt = n => "$" + Number(n || 0).toLocaleString();

export default function MyAttendance() {
  const [emp, setEmp] = useState(null);
  const [att, setAtt] = useState([]);
  const [summary, setSummary] = useState(null);
  const [month, setMonth] = useState(() => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }).slice(0, 7));
  const [loading, setLoading] = useState(true);

  const eid = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("eid") : null;

  useEffect(() => {
    if (!eid) return;
    fetch("/api/admin/employees?id=" + eid).then(r => r.json()).then(r => setEmp(r.data));
  }, [eid]);

  useEffect(() => {
    if (!eid || !month) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/attendance?employee_id=${eid}&month=${month}`).then(r => r.json()),
      fetch(`/api/admin/attendance?summary=true&month=${month}&employee_id=${eid}`).then(r => r.json()),
    ]).then(([a, s]) => {
      setAtt(a.data || []);
      setSummary(s.data?.[0] || null);
      setLoading(false);
    });
  }, [eid, month]);

  const wrap = { maxWidth: 420, margin: "0 auto", padding: 16, fontFamily: "system-ui, 'Noto Sans TC', sans-serif", background: "#f7f5f0", minHeight: "100vh" };
  if (!eid) return <div style={wrap}><p style={{ textAlign: "center", color: "#b91c1c", padding: 40 }}>缺少員工識別碼</p></div>;

  const [y, m] = month.split("-").map(Number);

  return (
    <div style={wrap}>
      <div style={{ background: "linear-gradient(135deg, #0a7c42, #10b981)", borderRadius: 14, padding: "16px", marginBottom: 12, color: "#fff" }}>
        <div style={{ fontSize: 11, opacity: 0.9 }}>📊 我的假勤</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{emp?.name || "..."}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
        <button onClick={() => { const d = new Date(y, m - 2, 1); setMonth(d.toLocaleDateString("sv-SE").slice(0, 7)); }}
          style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>◀</button>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{y} 年 {m} 月</span>
        <button onClick={() => { const d = new Date(y, m, 1); setMonth(d.toLocaleDateString("sv-SE").slice(0, 7)); }}
          style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>▶</button>
      </div>

      {loading ? <p style={{ textAlign: "center", color: "#888" }}>載入中...</p> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
            <Stat label="出勤天" value={summary?.work_days ?? att.filter(a => a.type === "clock_in").length} color="#0a7c42" />
            <Stat label="遲到" value={summary?.late_count ?? att.filter(a => a.late_minutes > 0).length} color="#b45309" />
            <Stat label="早退" value={att.filter(a => a.early_leave_minutes > 0).length} color="#b91c1c" />
          </div>

          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", overflow: "hidden" }}>
            <div style={{ padding: "8px 10px", background: "#faf8f5", fontSize: 12, fontWeight: 600 }}>打卡紀錄</div>
            {att.length === 0 && <div style={{ padding: 16, textAlign: "center", color: "#ccc", fontSize: 11 }}>本月無紀錄</div>}
            {att.map(a => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderTop: "1px solid #f0eeea", fontSize: 11 }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{a.date || a.timestamp?.slice(0, 10)}</span>
                  <span style={{ color: a.type === "clock_in" ? "#0a7c42" : "#4361ee", marginLeft: 6, fontWeight: 600 }}>
                    {a.type === "clock_in" ? "🟢 上班" : "🔵 下班"}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ color: "#666" }}>{a.timestamp ? new Date(a.timestamp).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Taipei" }) : ""}</span>
                  {a.late_minutes > 0 && <span style={{ color: "#b45309", marginLeft: 4, fontSize: 9 }}>遲到{a.late_minutes}分</span>}
                  {a.early_leave_minutes > 0 && <span style={{ color: "#b91c1c", marginLeft: 4, fontSize: 9 }}>早退{a.early_leave_minutes}分</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 14, textAlign: "center" }}>
        <a href={`/me?eid=${eid}`} style={{ fontSize: 12, color: "#4361ee" }}>← 回面板</a>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: "#fff", borderRadius: 8, padding: "8px 6px", textAlign: "center", border: "1px solid #e8e6e1" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 9, color: "#888" }}>{label}</div>
    </div>
  );
}
