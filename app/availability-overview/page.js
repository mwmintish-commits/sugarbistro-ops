"use client";
import { useState, useEffect } from "react";

const fmtHd = (hd) => {
  if (!hd) return "整天✕";
  const [f, t] = hd.split("~");
  return `可${f}~${t}`;
};

export default function AvailabilityOverviewPage() {
  const [eid, setEid] = useState("");
  const [manager, setManager] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [month, setMonth] = useState(() => {
    const now = new Date(new Date().toLocaleString("sv-SE", { timeZone: "Asia/Taipei" }));
    return new Date(now.getFullYear(), now.getMonth() + 1, 1)
      .toLocaleDateString("sv-SE").slice(0, 7);
  });

  const [view, setView] = useState("employee"); // "employee" | "day"

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("eid") || "";
    setEid(id);
    if (!id) { setErr("缺少員工識別碼"); setLoading(false); return; }
    fetch("/api/admin/employees?id=" + id).then(r => r.json()).then(r => {
      if (!r.data) { setErr("找不到員工資料"); setLoading(false); return; }
      setManager(r.data);
      setLoading(false);
    }).catch(() => { setErr("載入失敗"); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!manager) return;
    const storeId = manager.store_id;
    const storeQ = storeId ? `&store_id=${storeId}` : "";
    Promise.all([
      fetch(`/api/admin/employees${storeId ? "?store_id=" + storeId : ""}`).then(r => r.json()),
      fetch(`/api/availability?month=${month}${storeQ}`).then(r => r.json()),
    ]).then(([empR, repR]) => {
      setEmployees((empR.data || []).filter(e => e.is_active));
      setReports(repR.data || []);
    });
  }, [manager, month]);

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();

  // Group reports by employee
  const byEmployee = {};
  for (const r of reports) {
    if (!byEmployee[r.employee_id]) byEmployee[r.employee_id] = [];
    byEmployee[r.employee_id].push(r);
  }

  // Group reports by date
  const byDate = {};
  for (const r of reports) {
    if (!byDate[r.start_date]) byDate[r.start_date] = [];
    byDate[r.start_date].push(r);
  }

  const wrap = {
    maxWidth: 520, margin: "0 auto", padding: 10,
    fontFamily: "system-ui, 'Noto Sans TC', sans-serif",
    background: "#f7f5f0", minHeight: "100vh", boxSizing: "border-box",
  };

  if (loading) return <div style={wrap}><p style={{ textAlign: "center", color: "#888", padding: 60 }}>載入中...</p></div>;
  if (err) return <div style={wrap}><p style={{ textAlign: "center", color: "#b91c1c", padding: 60 }}>{err}</p></div>;

  const partTimers = employees.filter(e => e.employment_type === "part_time");
  const reportedIds = new Set(Object.keys(byEmployee));

  return (
    <div style={wrap}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1a237e, #283593)", borderRadius: 14, padding: "14px 16px", marginBottom: 10, color: "#fff" }}>
        <div style={{ fontSize: 11, opacity: 0.85 }}>👥 員工可用時段總覽</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{manager?.stores?.name || "全部門市"}</div>
        <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>僅主管可見</div>
      </div>

      {/* 月份 + 視角切換 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <button onClick={() => { const d = new Date(y, m - 2, 1); setMonth(d.toLocaleDateString("sv-SE").slice(0, 7)); }}
          style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>◀</button>
        <span style={{ flex: 1, textAlign: "center", fontSize: 15, fontWeight: 600 }}>{y} 年 {m} 月</span>
        <button onClick={() => { const d = new Date(y, m, 1); setMonth(d.toLocaleDateString("sv-SE").slice(0, 7)); }}
          style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>▶</button>
        <button onClick={() => setView(v => v === "employee" ? "day" : "employee")}
          style={{ background: "#fff", border: "1px solid #c5cae9", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", color: "#3f51b5", fontWeight: 600 }}>
          {view === "employee" ? "日期視角" : "員工視角"}
        </button>
      </div>

      {/* 未回報提示 */}
      {partTimers.filter(e => !reportedIds.has(e.id)).length > 0 && (
        <div style={{ background: "#fff8e6", border: "1px solid #fbc02d", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: "#b45309" }}>
          ⚠️ 尚未回報：{partTimers.filter(e => !reportedIds.has(e.id)).map(e => e.name).join("、")}
        </div>
      )}

      {/* 員工視角 */}
      {view === "employee" && (
        <div>
          {employees.map(emp => {
            const recs = byEmployee[emp.id] || [];
            const isPartTime = emp.employment_type === "part_time";
            const reported = recs.length > 0;
            return (
              <div key={emp.id} style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: reported ? 8 : 0 }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{emp.name}</span>
                    <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>
                      {isPartTime ? "兼職" : "正職"}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: reported ? "#b91c1c" : isPartTime ? "#fb8c00" : "#aaa", fontWeight: 600 }}>
                    {reported ? `❌ 不可 ${recs.length} 天` : isPartTime ? "⚠️ 未回報" : "✓ 正職"}
                  </div>
                </div>
                {reported && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {recs.sort((a, b) => a.start_date.localeCompare(b.start_date)).map(r => (
                      <span key={r.id} style={{ fontSize: 11, background: r.half_day ? "#fff8e6" : "#fde8e8", color: r.half_day ? "#b45309" : "#b91c1c", borderRadius: 4, padding: "2px 6px" }}>
                        {r.start_date.slice(5)} {fmtHd(r.half_day)}
                      </span>
                    ))}
                  </div>
                )}
                {recs[0]?.reason && (
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>💬 {recs[0].reason}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 日期視角 */}
      {view === "day" && (
        <div>
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const dow = new Date(dateStr).getDay();
            const recs = byDate[dateStr] || [];
            const unavailNames = recs.map(r => `${r.employees?.name}${r.half_day ? `(${HALF_LABELS[r.half_day]})` : ""}`);
            const allNames = employees.map(e => e.name);
            const availNames = allNames.filter(n => !recs.find(r => r.employees?.name === n));

            return (
              <div key={dateStr} style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: "8px 12px", marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: dow === 0 ? "#b91c1c" : dow === 6 ? "#b45309" : "#333" }}>
                    {m}/{d}（{["日","一","二","三","四","五","六"][dow]}）
                  </div>
                  {recs.length === 0
                    ? <span style={{ fontSize: 11, color: "#0a7c42" }}>✅ 全員可出勤</span>
                    : <span style={{ fontSize: 11, color: "#b91c1c", fontWeight: 600 }}>❌ {recs.length} 人不可</span>
                  }
                </div>
                {recs.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: 11 }}>
                    <span style={{ color: "#b91c1c" }}>限制：{recs.map(r => `${r.employees?.name}(${fmtHd(r.half_day)})`).join("、")}</span>
                  </div>
                )}
                {recs.length > 0 && availNames.length > 0 && (
                  <div style={{ marginTop: 2, fontSize: 11, color: "#0a7c42" }}>
                    可排：{availNames.join("、")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 12, textAlign: "center" }}>
        <a href={`/me?eid=${eid}`} style={{ fontSize: 12, color: "#3f51b5" }}>← 回面板</a>
      </div>
    </div>
  );
}
