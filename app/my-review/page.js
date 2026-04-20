"use client";
import { useState, useEffect } from "react";

const SCORE_ITEMS = [
  { key: "attendance_score", label: "出勤紀律", max: 30, color: "#1565c0" },
  { key: "worklog_score", label: "工作日誌", max: 20, color: "#6a1b9a" },
  { key: "task_score", label: "工作能力", max: 30, color: "#0a7c42" },
  { key: "attitude_score", label: "服務態度", max: 20, color: "#e65100" },
];

const GRADE_MAP = {
  A: { label: "A 優秀", color: "#0a7c42", bg: "#e8f5e9" },
  B: { label: "B 良好", color: "#1565c0", bg: "#e3f2fd" },
  C: { label: "C 待加強", color: "#e65100", bg: "#fff3e0" },
  D: { label: "D 需改進", color: "#b91c1c", bg: "#ffebee" },
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
    const r = await fetch(`/api/admin/reviews?year=${year}&quarter=${q}`).then(r => r.json());
    setReviews((r.data || []).filter(rv => rv.employee_id === eid));
  };

  useEffect(() => {
    if (!eid) { setErr("缺少員工識別碼"); setLoading(false); return; }
    fetch("/api/admin/employees?id=" + eid).then(r => r.json()).then(r => {
      if (!r.data) { setErr("找不到員工資料"); setLoading(false); return; }
      setEmp(r.data);
      loadReviews(selYear, selQ).then(() => setLoading(false));
    }).catch(() => { setErr("載入失敗"); setLoading(false); });
  }, []);

  const handleFilter = (year, q) => {
    setSelYear(year); setSelQ(q);
    loadReviews(year, q);
  };

  const wrap = { maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "system-ui, 'Noto Sans TC', sans-serif", background: "#f7f5f0", minHeight: "100vh" };

  if (loading) return <div style={wrap}><p style={{ textAlign: "center", color: "#888", padding: 60 }}>載入中...</p></div>;
  if (err) return <div style={wrap}><p style={{ textAlign: "center", color: "#b91c1c", padding: 60 }}>{err}</p></div>;

  const review = reviews[0];
  const currentYear = new Date().getFullYear();
  const grade = review ? GRADE_MAP[review.grade] || GRADE_MAP["C"] : null;

  return (
    <div style={wrap}>
      <div style={{ background: "linear-gradient(135deg, #2e7d32, #1b5e20)", borderRadius: 16, padding: "16px 18px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 11, opacity: 0.85 }}>📝 我的考核</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{emp?.name}</div>
        <div style={{ fontSize: 12, marginTop: 2, opacity: 0.85 }}>{emp?.stores?.name || "🏢 總部"}</div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <select value={selYear} onChange={e => handleFilter(Number(e.target.value), selQ)}
          style={{ flex: 1, padding: "8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }}>
          {[currentYear, currentYear - 1].map(y => <option key={y} value={y}>{y} 年</option>)}
        </select>
        <select value={selQ} onChange={e => handleFilter(selYear, Number(e.target.value))}
          style={{ flex: 1, padding: "8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }}>
          {[1, 2, 3, 4].map(q => <option key={q} value={q}>第 {q} 季</option>)}
        </select>
      </div>

      {!review
        ? (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 14, color: "#888" }}>此季尚無考核紀錄</div>
          </div>
        )
        : (
          <>
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{selYear} 年 Q{selQ} 考核結果</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: grade.color, background: grade.bg, borderRadius: 6, padding: "3px 10px" }}>{grade.label}</div>
              </div>

              <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", gap: 4, marginBottom: 14, padding: "10px 0", background: "#fafafa", borderRadius: 8 }}>
                <div style={{ fontSize: 40, fontWeight: 700, color: "#1b5e20" }}>{review.total_score ?? "-"}</div>
                <div style={{ fontSize: 14, color: "#888" }}>/ 100</div>
              </div>

              {SCORE_ITEMS.map(item => {
                const score = review[item.key] ?? 0;
                const pct = Math.round((score / item.max) * 100);
                return (
                  <div key={item.key} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: "#555" }}>{item.label}</span>
                      <span style={{ fontWeight: 600, color: item.color }}>{score} / {item.max}</span>
                    </div>
                    <div style={{ height: 6, background: "#eee", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: pct + "%", height: "100%", background: item.color, borderRadius: 3, transition: "width 0.4s" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {review.notes && (
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>💬 主管評語</div>
                <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>{review.notes}</div>
              </div>
            )}
          </>
        )
      }

      <div style={{ marginTop: 8, textAlign: "center" }}>
        <a href={`/me?eid=${eid}`} style={{ fontSize: 12, color: "#1b5e20" }}>← 回面板</a>
      </div>
    </div>
  );
}
