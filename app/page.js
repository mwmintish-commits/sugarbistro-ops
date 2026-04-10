"use client";
import { useState, useEffect, useCallback } from "react";
const fmt = (n) => "$" + Number(n || 0).toLocaleString();
const ROLES = { admin: "👑總部", manager: "🏠管理", store_manager: "🏪門店主管", staff: "👤員工" };
const DAYS = ["日", "一", "二", "三", "四", "五", "六"];
const LT = { annual: { l: "特休", c: "#4361ee", bg: "#e6f1fb" }, sick: { l: "病假", c: "#b45309", bg: "#fff8e6" }, personal: { l: "事假", c: "#8a6d00", bg: "#fef9c3" }, menstrual: { l: "生理假", c: "#993556", bg: "#fbeaf0" }, off: { l: "例假", c: "#666", bg: "#f0f0f0" }, rest: { l: "休息日", c: "#888", bg: "#f5f5f5" } };
const ROLE_TABS = { admin: ["schedules", "leaves", "shifts", "attendance", "worklogs", "expenses", "pnl", "announcements", "settings", "settlements", "deposits", "employees"], manager: ["schedules", "leaves", "shifts", "attendance", "worklogs", "expenses", "pnl", "settlements", "deposits", "employees"], store_manager: ["schedules", "shifts", "worklogs"] };
const TAB_L = { schedules: "📅排班", leaves: "🙋請假", shifts: "⏰班別", attendance: "📍出勤", worklogs: "📋日誌", expenses: "📦費用", pnl: "📊損益", announcements: "📢公告", settings: "⚙️設定", settlements: "💰日結", deposits: "🏦存款", employees: "👥員工" };
function ap(u, b) { return b ? fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json()) : fetch(u).then(r => r.json()); }
function Badge({ status }) { const m = { matched: { bg: "#e6f9f0", c: "#0a7c42" }, pending: { bg: "#fff8e6", c: "#8a6d00" }, approved: { bg: "#e6f9f0", c: "#0a7c42" }, rejected: { bg: "#fde8e8", c: "#b91c1c" }, anomaly: { bg: "#fde8e8", c: "#b91c1c" } }; const s = m[status] || { bg: "#f0f0f0", c: "#666" }; return <span style={{ padding: "2px 6px", borderRadius: 8, fontSize: 10, background: s.bg, color: s.c }}>{status}</span>; }
function RB({ role }) { const c = { admin: { bg: "#fde8e8", c: "#b91c1c" }, manager: { bg: "#e6f1fb", c: "#185fa5" }, store_manager: { bg: "#fef9c3", c: "#8a6d00" }, staff: { bg: "#e6f9f0", c: "#0a7c42" } }; const s = c[role] || c.staff; return <span style={{ padding: "1px 5px", borderRadius: 5, fontSize: 9, background: s.bg, color: s.c }}>{ROLES[role] || role}</span>; }
function Row({ l, v }) { return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: 12 }}><span style={{ color: "#888" }}>{l}</span><span>{v || "-"}</span></div>; }
const modal = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 };
const mbox = { background: "#fff", borderRadius: 14, maxWidth: 480, width: "100%", maxHeight: "85vh", overflow: "auto", padding: "20px 18px" };
const sec = { marginBottom: 14, padding: "10px 12px", background: "#faf8f5", borderRadius: 8 };
const sh = { fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#444" };
const inp = { width: "100%", padding: "5px 8px", borderRadius: 5, border: "1px solid #ddd", fontSize: 12 };

const TIERS_R = [[1, "27,470"], [2, "27,471~28,800"], [3, "28,801~30,300"], [4, "30,301~31,800"], [5, "31,801~33,300"], [6, "33,301~34,800"], [7, "34,801~36,300"], [8, "36,301~38,200"], [9, "38,201~40,100"], [10, "40,101~42,000"], [11, "42,001~43,900"], [12, "43,901~45,800"]];
const TIERS_P = [[1, "~11,100"], [2, "11,101~12,540"], [3, "12,541~13,500"], [4, "13,501~15,840"], [5, "15,841~16,500"], [6, "16,501~17,280"], [7, "17,281~17,880"], [8, "17,881~19,047"], [9, "19,048~20,008"], [10, "20,009~21,009"], [11, "21,010~22,000"], [12, "22,001~23,100"]];
function tierLabel(i, r) { return "第" + i + "級（$" + r + "）"; }

function EmpDetail({ empId, onClose }) {
  const [d, setD] = useState(null); const [ld, setLd] = useState(true); const [saving, setSaving] = useState(false); const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ role: "", employment_type: "", labor_tier: "", health_tier: "", labor_start_date: "", health_start_date: "", hourly_rate: "", monthly_salary: "" });
  const reload = () => ap("/api/admin/employees?id=" + empId).then(r => { setD(r); if (r.data) setForm({ role: r.data.role || "staff", employment_type: r.data.employment_type || "regular", labor_tier: r.data.labor_tier || "", health_tier: r.data.health_tier || "", labor_start_date: r.data.labor_start_date || "", health_start_date: r.data.health_start_date || "", hourly_rate: r.data.hourly_rate || "", monthly_salary: r.data.monthly_salary || "" }); setLd(false); });
  useEffect(() => { reload(); }, [empId]);
  const save = async () => { setSaving(true); setMsg(""); await ap("/api/admin/employees", { action: "update", employee_id: empId, role: form.role, employment_type: form.employment_type, labor_tier: form.labor_tier ? Number(form.labor_tier) : null, health_tier: form.health_tier ? Number(form.health_tier) : null, labor_start_date: form.labor_start_date || null, health_start_date: form.health_start_date || null, hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null, monthly_salary: form.monthly_salary ? Number(form.monthly_salary) : null }); setMsg("已儲存"); setSaving(false); reload(); };
  const tiers = form.employment_type === "parttime" ? TIERS_P : TIERS_R;
  if (ld) return <div style={modal}><div style={mbox}><p>載入中...</p></div></div>;
  const e = d.data, li = d.labor_insurance, hi = d.health_insurance;
  return (
    <div style={modal} onClick={onClose}><div style={mbox} onClick={ev => ev.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>{"👤 " + e.name}</h2>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer" }}>✕</button>
      </div>
      <div style={sec}><h4 style={sh}>基本資料</h4>
        <Row l="門市" v={e.stores ? e.stores.name : "總部"} /><Row l="手機" v={e.phone} /><Row l="Email" v={e.email} />
        <Row l="生日" v={e.birthday} /><Row l="身分證" v={e.id_number} />
        <Row l="LINE" v={e.line_uid ? "✅已綁定" : "未綁定"} /><Row l="帳號" v={e.is_active ? "✅啟用" : "⏳待啟用"} />
      </div>
      <div style={sec}><h4 style={sh}>在職資訊</h4>
        <Row l="到職日" v={e.hire_date || "未設定"} /><Row l="年資" v={(d.service_months || 0) + "個月"} /><Row l="特休" v={(d.annual_leave_days || 0) + "天"} />
        <Row l="合約" v={e.contract_signed ? "✅已簽" : "❌未簽"} />
      </div>
      <div style={{ ...sec, border: "2px solid #4361ee" }}><h4 style={{ ...sh, color: "#4361ee" }}>{"✏️ 角色權限"}</h4>
        <select value={form.role} onChange={ev => setForm({ ...form, role: ev.target.value })} style={inp}>
          <option value="staff">{"👤員工"}</option><option value="store_manager">{"🏪門店主管"}</option><option value="manager">{"🏠管理"}</option><option value="admin">{"👑總部"}</option>
        </select>
        <div style={{ marginTop: 4 }}><label style={{ fontSize: 10, color: "#888" }}>投保類型</label>
          <select value={form.employment_type} onChange={ev => setForm({ ...form, employment_type: ev.target.value, labor_tier: "", health_tier: "" })} style={inp}><option value="regular">一般</option><option value="parttime">兼職</option></select>
        </div>
      </div>
      <div style={{ ...sec, border: "2px solid #b45309" }}><h4 style={{ ...sh, color: "#b45309" }}>{"🛡️ 勞保設定"}</h4>
        <label style={{ fontSize: 10, color: "#888" }}>勞保級距</label>
        <select value={form.labor_tier} onChange={ev => setForm({ ...form, labor_tier: ev.target.value })} style={inp}>
          <option value="">未設定</option>{tiers.map(([i, r]) => <option key={i} value={i}>{tierLabel(i, r)}</option>)}
        </select>
        <div style={{ marginTop: 4 }}><label style={{ fontSize: 10, color: "#888" }}>勞保加保日期</label><input type="date" value={form.labor_start_date} onChange={ev => setForm({ ...form, labor_start_date: ev.target.value })} style={inp} /></div>
        {li && <div style={{ marginTop: 6, padding: 6, background: "#fff8e6", borderRadius: 4, fontSize: 11 }}>{"投保薪資：" + fmt(li.insured_salary) + "｜自付：" + fmt(li.labor_self) + "/月｜雇主：" + fmt(li.labor_employer) + "/月"}</div>}
      </div>
      <div style={{ ...sec, border: "2px solid #0a7c42" }}><h4 style={{ ...sh, color: "#0a7c42" }}>{"🏥 健保設定"}</h4>
        <label style={{ fontSize: 10, color: "#888" }}>健保級距</label>
        <select value={form.health_tier} onChange={ev => setForm({ ...form, health_tier: ev.target.value })} style={inp}>
          <option value="">未設定</option>{tiers.map(([i, r]) => <option key={i} value={i}>{tierLabel(i, r)}</option>)}
        </select>
        <div style={{ marginTop: 4 }}><label style={{ fontSize: 10, color: "#888" }}>健保加保日期</label><input type="date" value={form.health_start_date} onChange={ev => setForm({ ...form, health_start_date: ev.target.value })} style={inp} /></div>
        {hi && <div style={{ marginTop: 6, padding: 6, background: "#e6f9f0", borderRadius: 4, fontSize: 11 }}>{"投保薪資：" + fmt(hi.insured_salary) + "｜自付：" + fmt(hi.health_self) + "/月｜雇主：" + fmt(hi.health_employer) + "/月"}</div>}
      </div>
      <div style={{ ...sec, border: "2px solid #666" }}><h4 style={{ ...sh, color: "#666" }}>{"💰 薪資設定"}</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <div><label style={{ fontSize: 10, color: "#888" }}>月薪</label><input type="number" value={form.monthly_salary} onChange={ev => setForm({ ...form, monthly_salary: ev.target.value })} style={inp} /></div>
          <div><label style={{ fontSize: 10, color: "#888" }}>時薪</label><input type="number" value={form.hourly_rate} onChange={ev => setForm({ ...form, hourly_rate: ev.target.value })} style={inp} /></div>
        </div>
        {(li || hi) && <div style={{ marginTop: 6, padding: 6, background: "#f0f0f0", borderRadius: 4, fontSize: 11 }}>{"每月扣除：勞保 " + fmt(li ? li.labor_self : 0) + " + 健保 " + fmt(hi ? hi.health_self : 0) + " = " + fmt((li ? li.labor_self : 0) + (hi ? hi.health_self : 0))}</div>}
      </div>
      <button onClick={save} disabled={saving} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: saving ? "#ccc" : "#0a7c42", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{saving ? "儲存中..." : "💾 儲存所有變更"}</button>
      {msg && <p style={{ textAlign: "center", fontSize: 12, color: "#0a7c42", marginTop: 4 }}>{msg}</p>}
    </div></div>
  );
}

