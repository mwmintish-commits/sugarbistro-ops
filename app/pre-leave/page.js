"use client";
import { useState, useEffect } from "react";

const LEAVE_TYPES = [
  { k: "off", l: "⬛ 例假" },
  { k: "rest", l: "🔲 休息日" },
  { k: "annual", l: "🏖 特休" },
  { k: "personal", l: "📋 事假" },
  { k: "sick", l: "🤒 病假" },
  { k: "comp_time", l: "🔄 補休" },
];
const LT_MAP = Object.fromEntries(LEAVE_TYPES.map(t => [t.k, t.l]));
const IS_MANAGER = (role) => ["admin", "manager", "store_manager"].includes(role);

export default function PreLeavePage() {
  const [emp, setEmp] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ employee_id: "", leave_type: "off", start_date: "", end_date: "" });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  const eid = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("eid") : null;

  const loadLeaves = async (empId) => {
    const today = new Date().toLocaleDateString("sv-SE");
    const r = await fetch(`/api/admin/leaves?employee_id=${empId}&request_type=pre_arranged`).then(r => r.json());
    setLeaves((r.data || []).filter(l => l.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date)));
  };

  useEffect(() => {
    if (!eid) { setErr("缺少員工識別碼"); setLoading(false); return; }
    Promise.all([
      fetch("/api/admin/employees?id=" + eid).then(r => r.json()),
    ]).then(([empR]) => {
      if (!empR.data) { setErr("找不到員工資料"); setLoading(false); return; }
      const e = empR.data;
      setEmp(e);
      setForm(f => ({ ...f, employee_id: eid }));
      loadLeaves(eid);
      if (IS_MANAGER(e.role)) {
        fetch("/api/admin/employees").then(r => r.json()).then(r => setEmployees(r.data || []));
      }
      setLoading(false);
    }).catch(() => { setErr("載入失敗"); setLoading(false); });
  }, []);

  const submit = async () => {
    if (!form.employee_id || !form.leave_type || !form.start_date) { setMsg("請填寫完整資料"); return; }
    setSubmitting(true); setMsg("");
    const r = await fetch("/api/admin/leaves", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        employee_id: form.employee_id,
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date || form.start_date,
        request_type: "pre_arranged",
      }),
    }).then(r => r.json());
    setSubmitting(false);
    if (r.error) { setMsg("❌ " + r.error); return; }
    setMsg("✅ 預排假已建立");
    setForm(f => ({ ...f, leave_type: "off", start_date: "", end_date: "" }));
    loadLeaves(form.employee_id === eid ? eid : eid);
  };

  const wrap = { maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "system-ui, 'Noto Sans TC', sans-serif", background: "#f7f5f0", minHeight: "100vh" };

  if (loading) return <div style={wrap}><p style={{ textAlign: "center", color: "#888", padding: 60 }}>載入中...</p></div>;
  if (err) return <div style={wrap}><p style={{ textAlign: "center", color: "#b91c1c", padding: 60 }}>{err}</p></div>;

  return (
    <div style={wrap}>
      <div style={{ background: "linear-gradient(135deg, #3f51b5, #1a237e)", borderRadius: 16, padding: "16px 18px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 11, opacity: 0.85 }}>📆 預排假</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{emp?.name}</div>
        <div style={{ fontSize: 12, marginTop: 2, opacity: 0.85 }}>{emp?.stores?.name || "🏢 總部"}</div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#333" }}>📅 近期預排休假</div>
        {leaves.length === 0
          ? <p style={{ color: "#aaa", fontSize: 12, textAlign: "center", padding: "12px 0" }}>目前無預排休假</p>
          : leaves.map(l => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f0ede8" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{LT_MAP[l.leave_type] || l.leave_type}</div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                  {l.start_date}{l.end_date !== l.start_date ? ` ~ ${l.end_date}` : ""}
                  {l.employees?.name && l.employee_id !== eid ? ` · ${l.employees.name}` : ""}
                </div>
              </div>
              <div style={{ fontSize: 10, color: "#4caf50", background: "#e8f5e9", borderRadius: 4, padding: "2px 6px" }}>已確認</div>
            </div>
          ))
        }
      </div>

      {IS_MANAGER(emp?.role) && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#333" }}>➕ 新增預排假（管理）</div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 3 }}>員工</label>
            <select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
              style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }}>
              <option value="">選擇員工</option>
              {employees.filter(e => e.is_active).map(e => (
                <option key={e.id} value={e.id}>{e.name} · {e.stores?.name || "總部"}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 3 }}>假別</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
              {LEAVE_TYPES.map(t => (
                <button key={t.k} onClick={() => setForm(f => ({ ...f, leave_type: t.k }))}
                  style={{ padding: "8px 4px", borderRadius: 6, border: form.leave_type === t.k ? "2px solid #3f51b5" : "1px solid #ddd", background: form.leave_type === t.k ? "#e8eaf6" : "#fff", cursor: "pointer", fontSize: 11, fontWeight: form.leave_type === t.k ? 600 : 400 }}>
                  {t.l}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 3 }}>開始日期</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value, end_date: e.target.value }))}
                style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 3 }}>結束日期</label>
              <input type="date" value={form.end_date} min={form.start_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13, boxSizing: "border-box" }} />
            </div>
          </div>

          {msg && <div style={{ fontSize: 12, color: msg.startsWith("✅") ? "#0a7c42" : "#b91c1c", marginBottom: 8 }}>{msg}</div>}

          <button onClick={submit} disabled={submitting}
            style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", background: submitting ? "#ccc" : "#3f51b5", color: "#fff", fontSize: 14, fontWeight: 600, cursor: submitting ? "default" : "pointer" }}>
            {submitting ? "儲存中..." : "📆 建立預排假"}
          </button>
        </div>
      )}

      <div style={{ marginTop: 8, textAlign: "center" }}>
        <a href={`/me?eid=${eid}`} style={{ fontSize: 12, color: "#3f51b5" }}>← 回面板</a>
      </div>
    </div>
  );
}
