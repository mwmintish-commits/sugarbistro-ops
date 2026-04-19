"use client";
import { useState, useEffect } from "react";

const REASONS = ["忘記打卡", "手機沒電", "GPS 失效", "系統異常"];

export default function Amendment() {
  const [emp, setEmp] = useState(null);
  const [form, setForm] = useState({ date: "", type: "clock_in", time: "", reason: "" });
  const [customReason, setCustomReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const eid = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("eid") : null;

  useEffect(() => {
    if (!eid) return;
    fetch("/api/admin/employees?id=" + eid).then(r => r.json()).then(r => setEmp(r.data));
  }, [eid]);

  const submit = async () => {
    const reason = form.reason === "__custom" ? customReason : form.reason;
    if (!form.date || !form.time || !reason) { setErr("請填寫所有欄位"); return; }
    setSubmitting(true); setErr("");
    const r = await fetch("/api/admin/attendance", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_amendment", employee_id: eid, store_id: emp?.store_id, date: form.date, type: form.type, amended_time: form.time, reason }),
    }).then(r => r.json());
    setSubmitting(false);
    if (r.error) { setErr(r.error); return; }
    setDone(true);
  };

  const wrap = { maxWidth: 420, margin: "0 auto", padding: 16, fontFamily: "system-ui, 'Noto Sans TC', sans-serif", background: "#f7f5f0", minHeight: "100vh" };
  if (!eid) return <div style={wrap}><p style={{ textAlign: "center", color: "#b91c1c", padding: 40 }}>缺少員工識別碼</p></div>;

  if (done) return (
    <div style={wrap}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>補打卡已送出</div>
        <div style={{ fontSize: 12, color: "#888", marginTop: 4, marginBottom: 16 }}>等待主管審核</div>
        <div style={{ background: "#f7f5f0", borderRadius: 8, padding: 12, textAlign: "left", fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #e8e6e1" }}><span style={{ color: "#888" }}>日期</span><span>{form.date}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #e8e6e1" }}><span style={{ color: "#888" }}>類型</span><span>{form.type === "clock_in" ? "上班" : "下班"}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span style={{ color: "#888" }}>時間</span><span>{form.time}</span></div>
        </div>
        <a href={`/me?eid=${eid}`} style={{ display: "block", marginTop: 16, padding: "10px", borderRadius: 8, background: "#4361ee", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>← 回面板</a>
      </div>
    </div>
  );

  return (
    <div style={wrap}>
      <div style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: 14, padding: "16px", marginBottom: 12, color: "#fff" }}>
        <div style={{ fontSize: 11, opacity: 0.9 }}>🕐 補打卡申請</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{emp?.name || "..."}</div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", padding: 14 }}>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 3 }}>日期</label>
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
            style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 3 }}>打卡類型</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {[["clock_in", "🌅 上班"], ["clock_out", "🌙 下班"]].map(([v, l]) => (
              <button key={v} onClick={() => setForm({ ...form, type: v })}
                style={{ padding: 10, borderRadius: 6, border: form.type === v ? "2px solid #4361ee" : "1px solid #ddd", background: form.type === v ? "#e6f1fb" : "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{l}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 3 }}>實際時間</label>
          <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })}
            style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 3 }}>原因</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 4 }}>
            {REASONS.map(r => (
              <button key={r} onClick={() => setForm({ ...form, reason: r })}
                style={{ padding: 6, borderRadius: 6, border: form.reason === r ? "2px solid #4361ee" : "1px solid #ddd", background: form.reason === r ? "#e6f1fb" : "#fff", cursor: "pointer", fontSize: 11 }}>{r}</button>
            ))}
          </div>
          <button onClick={() => setForm({ ...form, reason: "__custom" })}
            style={{ width: "100%", padding: 6, borderRadius: 6, border: form.reason === "__custom" ? "2px solid #4361ee" : "1px solid #ddd", background: form.reason === "__custom" ? "#e6f1fb" : "#fff", cursor: "pointer", fontSize: 11 }}>其他（自行輸入）</button>
          {form.reason === "__custom" && (
            <input value={customReason} onChange={e => setCustomReason(e.target.value)} placeholder="請輸入原因"
              style={{ width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12 }} />
          )}
        </div>

        {err && <div style={{ color: "#b91c1c", fontSize: 11, marginBottom: 6 }}>❌ {err}</div>}

        <button onClick={submit} disabled={submitting}
          style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: submitting ? "#ccc" : "#6366f1", color: "#fff", fontSize: 14, fontWeight: 600, cursor: submitting ? "default" : "pointer" }}>
          {submitting ? "送出中..." : "📤 送出補打卡申請"}
        </button>
      </div>

      <div style={{ marginTop: 14, textAlign: "center" }}>
        <a href={`/me?eid=${eid}`} style={{ fontSize: 12, color: "#4361ee" }}>← 回面板</a>
      </div>
    </div>
  );
}
