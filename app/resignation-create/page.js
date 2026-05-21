"use client";
import { useEffect, useState } from "react";

const TYPES = [
  { id: "voluntary", label: "自願離職" },
  { id: "company_terminated", label: "公司資遣" },
  { id: "contract_end", label: "契約期滿" },
  { id: "retirement", label: "退休" },
];

const fmt = n => "$" + Number(n || 0).toLocaleString();

export default function ResignationCreatePage() {
  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [auth, setAuth] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);
  const [history, setHistory] = useState([]);

  const [form, setForm] = useState({
    resignation_type: "voluntary",
    last_working_date: new Date().toISOString().slice(0, 10),
    reason: "",
    additional_notes: "",
    settlement_override: "",
    notice_days_override: "",
  });

  const eid = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("eid") : null;

  useEffect(() => {
    try { setAuth(JSON.parse(localStorage.getItem("sb_auth") || "null")); } catch {}
    if (!eid) { setErr("缺少員工識別碼（?eid=）"); setLoading(false); return; }
    Promise.all([
      fetch("/api/admin/employees?id=" + eid).then(r => r.json()),
      fetch("/api/admin/resignations?employee_id=" + eid).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([e, h]) => {
      if (e.error || !e.data) { setErr("找不到員工"); setLoading(false); return; }
      setEmp(e.data);
      setHistory(h.data || []);
      setLoading(false);
    });
  }, [eid]);

  if (loading) return <Box><p style={{ textAlign: "center", padding: 40, color: "#888" }}>載入中…</p></Box>;
  if (err) return <Box><p style={{ textAlign: "center", padding: 40, color: "#b91c1c" }}>{err}</p></Box>;

  const months = emp.service_months || 0;
  const noticeAuto = months < 3 ? 0 : months < 12 ? 10 : months < 36 ? 20 : 30;
  const noticeFinal = form.notice_days_override !== "" ? Number(form.notice_days_override) : noticeAuto;
  const dailyPay = emp.monthly_salary ? Math.round(emp.monthly_salary / 30) : (emp.hourly_rate ? Number(emp.hourly_rate) * 8 : 0);
  const remaining = Number(emp.annual_leave_days || 0);
  const settlementAuto = Math.round(remaining * dailyPay);
  const settlementFinal = form.settlement_override !== "" ? Number(form.settlement_override) : settlementAuto;

  const pendingExists = history.some(h => h.status === "pending");

  const submit = async () => {
    if (!form.last_working_date) { alert("請填寫最後工作日"); return; }
    if (pendingExists) { alert("此員工已有待簽署的離職單，請先處理或取消"); return; }
    if (!confirm(
      `確認發送 ${emp.name} 的離職同意書？\n\n離職類型：${TYPES.find(t => t.id === form.resignation_type)?.label}\n最後工作日：${form.last_working_date}\n特休結算：${fmt(settlementFinal)}\n\n發送後員工會在 LINE 收到簽署連結。`
    )) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/admin/resignations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          employee_id: eid,
          resignation_type: form.resignation_type,
          last_working_date: form.last_working_date,
          reason: form.reason,
          additional_notes: form.additional_notes,
          settlement_override: form.settlement_override !== "" ? Number(form.settlement_override) : null,
          notice_days_override: form.notice_days_override !== "" ? Number(form.notice_days_override) : null,
          created_by: auth?.employee_id || null,
        }),
      }).then(x => x.json());
      if (r.error) { alert("❌ " + r.error); setSubmitting(false); return; }
      setCreated(r);
    } catch (e) { alert("送出失敗：" + e.message); }
    setSubmitting(false);
  };

  const cancelResignation = async (id) => {
    const reason = prompt("取消原因（必填）：");
    if (!reason) return;
    const r = await fetch("/api/admin/resignations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", resignation_id: id, cancel_reason: reason, cancelled_by: auth?.employee_id || null }),
    }).then(x => x.json());
    if (r.error) { alert("❌ " + r.error); return; }
    alert("已取消");
    location.reload();
  };

  const resend = async (id) => {
    const r = await fetch("/api/admin/resignations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resend", resignation_id: id }),
    }).then(x => x.json());
    if (r.error) { alert("❌ " + r.error); return; }
    alert("已重發 LINE 通知");
  };

  if (created) return <Box>
    <div style={{ padding: 20, textAlign: "center" }}>
      <div style={{ fontSize: 44, marginBottom: 8 }}>📤</div>
      <h2 style={{ fontSize: 16, fontWeight: 700 }}>離職同意書已發送</h2>
      <p style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
        員工會在 LINE 收到簽署連結。<br />
        若員工沒收到，可複製下方連結直接傳給員工：
      </p>
      <input value={created.sign_url} readOnly onClick={e => e.target.select()}
        style={{ width: "100%", padding: 8, marginTop: 10, borderRadius: 6, border: "1px solid #ddd", fontSize: 11 }} />
      <button onClick={() => navigator.clipboard.writeText(created.sign_url)}
        style={{ marginTop: 8, padding: "6px 14px", borderRadius: 6, border: "1px solid #4361ee", background: "#fff", color: "#4361ee", fontSize: 12, cursor: "pointer" }}>📋 複製連結</button>
      <div style={{ marginTop: 20 }}>
        <a href="/" style={{ color: "#666", fontSize: 12 }}>← 返回後台</a>
      </div>
    </div>
  </Box>;

  return (
    <Box>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <a href="/" style={{ fontSize: 11, color: "#666" }}>← 返回後台</a>
      </div>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>🚪 建立離職同意書</h1>
      <p style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>
        員工：<b>{emp.name}</b>{emp.stores?.name ? "｜🏠 " + emp.stores.name : ""}
      </p>

      {/* 歷史紀錄 */}
      {history.length > 0 && (
        <div style={{ background: "#fef3c7", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 11 }}>
          <div style={{ fontWeight: 600, color: "#92400e", marginBottom: 4 }}>📜 此員工歷史離職紀錄</div>
          {history.map(h => (
            <div key={h.id} style={{ padding: "6px 0", borderBottom: "1px dashed #fbbf24", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div>{h.last_working_date}｜{TYPES.find(t => t.id === h.resignation_type)?.label || h.resignation_type}</div>
                <div style={{ color: "#666" }}>狀態：{
                  h.status === "pending" ? "⏳ 待簽署" :
                  h.status === "signed" ? "✅ 已簽署 " + new Date(h.signed_at).toLocaleDateString("zh-TW") :
                  h.status === "cancelled" ? "❌ 已取消" : h.status
                }</div>
              </div>
              {h.status === "pending" && (
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => resend(h.id)} style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #4361ee", background: "#fff", color: "#4361ee", fontSize: 10, cursor: "pointer" }}>🔁 重發</button>
                  <button onClick={() => cancelResignation(h.id)} style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #b91c1c", background: "#fff", color: "#b91c1c", fontSize: 10, cursor: "pointer" }}>取消</button>
                </div>
              )}
              {h.status === "signed" && h.signature_url && (
                <a href={h.signature_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#4361ee" }}>看簽名</a>
              )}
            </div>
          ))}
        </div>
      )}

      {pendingExists && (
        <div style={{ background: "#fde8e8", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12, color: "#b91c1c" }}>
          ⚠️ 此員工有待簽署的離職單，請先處理或取消才能建立新的。
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #e8e6e1", borderRadius: 10, padding: 14 }}>
        <Row label="🏷 離職類型">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
            {TYPES.map(t => (
              <button key={t.id} onClick={() => setForm({ ...form, resignation_type: t.id })} type="button"
                style={{
                  padding: 8, borderRadius: 6, fontSize: 12, cursor: "pointer",
                  border: form.resignation_type === t.id ? "2px solid #b91c1c" : "1px solid #ddd",
                  background: form.resignation_type === t.id ? "#fde8e8" : "#fff",
                  color: form.resignation_type === t.id ? "#b91c1c" : "#666",
                  fontWeight: form.resignation_type === t.id ? 600 : 400,
                }}>{t.label}</button>
            ))}
          </div>
        </Row>

        <Row label="📅 最後工作日">
          <input type="date" value={form.last_working_date} onChange={e => setForm({ ...form, last_working_date: e.target.value })}
            style={inp} />
        </Row>

        <Row label="📝 離職原因">
          <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
            placeholder="（選填）例：另有生涯規劃、家庭因素…"
            style={{ ...inp, minHeight: 60, resize: "vertical", fontFamily: "inherit" }} />
        </Row>

        <Row label="📋 額外約定">
          <textarea value={form.additional_notes} onChange={e => setForm({ ...form, additional_notes: e.target.value })}
            placeholder="（選填）雙方額外約定條款"
            style={{ ...inp, minHeight: 50, resize: "vertical", fontFamily: "inherit" }} />
        </Row>

        <hr style={{ border: "none", borderTop: "1px dashed #ddd", margin: "12px 0" }} />

        <div style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>📊 自動試算（可覆蓋）</div>

        <Row label="服務年資">
          <span style={{ fontSize: 13 }}>{Math.floor(months / 12)} 年 {months % 12} 個月</span>
        </Row>

        <Row label="預告期">
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 13 }}>建議 <b>{noticeAuto}</b> 天</span>
            <input type="number" value={form.notice_days_override} onChange={e => setForm({ ...form, notice_days_override: e.target.value })}
              placeholder="覆蓋"
              style={{ ...inp, width: 70, padding: "4px 6px" }} />
          </div>
        </Row>

        <Row label="未休特休">
          <span style={{ fontSize: 13 }}>{remaining} 天</span>
        </Row>

        <Row label="💰 特休結算">
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#0a7c42", fontWeight: 600 }}>{fmt(settlementAuto)}</span>
            <input type="number" value={form.settlement_override} onChange={e => setForm({ ...form, settlement_override: e.target.value })}
              placeholder="覆蓋"
              style={{ ...inp, width: 90, padding: "4px 6px" }} />
          </div>
        </Row>

        <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>
          結算金額預設 = 未休特休天數 × 日薪（月薪/30 或時薪×8）。可填覆蓋值。
        </div>
      </div>

      <button onClick={submit} disabled={submitting || pendingExists}
        style={{ width: "100%", padding: 14, borderRadius: 10, border: "none",
          background: (submitting || pendingExists) ? "#ccc" : "#b91c1c",
          color: "#fff", fontSize: 15, fontWeight: 700, cursor: (submitting || pendingExists) ? "not-allowed" : "pointer",
          marginTop: 12 }}>
        {submitting ? "送出中…" : "📤 發送離職同意書給員工簽署"}
      </button>
      <p style={{ fontSize: 10, color: "#888", textAlign: "center", marginTop: 6 }}>
        發送後員工會在 LINE 收到簽署連結。簽署完成後系統自動：停用帳號、建立特休結算撥款。
      </p>
    </Box>
  );
}

const inp = { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 };

function Row({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 4, fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

function Box({ children }) {
  return <div style={{ maxWidth: 520, margin: "0 auto", padding: 16, fontFamily: "system-ui, 'Noto Sans TC', sans-serif", minHeight: "100vh", background: "#f7f5f0" }}>{children}</div>;
}
