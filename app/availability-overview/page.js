"use client";
import { useState, useEffect } from "react";
import { PageShell, PageHeader, LoadingSkeleton, ErrorState, BackLink } from "../components/ui";
import { fetchJSON } from "@/lib/fetch-json";

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
    fetchJSON("/api/admin/employees?id=" + id).then(r => {
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
      fetchJSON(`/api/admin/employees${storeId ? "?store_id=" + storeId : ""}`),
      fetchJSON(`/api/availability?month=${month}${storeQ}`),
    ]).then(([empR, repR]) => {
      setEmployees((empR.data || []).filter(e => e.is_active));
      setReports(repR.data || []);
    }).catch(() => {});
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

  if (loading) return <PageShell maxWidth={520} style={{ padding: 10 }}><LoadingSkeleton kind="list" rows={5} /></PageShell>;
  if (err) return <PageShell maxWidth={520} style={{ padding: 10 }}><ErrorState message={err} onRetry={() => window.location.reload()} /></PageShell>;

  const partTimers = employees.filter(e => e.employment_type === "part_time");
  const reportedIds = new Set(Object.keys(byEmployee));

  return (
    <PageShell maxWidth={520} style={{ padding: 10 }}>
      <PageHeader emoji="👥" title="員工可用時段總覽" variant="audit"
        subtitle={`${manager?.stores?.name || "全部門市"}　·　僅主管可見`} />

      {/* 月份 + 視角切換 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <button onClick={() => { const d = new Date(y, m - 2, 1); setMonth(d.toLocaleDateString("sv-SE").slice(0, 7)); }}
          className="sb-btn sb-btn-ghost" style={{ width: "auto", background: "var(--surface)", padding: "0 14px" }}>◀</button>
        <span style={{ flex: 1, textAlign: "center", fontSize: 15, fontWeight: 600 }}>{y} 年 {m} 月</span>
        <button onClick={() => { const d = new Date(y, m, 1); setMonth(d.toLocaleDateString("sv-SE").slice(0, 7)); }}
          className="sb-btn sb-btn-ghost" style={{ width: "auto", background: "var(--surface)", padding: "0 14px" }}>▶</button>
        <button onClick={() => setView(v => v === "employee" ? "day" : "employee")}
          className="sb-btn sb-btn-ghost" style={{ width: "auto", background: "var(--surface)", padding: "0 14px", fontSize: 12, color: "var(--brand-strong)", fontWeight: 600 }}>
          {view === "employee" ? "日期視角" : "員工視角"}
        </button>
      </div>

      {/* 未回報提示 */}
      {partTimers.filter(e => !reportedIds.has(e.id)).length > 0 && (
        <div style={{ background: "var(--warning-bg)", border: "1px solid var(--sugar-400)", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: "var(--warning)" }}>
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
              <div key={emp.id} className="sb-card" style={{ borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: reported ? 8 : 0 }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{emp.name}</span>
                    <span style={{ fontSize: 10, color: "var(--text-3)", marginLeft: 6 }}>
                      {isPartTime ? "兼職" : "正職"}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: reported ? "var(--danger)" : isPartTime ? "var(--warning)" : "var(--text-hint)", fontWeight: 600 }}>
                    {reported ? `❌ 不可 ${recs.length} 天` : isPartTime ? "⚠️ 未回報" : "✓ 正職"}
                  </div>
                </div>
                {reported && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {recs.sort((a, b) => a.start_date.localeCompare(b.start_date)).map(r => (
                      <span key={r.id} style={{ fontSize: 11, background: r.half_day ? "var(--warning-bg)" : "var(--danger-bg)", color: r.half_day ? "var(--warning)" : "var(--danger)", borderRadius: 4, padding: "2px 6px" }}>
                        {r.start_date.slice(5)} {fmtHd(r.half_day)}
                      </span>
                    ))}
                  </div>
                )}
                {recs[0]?.reason && (
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>💬 {recs[0].reason}</div>
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
            const allNames = employees.map(e => e.name);
            const availNames = allNames.filter(n => !recs.find(r => r.employees?.name === n));

            return (
              <div key={dateStr} className="sb-card" style={{ borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: dow === 0 ? "var(--danger)" : dow === 6 ? "var(--warning)" : "var(--text)" }}>
                    {m}/{d}（{["日","一","二","三","四","五","六"][dow]}）
                  </div>
                  {recs.length === 0
                    ? <span style={{ fontSize: 11, color: "var(--success)" }}>✅ 全員可出勤</span>
                    : <span style={{ fontSize: 11, color: "var(--danger)", fontWeight: 600 }}>❌ {recs.length} 人不可</span>
                  }
                </div>
                {recs.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: 11 }}>
                    <span style={{ color: "var(--danger)" }}>限制：{recs.map(r => `${r.employees?.name}(${fmtHd(r.half_day)})`).join("、")}</span>
                  </div>
                )}
                {recs.length > 0 && availNames.length > 0 && (
                  <div style={{ marginTop: 2, fontSize: 11, color: "var(--success)" }}>
                    可排：{availNames.join("、")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <BackLink eid={eid} />
    </PageShell>
  );
}
