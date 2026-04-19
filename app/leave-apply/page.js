"use client";
import { useState, useEffect } from "react";

const TYPES = [
  { k: "annual", l: "🏖 特休", desc: "有薪，不扣薪" },
  { k: "comp_time", l: "🔄 補休", desc: "扣補休餘額" },
  { k: "personal", l: "📋 事假", desc: "扣全薪" },
  { k: "sick", l: "🤒 病假", desc: "扣半薪" },
  { k: "menstrual", l: "🩸 生理假", desc: "扣半薪" },
  { k: "marriage", l: "💒 婚假", desc: "有薪" },
  { k: "funeral", l: "🕯 喪假", desc: "有薪" },
  { k: "paternity", l: "👶 陪產假", desc: "有薪" },
  { k: "family_care", l: "🏠 家庭照顧假", desc: "扣全薪" },
];

export default function LeaveApply() {
  const [emp, setEmp] = useState(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ type: "", startDate: "", endDate: "", halfDay: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [balance, setBalance] = useState(null);

  const eid = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("eid") : null;

  useEffect(() => {
    if (!eid) return;
    fetch("/api/admin/employees?id=" + eid).then(r => r.json()).then(r => setEmp(r.data));
    fetch("/api/admin/leave-balances?employee_id=" + eid + "&year=" + new Date().getFullYear()).then(r => r.json()).then(r => setBalance(r)).catch(() => {});
  }, [eid]);

  const submit = async () => {
    if (!form.type || !form.startDate) { setErr("請選假別和日期"); return; }
    setSubmitting(true); setErr("");
    const r = await fetch("/api/admin/leaves", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        employee_id: eid,
        leave_type: form.type,
        start_date: form.startDate,
        end_date: form.endDate || form.startDate,
        half_day: form.halfDay || null,
        request_type: "leave",
      }),
    }).then(r => r.json());
    setSubmitting(false);
    if (r.error) { setErr(r.error); return; }
    setDone(true);
  };

  const wrap = { maxWidth: 420, margin: "0 auto", padding: 16, fontFamily: "system-ui, 'Noto Sans TC', sans-serif", background: "#f7f5f0", minHeight: "100vh" };

  if (!eid) return <div style={wrap}><p style={{ textAlign: "center", color: "#b91c1c", padding: 40 }}>缺少員工識別碼</p></div>;

  if (done) {
    const typeInfo = TYPES.find(t => t.k === form.type) || {};
    const days = form.halfDay ? 0.5 : (form.endDate && form.endDate !== form.startDate
      ? Math.ceil((new Date(form.endDate) - new Date(form.startDate)) / 86400000) + 1 : 1);
    return (
      <div style={wrap}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>請假已送出</div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>等待主管審核</div>
          <div style={{ background: "#f7f5f0", borderRadius: 8, padding: 12, textAlign: "left", fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #e8e6e1" }}><span style={{ color: "#888" }}>假別</span><span style={{ fontWeight: 500 }}>{typeInfo.l}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #e8e6e1" }}><span style={{ color: "#888" }}>日期</span><span style={{ fontWeight: 500 }}>{form.startDate}{form.endDate && form.endDate !== form.startDate ? " ~ " + form.endDate : ""}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #e8e6e1" }}><span style={{ color: "#888" }}>天數</span><span style={{ fontWeight: 500 }}>{days} 天</span></div>
            {form.halfDay && <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span style={{ color: "#888" }}>時段</span><span style={{ fontWeight: 500 }}>{form.halfDay === "am" ? "上午" : "下午"}</span></div>}
          </div>
          <a href={`/me?eid=${eid}`} style={{ display: "block", marginTop: 16, padding: "10px 0", borderRadius: 8, background: "#4361ee", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>← 回面板</a>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", borderRadius: 14, padding: "16px", marginBottom: 12, color: "#fff" }}>
        <div style={{ fontSize: 11, opacity: 0.9 }}>🏖 請假申請</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{emp?.name || "..."}</div>
        <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>{emp?.stores?.name || ""}</div>
      </div>

      {balance && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
          <div style={{ background: "#e6f1fb", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#888" }}>特休餘額</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#4361ee" }}>{balance.annual_remaining ?? "-"} 天</div>
          </div>
          <div style={{ background: "#e6f9f0", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#888" }}>補休餘額</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0a7c42" }}>{balance.comp_available ?? "-"} hr</div>
          </div>
        </div>
      )}

      {/* Step 1: 選假別 */}
      {step === 1 && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>1. 選擇假別</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {TYPES.map(t => (
              <button key={t.k} onClick={() => { setForm({ ...form, type: t.k }); setStep(2); }}
                style={{ padding: "10px 8px", borderRadius: 8, border: form.type === t.k ? "2px solid #4361ee" : "1px solid #ddd", background: form.type === t.k ? "#e6f1fb" : "#fff", cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{t.l}</div>
                <div style={{ fontSize: 9, color: "#888", marginTop: 2 }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: 選日期 */}
      {step === 2 && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            2. 選擇日期
            <span style={{ fontSize: 10, color: "#4361ee", marginLeft: 8, cursor: "pointer" }} onClick={() => setStep(1)}>← 改假別</span>
          </div>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>
            {TYPES.find(t => t.k === form.type)?.l}
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 2 }}>開始日期</label>
            <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value, endDate: e.target.value })}
              style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 2 }}>結束日期（多天請假）</label>
            <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} min={form.startDate}
              style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 4 }}>整天或半天</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {[["", "整天"], ["am", "上午半天"], ["pm", "下午半天"]].map(([v, l]) => (
                <button key={v} onClick={() => setForm({ ...form, halfDay: v })}
                  style={{ padding: "8px", borderRadius: 6, border: form.halfDay === v ? "2px solid #4361ee" : "1px solid #ddd", background: form.halfDay === v ? "#e6f1fb" : "#fff", cursor: "pointer", fontSize: 11, fontWeight: 500 }}>{l}</button>
              ))}
            </div>
          </div>

          {err && <div style={{ color: "#b91c1c", fontSize: 11, marginBottom: 6 }}>❌ {err}</div>}

          <button onClick={submit} disabled={submitting || !form.startDate}
            style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: submitting ? "#ccc" : "#4361ee", color: "#fff", fontSize: 14, fontWeight: 600, cursor: submitting ? "default" : "pointer" }}>
            {submitting ? "送出中..." : "📤 送出請假申請"}
          </button>
        </div>
      )}

      <div style={{ marginTop: 14, textAlign: "center" }}>
        <a href={`/me?eid=${eid}`} style={{ fontSize: 12, color: "#4361ee" }}>← 回面板</a>
      </div>
    </div>
  );
}