function LoginPage({ onLogin }) {
  const [step, setStep] = useState("phone"); const [phone, setPhone] = useState(""); const [code, setCode] = useState(""); const [msg, setMsg] = useState(""); const [ld, setLd] = useState(false);
  const send = async () => { setLd(true); setMsg(""); const r = await ap("/api/auth", { action: "send_code", phone }); setLd(false); if (r.success) { setStep("code"); setMsg("✅ 驗證碼已發送到LINE"); } else setMsg("❌ " + r.error); };
  const verify = async () => { setLd(true); setMsg(""); const r = await ap("/api/auth", { action: "verify", phone, code }); setLd(false); if (r.success) { localStorage.setItem("admin_token", r.token); onLogin(r); } else setMsg("❌ " + r.error); };
  return (<div style={{ minHeight: "100vh", background: "#faf8f5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,sans-serif" }}><div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e8e6e1", padding: "36px 28px", maxWidth: 340, width: "100%", textAlign: "center" }}>
    <div style={{ fontSize: 32, marginBottom: 10 }}>{"🍯"}</div><h1 style={{ fontSize: 17, fontWeight: 600, marginBottom: 20 }}>小食糖管理後台</h1>
    {step === "phone" && <div><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="手機號碼" style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 15, textAlign: "center", marginBottom: 10 }} onKeyDown={e => e.key === "Enter" && send()} /><button onClick={send} disabled={!phone || ld} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: phone && !ld ? "#1a1a1a" : "#ccc", color: "#fff", fontSize: 14, cursor: "pointer" }}>{ld ? "..." : "發送驗證碼"}</button></div>}
    {step === "code" && <div><input value={code} onChange={e => setCode(e.target.value)} placeholder="6位驗證碼" maxLength={6} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 20, textAlign: "center", letterSpacing: 6, marginBottom: 10 }} onKeyDown={e => e.key === "Enter" && verify()} /><button onClick={verify} disabled={code.length !== 6 || ld} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: code.length === 6 && !ld ? "#0a7c42" : "#ccc", color: "#fff", fontSize: 14, cursor: "pointer" }}>{ld ? "..." : "登入"}</button></div>}
    {msg && <p style={{ marginTop: 8, fontSize: 12, color: msg.startsWith("✅") ? "#0a7c42" : "#b91c1c" }}>{msg}</p>}
  </div></div>);
}

