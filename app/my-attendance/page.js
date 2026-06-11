"use client";
import { useState, useEffect } from "react";
import { PageShell, PageHeader, LoadingSkeleton, EmptyState, ErrorState, BackLink } from "../components/ui";
import { fetchJSON } from "@/lib/fetch-json";

export default function MyAttendance() {
  const [emp, setEmp] = useState(null);
  const [att, setAtt] = useState([]);
  const [summary, setSummary] = useState(null);
  const [month, setMonth] = useState(() => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }).slice(0, 7));
  const [loading, setLoading] = useState(true);

  const eid = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("eid") : null;

  useEffect(() => {
    if (!eid) return;
    fetchJSON("/api/admin/employees?id=" + eid).then(r => setEmp(r.data)).catch(() => {});
  }, [eid]);

  useEffect(() => {
    if (!eid || !month) return;
    setLoading(true);
    Promise.all([
      fetchJSON(`/api/admin/attendance?employee_id=${eid}&month=${month}`),
      fetchJSON(`/api/admin/attendance?summary=true&month=${month}&employee_id=${eid}`),
    ]).then(([a, s]) => {
      setAtt(a.data || []);
      setSummary(s.data?.[0] || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [eid, month]);

  if (!eid) return <PageShell maxWidth={420}><ErrorState message="缺少員工識別碼" /></PageShell>;

  const [y, m] = month.split("-").map(Number);

  return (
    <PageShell maxWidth={420}>
      <PageHeader emoji="📊" title="我的假勤" subtitle={emp?.name || "..."} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
        <button onClick={() => { const d = new Date(y, m - 2, 1); setMonth(d.toLocaleDateString("sv-SE").slice(0, 7)); }}
          className="sb-btn sb-btn-ghost" style={{ width: "auto", background: "var(--surface)", padding: "0 16px" }}>◀</button>
        <span style={{ fontSize: 15, fontWeight: 600, minWidth: 110, textAlign: "center" }}>{y} 年 {m} 月</span>
        <button onClick={() => { const d = new Date(y, m, 1); setMonth(d.toLocaleDateString("sv-SE").slice(0, 7)); }}
          className="sb-btn sb-btn-ghost" style={{ width: "auto", background: "var(--surface)", padding: "0 16px" }}>▶</button>
      </div>

      {loading ? <LoadingSkeleton kind="list" rows={5} /> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
            <Stat label="出勤天" value={summary?.work_days ?? att.filter(a => a.type === "clock_in").length} color="var(--success)" />
            <Stat label="遲到" value={summary?.late_count ?? att.filter(a => a.late_minutes > 0).length} color="var(--warning)" />
            <Stat label="早退" value={att.filter(a => a.early_leave_minutes > 0).length} color="var(--danger)" />
          </div>

          <div className="sb-card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", background: "var(--surface-warm)", fontSize: 13, fontWeight: 600 }}>打卡紀錄</div>
            {att.length === 0 && <EmptyState icon="🗓" title="本月無紀錄" />}
            {att.map(a => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderTop: "1px solid var(--divider)", fontSize: 12 }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{a.date || a.timestamp?.slice(0, 10)}</span>
                  <span style={{ color: a.type === "clock_in" ? "var(--success)" : "var(--info)", marginLeft: 6, fontWeight: 600 }}>
                    {a.type === "clock_in" ? "🟢 上班" : "🔵 下班"}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ color: "var(--text-2)" }}>{a.timestamp ? new Date(a.timestamp).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Taipei" }) : ""}</span>
                  {a.late_minutes > 0 && <span style={{ color: "var(--warning)", marginLeft: 4, fontSize: 10 }}>遲到{a.late_minutes}分</span>}
                  {a.early_leave_minutes > 0 && <span style={{ color: "var(--danger)", marginLeft: 4, fontSize: 10 }}>早退{a.early_leave_minutes}分</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <BackLink eid={eid} />
    </PageShell>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="sb-card" style={{ borderRadius: "var(--radius-sm)", padding: "8px 6px", textAlign: "center", marginBottom: 0 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--text-3)" }}>{label}</div>
    </div>
  );
}
