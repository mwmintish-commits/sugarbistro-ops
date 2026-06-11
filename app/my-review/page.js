"use client";
import { useState, useEffect } from "react";
import { PageShell, PageHeader, LoadingSkeleton, EmptyState, ErrorState, BackLink } from "../components/ui";
import { fetchJSON } from "@/lib/fetch-json";

const SCORE_ITEMS = [
  { key: "attendance_score", label: "出勤紀律", max: 30, color: "var(--info)" },
  { key: "worklog_score", label: "工作日誌", max: 20, color: "var(--brand-strong)" },
  { key: "task_score", label: "工作能力", max: 30, color: "var(--success)" },
  { key: "attitude_score", label: "服務態度", max: 20, color: "var(--warning)" },
];

const GRADE_MAP = {
  A: { label: "A 優秀", color: "var(--success)", bg: "var(--success-bg)" },
  B: { label: "B 良好", color: "var(--info)", bg: "var(--info-bg)" },
  C: { label: "C 待加強", color: "var(--warning)", bg: "var(--warning-bg)" },
  D: { label: "D 需改進", color: "var(--danger)", bg: "var(--danger-bg)" },
};

export default function MyReviewPage() {
  const [emp, setEmp] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selYear, setSelYear] = useState(new Date().getFullYear());
  const [selQ, setSelQ] = useState(Math.ceil((new Date().getMonth() + 1) / 3));

  const eid = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("eid") : null;

  const loadReviews = async (year, q) => {
    const r = await fetchJSON(`/api/admin/reviews?year=${year}&quarter=${q}`);
    setReviews((r.data || []).filter(rv => rv.employee_id === eid));
  };

  useEffect(() => {
    if (!eid) { setErr("缺少員工識別碼"); setLoading(false); return; }
    fetchJSON("/api/admin/employees?id=" + eid).then(r => {
      if (!r.data) { setErr("找不到員工資料"); setLoading(false); return; }
      setEmp(r.data);
      loadReviews(selYear, selQ).then(() => setLoading(false));
    }).catch(() => { setErr("載入失敗"); setLoading(false); });
  }, []);

  const handleFilter = (year, q) => {
    setSelYear(year); setSelQ(q);
    loadReviews(year, q);
  };

  if (loading) return <PageShell><LoadingSkeleton kind="list" rows={4} /></PageShell>;
  if (err) return <PageShell><ErrorState message={err} onRetry={() => window.location.reload()} /></PageShell>;

  const review = reviews[0];
  const currentYear = new Date().getFullYear();
  const grade = review ? GRADE_MAP[review.grade] || GRADE_MAP["C"] : null;

  return (
    <PageShell>
      <PageHeader emoji="📝" title="我的考核" subtitle={`${emp?.name || ""}　·　${emp?.stores?.name || "🏢 總部"}`} />

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <select value={selYear} onChange={e => handleFilter(Number(e.target.value), selQ)}
          style={{ flex: 1, padding: "10px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}>
          {[currentYear, currentYear - 1].map(y => <option key={y} value={y}>{y} 年</option>)}
        </select>
        <select value={selQ} onChange={e => handleFilter(selYear, Number(e.target.value))}
          style={{ flex: 1, padding: "10px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}>
          {[1, 2, 3, 4].map(q => <option key={q} value={q}>第 {q} 季</option>)}
        </select>
      </div>

      {!review
        ? (
          <div className="sb-card">
            <EmptyState icon="📋" title="此季尚無考核紀錄" />
          </div>
        )
        : (
          <>
            <div className="sb-card" style={{ padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{selYear} 年 Q{selQ} 考核結果</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: grade.color, background: grade.bg, borderRadius: 6, padding: "3px 10px" }}>{grade.label}</div>
              </div>

              <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", gap: 4, marginBottom: 14, padding: "10px 0", background: "var(--surface-warm)", borderRadius: "var(--radius-sm)" }}>
                <div style={{ fontSize: 40, fontWeight: 700, color: "var(--brand-strong)" }}>{review.total_score ?? "-"}</div>
                <div style={{ fontSize: 14, color: "var(--text-3)" }}>/ 100</div>
              </div>

              {SCORE_ITEMS.map(item => {
                const score = review[item.key] ?? 0;
                const pct = Math.round((score / item.max) * 100);
                return (
                  <div key={item.key} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: "var(--text-2)" }}>{item.label}</span>
                      <span style={{ fontWeight: 600, color: item.color }}>{score} / {item.max}</span>
                    </div>
                    <div style={{ height: 6, background: "var(--paper)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: pct + "%", height: "100%", background: item.color, borderRadius: 3, transition: "width 0.4s" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {review.notes && (
              <div className="sb-card" style={{ padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>💬 主管評語</div>
                <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>{review.notes}</div>
              </div>
            )}
          </>
        )
      }

      <BackLink eid={eid} />
    </PageShell>
  );
}