export default function Admin() {
  const [auth, setAuth] = useState(null); const [ck, setCk] = useState(true);
  useEffect(() => { const t = localStorage.getItem("admin_token"); if (!t) { setCk(false); return; } fetch("/api/auth", { headers: { "x-admin-token": t } }).then(r => r.json()).then(d => { if (d.authenticated) setAuth({ token: t, ...d }); else localStorage.removeItem("admin_token"); setCk(false); }).catch(() => setCk(false)); }, []);
  if (ck) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#faf8f5" }}>載入中...</div>;
  if (!auth) return <LoginPage onLogin={d => setAuth({ token: d.token, ...d })} />;
  return <Dashboard auth={auth} onLogout={() => { localStorage.removeItem("admin_token"); setAuth(null); }} />;
}

function Dashboard({ auth, onLogout }) {
  const myTabs = ROLE_TABS[auth.role] || ROLE_TABS.store_manager;
  const [tab, setTab] = useState(myTabs[0]); const [stores, setStores] = useState([]); const [sf, setSf] = useState(auth.role === "store_manager" ? auth.store_id || "" : "");
  const [month, setMonth] = useState(() => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); });
  const [sv, setSv] = useState("week"); const [stl, setStl] = useState([]); const [sum, setSum] = useState({}); const [dep, setDep] = useState([]);
  const [emps, setEmps] = useState([]); const [shifts, setShifts] = useState([]); const [scheds, setScheds] = useState([]);
  const [att, setAtt] = useState([]); const [as2, setAs2] = useState({}); const [lr, setLr] = useState([]); const [ld, setLd] = useState(false);
  const [si, setSi] = useState(null); const [saf, setSaf] = useState(false); const [ne, setNe] = useState({ name: "", store_id: "", role: "staff", phone: "", email: "", employment_type: "regular" });
  const [nbc, setNbc] = useState(null); const [ssf, setSsf] = useState(false); const [es, setEs] = useState(null);
  const [sf2, setSf2] = useState({ store_id: "", name: "", start_time: "10:00", end_time: "20:00", break_minutes: 60, work_hours: 9, role: "all" });
  const [ws, setWs] = useState(() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d.toLocaleDateString("sv-SE"); });
  const [pm, setPm] = useState(null); const [detailId, setDetailId] = useState(null);
  const [exps, setExps] = useState([]); const [expSum, setExpSum] = useState({}); const [pnl, setPnl] = useState(null);
  const [anns, setAnns] = useState([]); const [newAnn, setNewAnn] = useState({ title: "", content: "", priority: "normal", store_id: "" }); const [showAnnForm, setShowAnnForm] = useState(false);
  const [wlogs, setWlogs] = useState([]); const [wltemplates, setWltemplates] = useState([]); const [showWlForm, setShowWlForm] = useState(false);
  const [newWl, setNewWl] = useState({ store_id: "", category: "開店準備", item: "", role: "all", shift_type: "opening", sort_order: 0 });

  useEffect(() => { ap("/api/admin/stores").then(d => setStores(d.data || [])); }, []);
  const load = useCallback(() => {
    setLd(true); const p = new URLSearchParams(); if (month) p.set("month", month); if (sf) p.set("store_id", sf);
    const we2 = new Date(new Date(ws).getTime() + 6 * 86400000).toLocaleDateString("sv-SE");
    const sp = sv === "week" ? "week_start=" + ws + "&week_end=" + we2 + (sf ? "&store_id=" + sf : "") : "month=" + month + (sf ? "&store_id=" + sf : "");
    Promise.all([
      myTabs.includes("settlements") ? ap("/api/admin/settlements?" + p) : Promise.resolve({ data: [], summary: {} }),
      myTabs.includes("deposits") ? ap("/api/admin/deposits?" + p) : Promise.resolve({ data: [] }),
      ap("/api/admin/employees"), ap("/api/admin/shifts" + (sf ? "?store_id=" + sf : "")), ap("/api/admin/schedules?" + sp),
      myTabs.includes("attendance") ? ap("/api/admin/attendance?type=records&" + p) : Promise.resolve({ data: [] }),
      myTabs.includes("settings") ? ap("/api/admin/attendance?type=settings") : Promise.resolve({ data: {} }),
      myTabs.includes("leaves") ? ap("/api/admin/leaves?" + p) : Promise.resolve({ data: [] }),
      myTabs.includes("expenses") ? ap("/api/admin/expenses?month=" + month + (sf ? "&store_id=" + sf : "")) : Promise.resolve({ data: [], total: 0, byCategory: {} }),
      myTabs.includes("pnl") ? ap("/api/admin/pnl?month=" + month + (sf ? "&store_id=" + sf : "")) : Promise.resolve(null),
      myTabs.includes("announcements") ? ap("/api/admin/announcements") : Promise.resolve({ data: [] }),
      myTabs.includes("worklogs") ? ap("/api/admin/worklogs?month=" + month + (sf ? "&store_id=" + sf : "")) : Promise.resolve({ data: [] }),
      myTabs.includes("worklogs") ? ap("/api/admin/worklogs?type=templates" + (sf ? "&store_id=" + sf : "")) : Promise.resolve({ data: [] }),
    ]).then(([s, d, e, shs, sc, at2, as3, lr2, ex, pl2, an, wl, wlt]) => { setStl(s.data || []); setSum(s.summary || {}); setDep(d.data || []); setEmps(e.data || []); setShifts(shs.data || []); setScheds(sc.data || []); setAtt(at2.data || []); setAs2(as3.data || {}); setLr(lr2.data || []); setExps(ex.data || []); setExpSum({ total: ex.total, byCategory: ex.byCategory }); setPnl(pl2); setAnns(an.data || []); setWlogs(wl.data || []); setWltemplates(wlt.data || []); setLd(false); });
  }, [month, sf, ws, sv, myTabs]);
  useEffect(() => { load(); }, [load]);

  const addEmp = async () => { const d = await ap("/api/admin/employees", { action: "create", ...ne }); if (d.bind_code) { setNbc(d.bind_code); load(); } };
  const activate = async (id) => { const d = await ap("/api/admin/employees", { action: "activate", employee_id: id }); if (d.bind_code) alert("已啟用！綁定碼：" + d.bind_code); load(); };
  const deactivate = async (id) => { if (confirm("確定停用？")) { await ap("/api/admin/employees", { action: "deactivate", employee_id: id }); load(); } };
  const regen = async (id) => { const d = await ap("/api/admin/employees", { action: "generate_bind_code", employee_id: id }); if (d.bind_code) alert("綁定碼：" + d.bind_code); load(); };
  const saveShift = async () => { if (es) await ap("/api/admin/shifts", { action: "update", shift_id: es, ...sf2 }); else await ap("/api/admin/shifts", { action: "create", ...sf2 }); setSsf(false); setEs(null); load(); };
  const delShift = async (id) => { if (confirm("刪除？")) { await ap("/api/admin/shifts", { action: "delete", shift_id: id }); load(); } };
  const editShift = (s) => { setEs(s.id); setSf2({ store_id: s.store_id, name: s.name, start_time: s.start_time, end_time: s.end_time, break_minutes: s.break_minutes, work_hours: s.work_hours, role: s.role }); setSsf(true); };
  const addSch = async (eid, sid, date) => { const s = shifts.find(x => x.id === sid); await ap("/api/admin/schedules", { action: "create", employee_id: eid, store_id: s ? s.store_id : sf, shift_id: sid, date }); load(); };
  const addLv = async (eid, date, lt) => { await ap("/api/admin/schedules", { action: "add_leave", employee_id: eid, date, leave_type: lt }); load(); };
  const delSch = async (id) => { await ap("/api/admin/schedules", { action: "delete", schedule_id: id }); load(); };
  const pub = async () => { const we2 = new Date(new Date(ws).getTime() + 6 * 86400000).toLocaleDateString("sv-SE"); const d = await ap("/api/admin/schedules", { action: "publish", week_start: ws, week_end: we2, store_id: sf || undefined }); setPm("發布" + (d.published || 0) + "筆"); setTimeout(() => setPm(null), 4000); load(); };
  const rvLv = async (id, st) => { await ap("/api/admin/leaves", { action: "review", request_id: id, status: st }); load(); };
  const upS = (k, v) => { setAs2({ ...as2, [k]: v }); clearTimeout(window._st); window._st = setTimeout(() => ap("/api/admin/attendance", { action: "update_settings", [k]: v }), 1000); };
  const rvExp = async (id, st) => { await ap("/api/admin/expenses", { action: "review", expense_id: id, status: st }); load(); };
  const addAnn = async () => { await ap("/api/admin/announcements", { action: "create", ...newAnn, created_by: auth.employee_id }); setShowAnnForm(false); setNewAnn({ title: "", content: "", priority: "normal", store_id: "" }); load(); };
  const delAnn = async (id) => { if (confirm("刪除？")) { await ap("/api/admin/announcements", { action: "delete", announcement_id: id }); load(); } };
  const addWlTemplate = async () => { if (!newWl.item || !newWl.store_id) return; await ap("/api/admin/worklogs", { action: "add_template", ...newWl }); setNewWl({ ...newWl, item: "" }); load(); };
  const delWlTemplate = async (id) => { await ap("/api/admin/worklogs", { action: "delete_template", template_id: id }); load(); };
  const [copyFrom, setCopyFrom] = useState(""); const [copyTo, setCopyTo] = useState("");
  const copyTemplates = async () => { if (!copyFrom || !copyTo || copyFrom === copyTo) return; const d = await ap("/api/admin/worklogs", { action: "copy_to_store", from_store_id: copyFrom, to_store_id: copyTo }); alert("已複製 " + (d.count || 0) + " 個項目"); load(); };

  const wd = Array.from({ length: 7 }, (_, i) => new Date(new Date(ws).getTime() + i * 86400000).toLocaleDateString("sv-SE"));
  const prevW = () => setWs(new Date(new Date(ws).getTime() - 7 * 86400000).toLocaleDateString("sv-SE"));
  const nextW = () => setWs(new Date(new Date(ws).getTime() + 7 * 86400000).toLocaleDateString("sv-SE"));
  const ae = emps.filter(e => e.is_active); const fe = sf ? ae.filter(e => e.store_id === sf) : ae;
  const pendingEmps = emps.filter(e => !e.is_active); const pl = lr.filter(l => l.status === "pending");

  const renderCell = (emp, date) => {
    const sc = scheds.find(s => s.employee_id === emp.id && s.date === date);
    if (sc) {
      if (sc.type === "leave") { const lt = LT[sc.leave_type] || LT.off; return <div style={{ background: lt.bg, borderRadius: 4, padding: "2px 3px", fontSize: 9, position: "relative" }}><div style={{ color: lt.c, fontWeight: 500 }}>{lt.l}</div><button onClick={() => delSch(sc.id)} style={{ position: "absolute", top: 0, right: 1, background: "none", border: "none", cursor: "pointer", fontSize: 8, color: "#ccc" }}>✕</button></div>; }
      return <div style={{ background: sc.published ? "#e6f9f0" : "#fff8e6", borderRadius: 4, padding: "2px 3px", fontSize: 9, position: "relative" }}><div style={{ fontWeight: 500 }}>{sc.shifts ? sc.shifts.name : ""}</div><div style={{ color: "#888" }}>{sc.shifts ? (sc.shifts.start_time || "").slice(0, 5) + "~" + (sc.shifts.end_time || "").slice(0, 5) : ""}</div><button onClick={() => delSch(sc.id)} style={{ position: "absolute", top: 0, right: 1, background: "none", border: "none", cursor: "pointer", fontSize: 8, color: "#ccc" }}>✕</button></div>;
    }
    return <select onChange={e => { const v = e.target.value; e.target.value = ""; if (!v) return; if (v.startsWith("leave:")) addLv(emp.id, date, v.split(":")[1]); else addSch(emp.id, v, date); }} style={{ width: "100%", padding: "1px", borderRadius: 3, border: "1px dashed #ddd", fontSize: 9, color: "#ccc", background: "transparent", cursor: "pointer" }}><option value="">+</option><optgroup label="班別">{shifts.filter(s => !sf || s.store_id === sf).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup><optgroup label="休假">{Object.entries(LT).map(([k, v]) => <option key={k} value={"leave:" + k}>{v.l}</option>)}</optgroup></select>;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f5", fontFamily: "system-ui,'Noto Sans TC',sans-serif" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e6e1", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ fontSize: 18 }}>{"🍯"}</span><span style={{ fontSize: 13, fontWeight: 600 }}>小食糖後台</span><RB role={auth.role} /><span style={{ fontSize: 11, color: "#888" }}>{auth.name}</span></div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ padding: "3px 6px", borderRadius: 5, border: "1px solid #ddd", fontSize: 11 }} />
          {auth.role !== "store_manager" && <select value={sf} onChange={e => setSf(e.target.value)} style={{ padding: "3px 6px", borderRadius: 5, border: "1px solid #ddd", fontSize: 11 }}><option value="">全部門市</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
          <button onClick={onLogout} style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid #ddd", background: "transparent", fontSize: 11, cursor: "pointer", color: "#b91c1c" }}>登出</button>
        </div>
      </div>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 8px" }}>
        <div style={{ display: "flex", gap: 3, marginBottom: 10, overflowX: "auto", paddingBottom: 3 }}>
          {myTabs.map(id => <button key={id} style={{ padding: "5px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11, fontWeight: tab === id ? 600 : 400, background: tab === id ? "#1a1a1a" : "transparent", color: tab === id ? "#fff" : "#888", whiteSpace: "nowrap" }} onClick={() => setTab(id)}>{TAB_L[id]}</button>)}
        </div>
        {ld && <div style={{ textAlign: "center", padding: 30, color: "#aaa" }}>載入中...</div>}

        {!ld && tab === "schedules" && <div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
            <button onClick={() => setSv("week")} style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid #ddd", background: sv === "week" ? "#1a1a1a" : "#fff", color: sv === "week" ? "#fff" : "#666", fontSize: 11, cursor: "pointer" }}>週</button>
            <button onClick={prevW} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: 11 }}>◀</button>
            <span style={{ fontSize: 12, fontWeight: 500 }}>{ws + "~" + wd[6]}</span>
            <button onClick={nextW} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: 11 }}>▶</button>
            <button onClick={pub} style={{ padding: "4px 12px", borderRadius: 5, border: "none", background: "#0a7c42", color: "#fff", cursor: "pointer", fontSize: 11, marginLeft: "auto" }}>{"📢 發布"}</button>
          </div>
          {pm && <div style={{ background: "#e6f9f0", color: "#0a7c42", padding: "4px 10px", borderRadius: 5, fontSize: 11, marginBottom: 6 }}>{pm}</div>}
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, minWidth: 700 }}>
              <thead><tr style={{ background: "#faf8f5", borderBottom: "1px solid #e8e6e1" }}><th style={{ padding: "7px 5px", textAlign: "left", fontWeight: 500, color: "#666", minWidth: 60, position: "sticky", left: 0, background: "#faf8f5", zIndex: 1 }}>員工</th>{wd.map((d, i) => <th key={d} style={{ padding: "7px 3px", textAlign: "center", fontWeight: 500, color: i === 0 || i === 6 ? "#b91c1c" : "#666", minWidth: 85 }}>{d.slice(5) + "(" + DAYS[new Date(d).getDay()] + ")"}</th>)}</tr></thead>
              <tbody>{fe.map(emp => <tr key={emp.id} style={{ borderBottom: "1px solid #f0eeea" }}><td style={{ padding: "5px", fontWeight: 500, fontSize: 11, position: "sticky", left: 0, background: "#fff", zIndex: 1 }}>{emp.name}<br /><RB role={emp.role} /></td>{wd.map(date => <td key={date} style={{ padding: "2px", textAlign: "center", verticalAlign: "top" }}>{renderCell(emp, date)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </div>}

        {!ld && tab === "leaves" && <div>
          {pl.length > 0 && <div style={{ background: "#fff8e6", borderRadius: 8, padding: 10, marginBottom: 10 }}><h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{"⏳ 待審核（" + pl.length + "）"}</h3>{pl.map(l => <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 0", borderBottom: "1px solid #f0eeea", flexWrap: "wrap", fontSize: 12 }}><b>{l.employees ? l.employees.name : ""}</b><span>{l.start_date}</span><div style={{ marginLeft: "auto", display: "flex", gap: 3 }}><button onClick={() => rvLv(l.id, "approved")} style={{ padding: "3px 8px", borderRadius: 4, border: "none", background: "#0a7c42", color: "#fff", fontSize: 10, cursor: "pointer" }}>✅</button><button onClick={() => rvLv(l.id, "rejected")} style={{ padding: "3px 8px", borderRadius: 4, border: "none", background: "#b91c1c", color: "#fff", fontSize: 10, cursor: "pointer" }}>❌</button></div></div>)}</div>}
        </div>}

        {!ld && tab === "shifts" && <div>
          <button onClick={() => { setSsf(!ssf); setEs(null); }} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #ddd", background: ssf ? "#f0f0f0" : "#1a1a1a", color: ssf ? "#666" : "#fff", fontSize: 11, cursor: "pointer", marginBottom: 8 }}>{ssf ? "✕" : "＋"}</button>
          {ssf && <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 8 }}><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
            <div><label style={{ fontSize: 10, color: "#888" }}>門市</label><select value={sf2.store_id} onChange={e => setSf2({ ...sf2, store_id: e.target.value })} style={{ width: "100%", padding: "4px", borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}><option value="">選擇</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label style={{ fontSize: 10, color: "#888" }}>名稱</label><input value={sf2.name} onChange={e => setSf2({ ...sf2, name: e.target.value })} style={{ width: "100%", padding: "4px", borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }} /></div>
            <div><label style={{ fontSize: 10, color: "#888" }}>上班</label><input type="time" value={sf2.start_time} onChange={e => setSf2({ ...sf2, start_time: e.target.value })} style={{ width: "100%", padding: "4px", borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }} /></div>
            <div><label style={{ fontSize: 10, color: "#888" }}>下班</label><input type="time" value={sf2.end_time} onChange={e => setSf2({ ...sf2, end_time: e.target.value })} style={{ width: "100%", padding: "4px", borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }} /></div>
            <div><label style={{ fontSize: 10, color: "#888" }}>休息(分)</label><input type="number" value={sf2.break_minutes} onChange={e => setSf2({ ...sf2, break_minutes: Number(e.target.value) })} style={{ width: "100%", padding: "4px", borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }} /></div>
          </div><button onClick={saveShift} style={{ padding: "4px 14px", borderRadius: 4, border: "none", background: "#0a7c42", color: "#fff", fontSize: 11, cursor: "pointer" }}>{es ? "💾" : "建立"}</button></div>}
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#faf8f5" }}>{["門市", "班別", "時間", "休息", "操作"].map(h => <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}</tr></thead><tbody>{shifts.map(s => <tr key={s.id} style={{ borderBottom: "1px solid #f0eeea" }}><td style={{ padding: 6 }}>{s.stores ? s.stores.name : ""}</td><td style={{ padding: 6, fontWeight: 500 }}>{s.name}</td><td style={{ padding: 6 }}>{(s.start_time || "").slice(0, 5) + "~" + (s.end_time || "").slice(0, 5)}</td><td style={{ padding: 6 }}>{s.break_minutes + "分"}</td><td style={{ padding: 6 }}><button onClick={() => editShift(s)} style={{ padding: "1px 5px", borderRadius: 3, border: "1px solid #ddd", background: "transparent", cursor: "pointer", fontSize: 10, marginRight: 2 }}>✏️</button><button onClick={() => delShift(s.id)} style={{ padding: "1px 5px", borderRadius: 3, border: "1px solid #ddd", background: "transparent", cursor: "pointer", fontSize: 10, color: "#b91c1c" }}>🗑</button></td></tr>)}</tbody></table></div>
        </div>}

        {!ld && tab === "attendance" && <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#faf8f5" }}>{["時間", "員工", "門市", "類型", "距離", "遲到"].map(h => <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}</tr></thead><tbody>{att.map(a => <tr key={a.id} style={{ borderBottom: "1px solid #f0eeea" }}><td style={{ padding: 6, fontSize: 10 }}>{new Date(a.timestamp).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</td><td style={{ padding: 6, fontWeight: 500 }}>{a.employees ? a.employees.name : ""}</td><td style={{ padding: 6 }}>{a.stores ? a.stores.name : ""}</td><td style={{ padding: 6 }}>{a.type === "clock_in" ? "🟢上班" : "🔴下班"}</td><td style={{ padding: 6 }}>{a.distance_meters ? Math.round(a.distance_meters) + "m" : "-"}</td><td style={{ padding: 6, color: a.late_minutes > 0 ? "#b91c1c" : "#0a7c42" }}>{a.late_minutes > 0 ? a.late_minutes + "分" : "準時"}</td></tr>)}</tbody></table></div>}

        {!ld && tab === "worklogs" && <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{"📋 工作日誌模板管理"}</h3>
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
              <div><label style={{ fontSize: 10, color: "#888" }}>門市*</label><select value={newWl.store_id} onChange={e => setNewWl({ ...newWl, store_id: e.target.value })} style={{ width: "100%", padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}><option value="">選擇</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label style={{ fontSize: 10, color: "#888" }}>分類</label><select value={newWl.category} onChange={e => setNewWl({ ...newWl, category: e.target.value })} style={{ width: "100%", padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}><option>開店準備</option><option>營業中</option><option>打烊作業</option><option>清潔消毒</option><option>食材管理</option></select></div>
              <div><label style={{ fontSize: 10, color: "#888" }}>角色</label><select value={newWl.role} onChange={e => setNewWl({ ...newWl, role: e.target.value })} style={{ width: "100%", padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}><option value="all">全員</option><option value="吧台">吧台</option><option value="內場">內場</option><option value="烘焙">烘焙</option><option value="外場">外場</option></select></div>
              <div><label style={{ fontSize: 10, color: "#888" }}>時段</label><select value={newWl.shift_type} onChange={e => setNewWl({ ...newWl, shift_type: e.target.value })} style={{ width: "100%", padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}><option value="opening">開店</option><option value="during">營業中</option><option value="closing">打烊</option></select></div>
              <div style={{ gridColumn: "span 2" }}><label style={{ fontSize: 10, color: "#888" }}>工作項目*</label><input value={newWl.item} onChange={e => setNewWl({ ...newWl, item: e.target.value })} placeholder="例：確認冷藏冷凍溫度" style={{ width: "100%", padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }} /></div>
            </div>
            <button onClick={addWlTemplate} disabled={!newWl.item || !newWl.store_id} style={{ padding: "4px 14px", borderRadius: 4, border: "none", background: newWl.item && newWl.store_id ? "#0a7c42" : "#ccc", color: "#fff", fontSize: 11, cursor: "pointer" }}>新增</button>
          </div>
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 10 }}>
            <h4 style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>{"📋 複製工作項目到其他門市"}</h4>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <select value={copyFrom} onChange={e => setCopyFrom(e.target.value)} style={{ flex: 1, padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}><option value="">來源門市</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <span style={{ fontSize: 12 }}>{"→"}</span>
              <select value={copyTo} onChange={e => setCopyTo(e.target.value)} style={{ flex: 1, padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}><option value="">目標門市</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <button onClick={copyTemplates} disabled={!copyFrom || !copyTo || copyFrom === copyTo} style={{ padding: "4px 12px", borderRadius: 4, border: "none", background: copyFrom && copyTo && copyFrom !== copyTo ? "#4361ee" : "#ccc", color: "#fff", fontSize: 11, cursor: "pointer" }}>複製</button>
            </div>
          </div>
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto", marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#faf8f5" }}>{["門市", "分類", "角色", "時段", "項目", ""].map(h => <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}</tr></thead>
              <tbody>{wltemplates.length === 0 ? <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "#ccc" }}>尚無項目</td></tr> : wltemplates.map(t => <tr key={t.id} style={{ borderBottom: "1px solid #f0eeea" }}><td style={{ padding: 6 }}>{stores.find(s => s.id === t.store_id) ? stores.find(s => s.id === t.store_id).name : "-"}</td><td style={{ padding: 6, fontWeight: 500 }}>{t.category}</td><td style={{ padding: 6 }}>{t.role === "all" ? "全員" : t.role}</td><td style={{ padding: 6 }}>{t.shift_type === "closing" ? "打烊" : t.shift_type === "during" ? "營業" : "開店"}</td><td style={{ padding: 6 }}>{t.item}</td><td style={{ padding: 4 }}><button onClick={() => delWlTemplate(t.id)} style={{ padding: "1px 5px", borderRadius: 3, border: "1px solid #ddd", background: "transparent", cursor: "pointer", fontSize: 9, color: "#b91c1c" }}>🗑</button></td></tr>)}</tbody></table>
          </div>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{"📝 員工提交紀錄"}</h3>
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#faf8f5" }}>{["日期", "員工", "門市", "完成", "備註"].map(h => <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}</tr></thead>
              <tbody>{wlogs.length === 0 ? <tr><td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#ccc" }}>本月無紀錄</td></tr> : wlogs.map(l => <tr key={l.id} style={{ borderBottom: "1px solid #f0eeea" }}><td style={{ padding: 6 }}>{l.date}</td><td style={{ padding: 6, fontWeight: 500 }}>{l.employees ? l.employees.name : ""}</td><td style={{ padding: 6 }}>{l.stores ? l.stores.name : ""}</td><td style={{ padding: 6 }}>{(l.items || []).length + "項"}</td><td style={{ padding: 6, fontSize: 10, color: "#888" }}>{l.notes || "-"}</td></tr>)}</tbody></table>
          </div>
        </div>}

        {!ld && tab === "expenses" && <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}><div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: "8px 12px", flex: 1 }}><div style={{ fontSize: 10, color: "#888" }}>本月費用</div><div style={{ fontSize: 16, fontWeight: 600, color: "#b91c1c" }}>{fmt(expSum.total)}</div></div></div>
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#faf8f5" }}>{["日期", "門市", "類型", "廠商", "金額", "狀態", "操作"].map(h => <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}</tr></thead><tbody>{exps.length === 0 && <tr><td colSpan={7} style={{ padding: 30, textAlign: "center", color: "#ccc" }}>無紀錄</td></tr>}{exps.map(e => <tr key={e.id} style={{ borderBottom: "1px solid #f0eeea" }}><td style={{ padding: 6 }}>{e.date}</td><td style={{ padding: 6 }}>{e.stores ? e.stores.name : ""}</td><td style={{ padding: 6 }}>{e.expense_type === "vendor" ? "廠商" : "零用金"}</td><td style={{ padding: 6, fontWeight: 500 }}>{e.vendor_name || "-"}</td><td style={{ padding: 6, fontWeight: 600 }}>{fmt(e.amount)}</td><td style={{ padding: 6 }}><Badge status={e.status} /></td><td style={{ padding: 6 }}>{e.status === "pending" && <span><button onClick={() => rvExp(e.id, "approved")} style={{ padding: "1px 6px", borderRadius: 3, border: "none", background: "#0a7c42", color: "#fff", fontSize: 9, cursor: "pointer", marginRight: 2 }}>✅</button><button onClick={() => rvExp(e.id, "rejected")} style={{ padding: "1px 6px", borderRadius: 3, border: "none", background: "#b91c1c", color: "#fff", fontSize: 9, cursor: "pointer" }}>❌</button></span>}</td></tr>)}</tbody></table></div>
        </div>}

        {!ld && tab === "pnl" && pnl && <div style={{ maxWidth: 500 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{"📊 " + month + " 損益表"}</h3>
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 14, marginBottom: 10 }}>
            <h4 style={{ fontSize: 13, color: "#0a7c42", marginBottom: 8 }}>收入</h4>
            <Row l="營業收入" v={<b style={{ color: "#0a7c42" }}>{fmt(pnl.revenue ? pnl.revenue.total : 0)}</b>} />
          </div>
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 14, marginBottom: 10 }}>
            <h4 style={{ fontSize: 13, color: "#b91c1c", marginBottom: 8 }}>支出</h4>
            <Row l="月結廠商" v={fmt(pnl.expenses ? pnl.expenses.vendor : 0)} /><Row l="零用金" v={fmt(pnl.expenses ? pnl.expenses.petty_cash : 0)} /><Row l="人事成本" v={fmt(pnl.expenses ? pnl.expenses.labor : 0)} />
            <Row l="支出合計" v={<b style={{ color: "#b91c1c" }}>{fmt(pnl.expenses ? pnl.expenses.total : 0)}</b>} />
          </div>
          <div style={{ background: (pnl.profit ? pnl.profit.net : 0) >= 0 ? "#e6f9f0" : "#fde8e8", borderRadius: 8, padding: 14 }}>
            <Row l="淨利" v={<b style={{ fontSize: 18, color: (pnl.profit ? pnl.profit.net : 0) >= 0 ? "#0a7c42" : "#b91c1c" }}>{fmt(pnl.profit ? pnl.profit.net : 0)}</b>} />
            <Row l="利潤率" v={(pnl.profit ? pnl.profit.margin : 0) + "%"} />
          </div>
        </div>}

        {!ld && tab === "announcements" && <div>
          <button onClick={() => setShowAnnForm(!showAnnForm)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #ddd", background: showAnnForm ? "#f0f0f0" : "#1a1a1a", color: showAnnForm ? "#666" : "#fff", fontSize: 11, cursor: "pointer", marginBottom: 8 }}>{showAnnForm ? "✕" : "＋新增公告"}</button>
          {showAnnForm && <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 8 }}>
            <div style={{ marginBottom: 6 }}><label style={{ fontSize: 10, color: "#888" }}>標題*</label><input value={newAnn.title} onChange={e => setNewAnn({ ...newAnn, title: e.target.value })} style={{ width: "100%", padding: 5, borderRadius: 4, border: "1px solid #ddd", fontSize: 12 }} /></div>
            <div style={{ marginBottom: 6 }}><label style={{ fontSize: 10, color: "#888" }}>內容*</label><textarea value={newAnn.content} onChange={e => setNewAnn({ ...newAnn, content: e.target.value })} rows={3} style={{ width: "100%", padding: 5, borderRadius: 4, border: "1px solid #ddd", fontSize: 12 }} /></div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <div style={{ flex: 1 }}><label style={{ fontSize: 10, color: "#888" }}>門市</label><select value={newAnn.store_id} onChange={e => setNewAnn({ ...newAnn, store_id: e.target.value })} style={{ width: "100%", padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}><option value="">全部</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div style={{ flex: 1 }}><label style={{ fontSize: 10, color: "#888" }}>優先級</label><select value={newAnn.priority} onChange={e => setNewAnn({ ...newAnn, priority: e.target.value })} style={{ width: "100%", padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}><option value="normal">一般</option><option value="urgent">急件</option></select></div>
            </div>
            <button onClick={addAnn} disabled={!newAnn.title || !newAnn.content} style={{ padding: "5px 14px", borderRadius: 4, border: "none", background: newAnn.title && newAnn.content ? "#0a7c42" : "#ccc", color: "#fff", fontSize: 11, cursor: "pointer" }}>發布</button>
          </div>}
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1" }}>{anns.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#ccc" }}>尚無公告</div> : anns.map(a => <div key={a.id} style={{ padding: 10, borderBottom: "1px solid #f0eeea", display: "flex", gap: 8 }}><div style={{ flex: 1 }}><b style={{ fontSize: 13 }}>{a.title}</b><p style={{ fontSize: 12, color: "#555", marginTop: 3 }}>{a.content}</p></div><button onClick={() => delAnn(a.id)} style={{ padding: "2px 6px", borderRadius: 3, border: "1px solid #ddd", background: "transparent", cursor: "pointer", fontSize: 10, color: "#b91c1c" }}>🗑</button></div>)}</div>
        </div>}

        {!ld && tab === "settings" && <div style={{ maxWidth: 400 }}><div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12 }}><h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{"⚙️ 打卡設定"}</h3>{[["late_grace_minutes", "遲到寬限(分)"], ["late_threshold_minutes", "嚴重遲到(分)"], ["early_leave_minutes", "早退(分)"], ["overtime_min_minutes", "加班最低(分)"]].map(([k, l]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #f0eeea" }}><span style={{ fontSize: 12 }}>{l}</span><input type="number" value={as2[k] || ""} onChange={e => upS(k, Number(e.target.value))} style={{ width: 50, padding: 3, borderRadius: 4, border: "1px solid #ddd", textAlign: "center", fontSize: 12 }} /></div>)}</div></div>}

        {!ld && tab === "settlements" && <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}><div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: "8px 12px", flex: 1 }}><div style={{ fontSize: 10, color: "#888" }}>淨額</div><div style={{ fontSize: 16, fontWeight: 600, color: "#0a7c42" }}>{fmt(sum.total_net_sales)}</div></div><div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: "8px 12px", flex: 1 }}><div style={{ fontSize: 10, color: "#888" }}>應存</div><div style={{ fontSize: 16, fontWeight: 600, color: "#b45309" }}>{fmt(sum.total_cash_to_deposit)}</div></div></div>
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#faf8f5" }}>{["日期", "門市", "淨額", "現金", "應存"].map(h => <th key={h} style={{ padding: "6px 4px", textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}</tr></thead><tbody>{stl.map(s => <tr key={s.id} style={{ borderBottom: "1px solid #f0eeea" }}><td style={{ padding: "6px 4px" }}>{s.date}</td><td style={{ padding: "6px 4px", fontWeight: 500 }}>{s.stores ? s.stores.name : ""}</td><td style={{ padding: "6px 4px", color: "#0a7c42", fontWeight: 600 }}>{fmt(s.net_sales)}</td><td style={{ padding: "6px 4px" }}>{fmt(s.cash_amount)}</td><td style={{ padding: "6px 4px", color: "#b45309" }}>{fmt(s.cash_to_deposit)}</td></tr>)}</tbody></table></div>
        </div>}

        {!ld && tab === "deposits" && <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#faf8f5" }}>{["日期", "門市", "金額", "應存", "差異", "狀態"].map(h => <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}</tr></thead><tbody>{dep.map(d => <tr key={d.id} style={{ borderBottom: "1px solid #f0eeea" }}><td style={{ padding: 6 }}>{d.deposit_date}</td><td style={{ padding: 6, fontWeight: 500 }}>{d.stores ? d.stores.name : ""}</td><td style={{ padding: 6, fontWeight: 600 }}>{fmt(d.amount)}</td><td style={{ padding: 6 }}>{fmt(d.expected_cash)}</td><td style={{ padding: 6, color: Math.abs(d.difference) <= 500 ? "#0a7c42" : "#b91c1c" }}>{fmt(d.difference)}</td><td style={{ padding: 6 }}><Badge status={d.status} /></td></tr>)}</tbody></table></div>}

        {!ld && tab === "employees" && <div>
          {pendingEmps.length > 0 && <div style={{ background: "#fff8e6", borderRadius: 8, padding: 10, marginBottom: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{"⏳ 待啟用（" + pendingEmps.length + "）"}</h3>
            {pendingEmps.map(e => <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 0", borderBottom: "1px solid #f0eeea", fontSize: 12, flexWrap: "wrap" }}>
              <b style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => setDetailId(e.id)}>{e.name}</b>
              <span style={{ color: "#888" }}>{e.stores ? e.stores.name : "總部"}</span>
              <span style={{ fontSize: 10 }}>{e.contract_signed ? "📋✅" : "📋❌"}</span>
              <button onClick={() => activate(e.id)} style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 5, border: "none", background: "#0a7c42", color: "#fff", fontSize: 11, cursor: "pointer" }}>✅ 啟用帳號</button>
            </div>)}
          </div>}
          <button onClick={() => { setSaf(!saf); setNbc(null); }} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #ddd", background: saf ? "#f0f0f0" : "#1a1a1a", color: saf ? "#666" : "#fff", fontSize: 11, cursor: "pointer", marginBottom: 8 }}>{saf ? "✕" : "＋新增"}</button>
          {saf && <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 8 }}><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
            <div><label style={{ fontSize: 10, color: "#888" }}>姓名*</label><input value={ne.name} onChange={e => setNe({ ...ne, name: e.target.value })} style={{ width: "100%", padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }} /></div>
            <div><label style={{ fontSize: 10, color: "#888" }}>手機*</label><input value={ne.phone} onChange={e => setNe({ ...ne, phone: e.target.value })} style={{ width: "100%", padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }} /></div>
            <div><label style={{ fontSize: 10, color: "#888" }}>門市</label><select value={ne.store_id} onChange={e => setNe({ ...ne, store_id: e.target.value })} style={{ width: "100%", padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}><option value="">總部</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label style={{ fontSize: 10, color: "#888" }}>角色</label><select value={ne.role} onChange={e => setNe({ ...ne, role: e.target.value })} style={{ width: "100%", padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}><option value="staff">員工</option><option value="store_manager">門店主管</option><option value="manager">管理</option><option value="admin">總部</option></select></div>
          </div><button onClick={addEmp} disabled={!ne.name || !ne.phone} style={{ padding: "4px 14px", borderRadius: 4, border: "none", background: ne.name && ne.phone ? "#0a7c42" : "#ccc", color: "#fff", fontSize: 11, cursor: "pointer" }}>建立</button>{nbc && <div style={{ marginTop: 6, padding: 6, background: "#e6f9f0", borderRadius: 4, fontSize: 11 }}><b style={{ color: "#0a7c42" }}>{"綁定碼：" + nbc}</b></div>}</div>}
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#faf8f5" }}>{["姓名", "角色", "門市", "年資", "特休", "LINE", "操作"].map(h => <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}</tr></thead>
            <tbody>{emps.filter(e => e.is_active).map(e => <tr key={e.id} style={{ borderBottom: "1px solid #f0eeea" }}><td style={{ padding: 6 }}><span style={{ fontWeight: 500, cursor: "pointer", color: "#4361ee", textDecoration: "underline" }} onClick={() => setDetailId(e.id)}>{e.name}</span></td><td style={{ padding: 6 }}><RB role={e.role} /></td><td style={{ padding: 6 }}>{e.stores ? e.stores.name : "總部"}</td><td style={{ padding: 6, fontSize: 10 }}>{(e.service_months || 0) + "月"}</td><td style={{ padding: 6, fontSize: 10 }}>{(e.annual_leave_days || 0) + "天"}</td><td style={{ padding: 6 }}>{e.line_uid ? "✅" : (e.bind_code || "未綁")}</td><td style={{ padding: 6 }}><button onClick={() => deactivate(e.id)} style={{ padding: "1px 5px", borderRadius: 3, border: "1px solid #ddd", background: "transparent", cursor: "pointer", fontSize: 9, color: "#b91c1c" }}>停用</button></td></tr>)}</tbody></table></div>
        </div>}
      </div>

      {detailId && <EmpDetail empId={detailId} onClose={() => { setDetailId(null); load(); }} />}
      {si && <div onClick={() => setSi(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998, cursor: "pointer", padding: 12 }}><img src={si} alt="" style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 8 }} /></div>}
    </div>
  );
}
