"use client";
import { useState, useEffect, useCallback } from "react";
const fmt = (n) => "$" + Number(n || 0).toLocaleString();
const ROLES = { admin: "👑總部", manager: "🏠管理", store_manager: "🏪門店主管", staff: "👤員工" };
const DAYS = ["日", "一", "二", "三", "四", "五", "六"];
const LT = { annual: { l: "特休", c: "#4361ee", bg: "#e6f1fb" }, sick: { l: "病假", c: "#b45309", bg: "#fff8e6" }, personal: { l: "事假", c: "#8a6d00", bg: "#fef9c3" }, menstrual: { l: "生理假", c: "#993556", bg: "#fbeaf0" }, off: { l: "例假", c: "#666", bg: "#f0f0f0" }, rest: { l: "休息日", c: "#888", bg: "#f5f5f5" } };
const ROLE_TABS = { admin: ["dashboard", "employees", "schedules", "leaves", "attendance", "overtime", "payroll", "settlements", "deposits", "expenses", "payments", "pnl", "shifts", "worklogs", "announcements", "settings"], manager: ["employees", "schedules", "leaves", "attendance", "overtime", "payroll", "settlements", "deposits", "expenses", "payments", "pnl", "shifts", "worklogs"], store_manager: ["schedules", "leaves", "store_staff", "shifts", "worklogs", "announcements", "settlements", "deposits", "expenses"] };
const TAB_L = { dashboard: "🏠總覽", employees: "👥員工", schedules: "📅排班", leaves: "🙋請假", attendance: "📍出勤", overtime: "⏱加班", payroll: "💰薪資", settlements: "💰日結", deposits: "🏦存款", expenses: "📦費用", payments: "💳撥款", pnl: "📊損益", shifts: "⏰班別", worklogs: "📋日誌", announcements: "📢公告", settings: "⚙️設定", store_staff: "👥本店員工" };
const TAB_GROUPS = { "總覽": ["dashboard"], "人資": ["employees", "store_staff", "schedules", "leaves", "attendance", "overtime", "payroll"], "財務": ["settlements", "deposits", "expenses", "payments", "pnl"], "管理": ["shifts", "worklogs", "announcements", "settings"] };
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
  const save = async () => { setSaving(true); setMsg(""); 
    const changes = []; const old = d.data;
    if (form.role !== old.role) changes.push({ change_type: "role", old_value: old.role, new_value: form.role });
    if (form.monthly_salary !== String(old.monthly_salary || "")) changes.push({ change_type: "salary", old_value: String(old.monthly_salary || 0), new_value: form.monthly_salary });
    if (form.labor_tier !== String(old.labor_tier || "")) changes.push({ change_type: "labor_tier", old_value: String(old.labor_tier || ""), new_value: form.labor_tier });
    if (form.health_tier !== String(old.health_tier || "")) changes.push({ change_type: "health_tier", old_value: String(old.health_tier || ""), new_value: form.health_tier });
    await ap("/api/admin/employees", { action: "update", employee_id: empId, role: form.role, employment_type: form.employment_type, labor_tier: form.labor_tier ? Number(form.labor_tier) : null, health_tier: form.health_tier ? Number(form.health_tier) : null, labor_start_date: form.labor_start_date || null, health_start_date: form.health_start_date || null, hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null, monthly_salary: form.monthly_salary ? Number(form.monthly_salary) : null }); 
    for (const c of changes) { ap("/api/admin/system", { key: "emp_change_" + empId + "_" + Date.now(), value: { ...c, employee_id: empId, employee_name: old.name, timestamp: new Date().toISOString() } }).catch(() => {}); }
    setMsg("✅ 已儲存"); setSaving(false); reload(); };
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
      <div style={{ marginTop: 10, display: "flex", gap: 4, flexWrap: "wrap" }}>
        <select onChange={async (e) => { if (!e.target.value) return; if (!confirm("確定調到此門市？")) { e.target.value = ""; return; } await ap("/api/admin/employees", { action: "update", employee_id: empId, store_id: e.target.value }); alert("已調店"); e.target.value = ""; reload(); }} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #4361ee", fontSize: 10, color: "#4361ee", cursor: "pointer" }}>
          <option value="">{"🔄 調店..."}</option>
          {(window.__stores || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button onClick={async () => { if (!confirm("確定解除LINE綁定？員工需重新輸入綁定碼")) return; await ap("/api/admin/employees", { action: "update", employee_id: empId, line_uid: null }); const d2 = await ap("/api/admin/employees", { action: "generate_bind_code", employee_id: empId }); alert("已解除，新綁定碼：" + (d2.bind_code || "")); reload(); }} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #b45309", background: "transparent", color: "#b45309", fontSize: 10, cursor: "pointer" }}>{"🔓 解除LINE"}</button>
        <button onClick={async () => { const ph = prompt("輸入新手機號碼："); if (ph) { await ap("/api/admin/employees", { action: "update", employee_id: empId, phone: ph }); alert("已更新"); reload(); } }} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #666", background: "transparent", color: "#666", fontSize: 10, cursor: "pointer" }}>{"📱 換手機"}</button>
        <button onClick={async () => {
          const lastDay = prompt("離職日期（YYYY-MM-DD）：");
          if (!lastDay) return;
          const reason = prompt("離職原因（選填）：") || "";
          const r = await ap("/api/admin/leave-balances?employee_id=" + empId + "&year=" + new Date().getFullYear());
          const remaining = r.data ? r.data.annual_remaining || 0 : 0;
          const emp2 = d.data;
          const dailyPay = emp2.monthly_salary ? Math.round(emp2.monthly_salary / 30) : (emp2.hourly_rate ? emp2.hourly_rate * 8 : 0);
          const settlement = remaining * dailyPay;
          const months = d.service_months || 0;
          const notice = months < 3 ? 0 : months < 12 ? 10 : months < 36 ? 20 : 30;
          if (!confirm(emp2.name + " 離職作業\n\n📅 離職日：" + lastDay + "\n📋 原因：" + (reason || "無") + "\n⏰ 法定預告期：" + notice + "天\n🏖 未休特休：" + remaining + "天\n💰 特休折算：$" + settlement.toLocaleString() + "\n\n確定執行？")) return;
          await ap("/api/admin/employees", { action: "update", employee_id: empId, resignation_date: lastDay, resignation_reason: reason, last_working_date: lastDay, line_uid: null, is_active: false });
          if (settlement > 0) await ap("/api/admin/payments", { action: "create", type: "leave_settlement", employee_id: empId, amount: settlement, recipient: emp2.name, notes: "離職特休結算 " + remaining + "天", month_key: lastDay.slice(0, 7) });
          const d3 = await ap("/api/admin/employees", { action: "generate_bind_code", employee_id: empId });
          alert("離職作業完成\n✅ LINE已解除\n✅ 帳號已停用\n✅ 特休$" + settlement.toLocaleString() + "已加入撥款");
          onClose();
        }} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #b91c1c", background: "transparent", color: "#b91c1c", fontSize: 10, cursor: "pointer" }}>{"🚪 離職作業"}</button>
      </div>
    </div></div>
  );
}

const DEFAULT_HB = [
  { title: "一、出勤、排班與請假", items: ["準時上班：應提前5分鐘到崗。", "依公司系統進行上下班打卡，不得代打。", "事假、病假至少提前4小時通知主管。", "換班須提前告知主管並經書面同意。"] },
  { title: "二、儀容與服裝規定", items: ["穿著公司制服保持整潔。", "穿著防滑包趾鞋。", "長髮必須紮起。", "指甲保持短乾淨。"] },
  { title: "三、食品衛生安全規範", items: ["接觸食品前洗手至少20秒。", "冷藏7°C以下，冷凍-18°C以下。", "生熟食分開保存。", "身體不適須告知主管。"] },
  { title: "四、服務態度與顧客應對", items: ["面對顧客主動親切微笑服務。", "投訴保持冷靜傾聽。", "超出能力通知主管。"] },
  { title: "五、金錢與財務誠信", items: ["收款必須依POS系統操作。", "折扣免單退款需主管授權。", "竊盜舞弊一律解僱追訴。"] },
  { title: "六、手機與社群媒體", items: ["工作期間禁止於服務區使用手機。", "禁止發布門市內部照片影片。"] },
  { title: "七、職場環境", items: ["禁止霸凌歧視性騷擾。", "禁止洩露公司機密。"] },
  { title: "八、違規等級", items: ["輕微→口頭警告", "中度→書面警告", "嚴重→停職或解僱", "零容忍→立即解僱+法律追訴"] },
  { title: "九、申訴舉報", items: ["向主管書面申訴5個工作日回覆。", "公司禁止任何報復行為。"] },
  { title: "十、生效簽署", items: ["本規範自2026年起施行。", "公司保有隨時修訂之權利。"] },
];

function Settings({ stores, as2, upS }) {
  const [hb, setHb] = useState(null);
  const [hbLoading, setHbLoading] = useState(true);
  const [hbSaving, setHbSaving] = useState(false);
  const [hbMsg, setHbMsg] = useState("");
  const [editCh, setEditCh] = useState(null);
  const [hols, setHols] = useState([]);
  const [companyName, setCompanyName] = useState("小食糖 Sugar Bistro");
  const [newStore, setNewStore] = useState({ name: "", address: "" });

  useEffect(() => {
    ap("/api/admin/system?key=handbook").then(r => { setHb(r.data || DEFAULT_HB); setHbLoading(false); });
    ap("/api/admin/holidays?year=" + new Date().getFullYear()).then(r => setHols(r.data || [])).catch(() => {});
    ap("/api/admin/system?key=company_name").then(r => { if (r.data) setCompanyName(r.data); });
  }, []);

  const saveHb = async () => {
    setHbSaving(true);
    await ap("/api/admin/system", { key: "handbook", value: hb });
    setHbMsg("✅ 已儲存"); setHbSaving(false);
    setTimeout(() => setHbMsg(""), 3000);
  };

  const updateChapter = (idx, field, val) => {
    const n = [...hb]; n[idx] = { ...n[idx], [field]: val }; setHb(n);
  };
  const updateItem = (ci, ii, val) => {
    const n = [...hb]; const items = [...n[ci].items]; items[ii] = val; n[ci] = { ...n[ci], items }; setHb(n);
  };
  const addItem = (ci) => {
    const n = [...hb]; n[ci] = { ...n[ci], items: [...n[ci].items, ""] }; setHb(n);
  };
  const removeItem = (ci, ii) => {
    const n = [...hb]; n[ci] = { ...n[ci], items: n[ci].items.filter((_, i) => i !== ii) }; setHb(n);
  };
  const addChapter = () => {
    setHb([...hb, { title: "新章節", items: [""] }]);
  };
  const removeChapter = (ci) => {
    if (confirm("確定刪除此章節？")) setHb(hb.filter((_, i) => i !== ci));
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{"🏢 公司設定"}</h3>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input value={companyName} onChange={e => setCompanyName(e.target.value)} style={{ flex: 1, padding: "5px 8px", borderRadius: 4, border: "1px solid #ddd", fontSize: 12 }} />
          <button onClick={() => ap("/api/admin/system", { key: "company_name", value: companyName }).then(() => alert("已儲存"))} style={{ padding: "5px 12px", borderRadius: 4, border: "none", background: "#0a7c42", color: "#fff", fontSize: 11, cursor: "pointer" }}>{"💾"}</button>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{"🏠 門市管理"}</h3>
        {stores.map(s => <div key={s.id} style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 0", borderBottom: "1px solid #f0eeea", fontSize: 11 }}>
          <span style={{ fontWeight: 500, flex: 1 }}>{s.name}</span>
          <span style={{ color: "#888" }}>{s.address || "未設定地址"}</span>
          <button onClick={() => { const n = prompt("修改門市名稱：", s.name); if (n) ap("/api/admin/stores", { action: "update_targets", store_id: s.id, name: n }).then(() => { alert("已更新"); location.reload(); }); }} style={{ padding: "1px 6px", borderRadius: 3, border: "1px solid #ddd", background: "transparent", fontSize: 9, cursor: "pointer" }}>{"✏️"}</button>
        </div>)}
        <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
          <input value={newStore.name} onChange={e => setNewStore({ ...newStore, name: e.target.value })} placeholder="新門市名稱" style={{ flex: 1, padding: "4px 6px", borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }} />
          <input value={newStore.address} onChange={e => setNewStore({ ...newStore, address: e.target.value })} placeholder="地址" style={{ flex: 2, padding: "4px 6px", borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }} />
          <button onClick={() => { if (!newStore.name) return; ap("/api/admin/stores", { action: "create", name: newStore.name, address: newStore.address }).then(() => { setNewStore({ name: "", address: "" }); alert("已新增"); location.reload(); }); }} style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: newStore.name ? "#0a7c42" : "#ccc", color: "#fff", fontSize: 11, cursor: "pointer" }}>{"＋"}</button>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{"📋 工作日誌權限"}</h3>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div style={{ fontSize: 12 }}>允許門店主管修改日誌模板</div><div style={{ fontSize: 10, color: "#888" }}>開啟後主管可新增/刪除本店工作項目</div></div>
          <button onClick={() => { const curr = document.getElementById("wl-perm-btn").dataset.on === "true"; const next = !curr; ap("/api/admin/system", { key: "worklog_manager_edit", value: next }).then(() => { document.getElementById("wl-perm-btn").dataset.on = String(next); document.getElementById("wl-perm-btn").style.background = next ? "#0a7c42" : "#ccc"; document.getElementById("wl-perm-btn").textContent = next ? "ON" : "OFF"; }); }} id="wl-perm-btn" data-on="true" style={{ padding: "4px 12px", borderRadius: 12, border: "none", background: "#0a7c42", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", minWidth: 44 }}>ON</button>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{"⚙️ 打卡設定"}</h3>
        {[["late_grace_minutes", "遲到寬限(分)"], ["late_threshold_minutes", "嚴重遲到(分)"], ["early_leave_minutes", "早退(分)"], ["overtime_min_minutes", "加班最低(分)"]].map(([k, l]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #f0eeea" }}>
            <span style={{ fontSize: 12 }}>{l}</span>
            <input type="number" value={as2[k] || ""} onChange={e => upS(k, Number(e.target.value))} style={{ width: 50, padding: 3, borderRadius: 4, border: "1px solid #ddd", textAlign: "center", fontSize: 12 }} />
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ fontSize: 13, fontWeight: 500 }}>{"📋 員工守則 / 工作合約"}</h3>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={addChapter} style={{ padding: "3px 10px", borderRadius: 4, border: "1px solid #ddd", background: "transparent", fontSize: 10, cursor: "pointer" }}>{"＋章節"}</button>
            <button onClick={saveHb} disabled={hbSaving} style={{ padding: "3px 10px", borderRadius: 4, border: "none", background: hbSaving ? "#ccc" : "#0a7c42", color: "#fff", fontSize: 10, cursor: "pointer" }}>{hbSaving ? "..." : "💾 儲存守則"}</button>
          </div>
        </div>
        {hbMsg && <div style={{ fontSize: 11, color: "#0a7c42", marginBottom: 6 }}>{hbMsg}</div>}
        {hbLoading ? <p style={{ color: "#ccc" }}>載入中...</p> : hb && hb.map((ch, ci) => (
          <div key={ci} style={{ marginBottom: 8, border: "1px solid #e8e6e1", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 8px", background: "#faf8f5", cursor: "pointer" }} onClick={() => setEditCh(editCh === ci ? null : ci)}>
              <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{ch.title}</span>
              <span style={{ fontSize: 10, color: "#888" }}>{ch.items.length + "項"}</span>
              <button onClick={(e) => { e.stopPropagation(); removeChapter(ci); }} style={{ padding: "1px 4px", borderRadius: 3, border: "1px solid #ddd", background: "transparent", cursor: "pointer", fontSize: 9, color: "#b91c1c" }}>🗑</button>
              <span style={{ fontSize: 10 }}>{editCh === ci ? "▲" : "▼"}</span>
            </div>
            {editCh === ci && (
              <div style={{ padding: 8 }}>
                <div style={{ marginBottom: 6 }}>
                  <label style={{ fontSize: 10, color: "#888" }}>章節標題</label>
                  <input value={ch.title} onChange={e => updateChapter(ci, "title", e.target.value)} style={{ width: "100%", padding: "4px 8px", borderRadius: 4, border: "1px solid #ddd", fontSize: 12 }} />
                </div>
                {ch.items.map((item, ii) => (
                  <div key={ii} style={{ display: "flex", gap: 4, marginBottom: 3 }}>
                    <input value={item} onChange={e => updateItem(ci, ii, e.target.value)} style={{ flex: 1, padding: "3px 6px", borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }} />
                    <button onClick={() => removeItem(ci, ii)} style={{ padding: "1px 4px", borderRadius: 3, border: "1px solid #ddd", background: "transparent", cursor: "pointer", fontSize: 9, color: "#b91c1c" }}>✕</button>
                  </div>
                ))}
                <button onClick={() => addItem(ci)} style={{ padding: "2px 8px", borderRadius: 3, border: "1px dashed #ccc", background: "transparent", cursor: "pointer", fontSize: 10, color: "#888", marginTop: 2 }}>{"＋ 新增項目"}</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginTop: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{"📊 各門市營業目標"}</h3>
        <p style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>設定後會顯示在員工工作日誌上，自動計算達標率。</p>
        {stores.map(s => {
          const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
          const autoMonthly = (s.daily_target || 0) * daysInMonth;
          return (
          <div key={s.id} style={{ display: "flex", gap: 6, alignItems: "center", padding: "5px 0", borderBottom: "1px solid #f0eeea" }}>
            <span style={{ fontSize: 12, fontWeight: 500, width: 80 }}>{s.name}</span>
            <div style={{ flex: 1 }}><label style={{ fontSize: 9, color: "#888" }}>日營業目標</label><input type="number" defaultValue={s.daily_target || ""} onBlur={e => { ap("/api/admin/stores", { action: "update_targets", store_id: s.id, daily_target: Number(e.target.value || 0), monthly_target: Number(e.target.value || 0) * daysInMonth }); }} style={{ width: "100%", padding: 3, borderRadius: 4, border: "1px solid #ddd", fontSize: 11, textAlign: "center" }} /></div>
            <div style={{ flex: 1 }}><label style={{ fontSize: 9, color: "#888" }}>{"月目標（×" + daysInMonth + "天）"}</label><div style={{ padding: "4px 0", fontSize: 12, fontWeight: 600, textAlign: "center" }}>{"$" + autoMonthly.toLocaleString()}</div></div>
          </div>);
        })}
      </div>

      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginTop: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{"📍 門市GPS打卡範圍"}</h3>
        <p style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>設定門市座標和打卡範圍，員工超出範圍將無法打卡。</p>
        {stores.map(s => (
          <div key={s.id} style={{ padding: "6px 0", borderBottom: "1px solid #f0eeea" }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{s.name}</div>
            <div style={{ display: "flex", gap: 4 }}>
              <div style={{ flex: 1 }}><label style={{ fontSize: 9, color: "#888" }}>緯度</label><input type="number" step="0.0001" id={"lat-" + s.id} defaultValue={s.latitude || ""} placeholder="22.6273" style={{ width: "100%", padding: 3, borderRadius: 4, border: "1px solid #ddd", fontSize: 10 }} /></div>
              <div style={{ flex: 1 }}><label style={{ fontSize: 9, color: "#888" }}>經度</label><input type="number" step="0.0001" id={"lng-" + s.id} defaultValue={s.longitude || ""} placeholder="120.3014" style={{ width: "100%", padding: 3, borderRadius: 4, border: "1px solid #ddd", fontSize: 10 }} /></div>
              <div style={{ width: 60 }}><label style={{ fontSize: 9, color: "#888" }}>範圍m</label><input type="number" id={"rad-" + s.id} defaultValue={s.radius_m || 200} style={{ width: "100%", padding: 3, borderRadius: 4, border: "1px solid #ddd", fontSize: 10, textAlign: "center" }} /></div>
              <button onClick={() => { const lat = document.getElementById("lat-" + s.id).value; const lng = document.getElementById("lng-" + s.id).value; const rad = document.getElementById("rad-" + s.id).value; ap("/api/admin/stores", { action: "update_targets", store_id: s.id, latitude: lat ? Number(lat) : null, longitude: lng ? Number(lng) : null, radius_m: rad ? Number(rad) : 200 }).then(() => alert(s.name + " GPS已儲存")); }} style={{ padding: "3px 8px", borderRadius: 4, border: "none", background: "#0a7c42", color: "#fff", fontSize: 9, cursor: "pointer", alignSelf: "flex-end" }}>{"💾"}</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginTop: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{"🗓 " + new Date().getFullYear() + " 國定假日（" + hols.filter(h => h.is_active !== false).length + "/" + hols.length + "天啟用）"}</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {hols.map(h => <button key={h.id} onClick={() => { const next = h.is_active === false ? true : false; ap("/api/admin/system", { key: "hol_" + h.id, value: next }); setHols(hols.map(x => x.id === h.id ? { ...x, is_active: next } : x)); }} style={{ padding: "3px 8px", borderRadius: 4, background: h.is_active === false ? "#f0f0f0" : "#fde8e8", color: h.is_active === false ? "#ccc" : "#b91c1c", fontSize: 10, cursor: "pointer", border: "1px solid " + (h.is_active === false ? "#ddd" : "#f5c6c6"), textDecoration: h.is_active === false ? "line-through" : "none" }}>{h.date.slice(5) + " " + h.name}</button>)}
        </div>
        <p style={{ fontSize: 10, color: "#888", marginTop: 6 }}>{"* 點擊可啟用/停用，停用的假日不會在排班上標紅、不計雙倍薪"}</p>
      </div>

      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginTop: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{"📱 LINE 選單設定"}</h3>
        <p style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>員工在 LINE 輸入「選單」時，依據角色顯示不同功能按鈕。</p>
        <div style={{ fontSize: 11, lineHeight: 2 }}>
          <div><b>👤 員工：</b>上班打卡、下班打卡、我的班表、請假申請、日結回報、存款回報</div>
          <div><b>🏪 門店主管：</b>以上 + 月結單據、零用金</div>
          <div><b>🏠 管理：</b>以上 + 總部代付、今日營收</div>
          <div><b>👑 總部：</b>全部功能</div>
        </div>
        <div style={{ marginTop: 8 }}>
          <a href="/setup" target="_blank" style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #4361ee", color: "#4361ee", fontSize: 11, textDecoration: "none" }}>{"🚀 設定 LINE 常駐選單（Rich Menu）"}</a>
        </div>
      </div>
    </div>
  );
}

function LeavesMgr({ lr, pl, rvLv, sf, month, stores, LT }) {
  const [lbView, setLbView] = useState("pending");
  const [balances, setBalances] = useState([]);
  const [lbLd, setLbLd] = useState(false);

  useEffect(() => {
    if (lbView === "balances") {
      setLbLd(true);
      ap("/api/admin/leave-balances?year=" + new Date().getFullYear() + (sf ? "&store_id=" + sf : "")).then(r => { setBalances(r.data || []); setLbLd(false); });
    }
  }, [lbView, sf]);

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        <button onClick={() => setLbView("pending")} style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid #ddd", background: lbView === "pending" ? "#1a1a1a" : "#fff", color: lbView === "pending" ? "#fff" : "#666", fontSize: 11, cursor: "pointer" }}>{"⏳ 待審核/紀錄"}</button>
        <button onClick={() => setLbView("balances")} style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid #ddd", background: lbView === "balances" ? "#1a1a1a" : "#fff", color: lbView === "balances" ? "#fff" : "#666", fontSize: 11, cursor: "pointer" }}>{"📊 假勤總覽"}</button>
      </div>

      {lbView === "pending" && <div>
        <div style={{ background: "#e6f1fb", borderRadius: 6, padding: 8, marginBottom: 10, fontSize: 11, color: "#185fa5" }}>{"💡 預休/請假申請會自動顯示在排班表上，核准後排入班表。"}</div>
        {pl.length > 0 && <div style={{ background: "#fff8e6", borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{"⏳ 待審核（" + pl.length + "）"}</h3>
          {pl.map(l => <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0", borderBottom: "1px solid #f0eeea", flexWrap: "wrap", fontSize: 12 }}>
            <b>{l.employees ? l.employees.name : ""}</b>
            <span style={{ color: LT[l.leave_type] ? LT[l.leave_type].c : "#666", background: LT[l.leave_type] ? LT[l.leave_type].bg : "#f0f0f0", padding: "1px 6px", borderRadius: 4, fontSize: 10 }}>{LT[l.leave_type] ? LT[l.leave_type].l : l.leave_type}</span>
            <span>{l.start_date}{l.end_date !== l.start_date ? " ~ " + l.end_date : ""}{l.half_day ? (l.half_day === "am" ? "（上午）" : "（下午）") : ""}</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
              <button onClick={() => rvLv(l.id, "approved")} style={{ padding: "3px 10px", borderRadius: 4, border: "none", background: "#0a7c42", color: "#fff", fontSize: 10, cursor: "pointer" }}>{"✅ 核准"}</button>
              <button onClick={() => rvLv(l.id, "rejected")} style={{ padding: "3px 10px", borderRadius: 4, border: "none", background: "#b91c1c", color: "#fff", fontSize: 10, cursor: "pointer" }}>{"❌ 駁回"}</button>
            </div>
          </div>)}
        </div>}
        {lr.filter(l => l.status !== "pending").length > 0 && <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#faf8f5" }}>{["員工", "假別", "日期", "狀態"].map(h => <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}</tr></thead>
          <tbody>{lr.filter(l => l.status !== "pending").map(l => <tr key={l.id} style={{ borderBottom: "1px solid #f0eeea" }}><td style={{ padding: 6, fontWeight: 500 }}>{l.employees ? l.employees.name : ""}</td><td style={{ padding: 6 }}>{LT[l.leave_type] ? LT[l.leave_type].l : l.leave_type}</td><td style={{ padding: 6 }}>{l.start_date}{l.end_date !== l.start_date ? " ~ " + l.end_date : ""}</td><td style={{ padding: 6 }}><Badge status={l.status} /></td></tr>)}</tbody></table>
        </div>}
        {lr.length === 0 && pl.length === 0 && <div style={{ background: "#fff", borderRadius: 8, padding: 30, textAlign: "center", color: "#ccc" }}>本月無請假紀錄</div>}
      </div>}

      {lbView === "balances" && <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{new Date().getFullYear() + " 年度假勤總覽"}</h3>
        {lbLd ? <p style={{ color: "#ccc", textAlign: "center", padding: 20 }}>計算中...</p> : <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#faf8f5" }}>{["員工", "門市", "特休(總/已用/剩餘)", "病假(已用/30)", "事假(已用/14)"].map(h => <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}</tr></thead>
          <tbody>{balances.map(b => <tr key={b.employee_id} style={{ borderBottom: "1px solid #f0eeea" }}>
            <td style={{ padding: 6, fontWeight: 500 }}>{b.name}</td>
            <td style={{ padding: 6 }}>{b.store_name}</td>
            <td style={{ padding: 6 }}><span style={{ color: "#4361ee" }}>{b.annual_total}</span>{" / "}<span style={{ color: "#b91c1c" }}>{b.annual_used}</span>{" / "}<b style={{ color: b.annual_remaining > 0 ? "#0a7c42" : "#b91c1c" }}>{b.annual_remaining}</b></td>
            <td style={{ padding: 6 }}><span style={{ color: "#b91c1c" }}>{b.sick_used}</span>{" / 30"}</td>
            <td style={{ padding: 6 }}><span style={{ color: "#b91c1c" }}>{b.personal_used}</span>{" / 14"}</td>
          </tr>)}</tbody></table>
        </div>}
        <p style={{ fontSize: 10, color: "#999", marginTop: 6 }}>{"* 特休天數依勞基法§38自動計算（週年制）：滿6月3天、滿1年7天、滿2年10天、滿3年14天、滿5年15天"}</p>
      </div>}
    </div>
  );
}

function WorklogMgr({ stores, sf, month, load, role, lockedStore }) {
  const canEdit = role === "admin" || role === "manager" || (role === "store_manager" && wlMgrPerm);
  const visibleStores = lockedStore ? stores.filter(s => s.id === lockedStore) : stores;
  const [wlStore, setWlStore] = useState(lockedStore || sf || (stores[0] ? stores[0].id : ""));
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [wlLd, setWlLd] = useState(true);
  const [newItem, setNewItem] = useState({ category: "開店準備", item: "", role: "all", shift_type: "opening", frequency: "daily", weekday: "", requires_value: false, value_label: "", value_min: "", value_max: "" });
  const [copyTarget, setCopyTarget] = useState("");
  const [wlMgrPerm, setWlMgrPerm] = useState(false);

  const loadWl = () => {
    if (!wlStore) return;
    setWlLd(true);
    Promise.all([
      ap("/api/admin/worklogs?type=templates&store_id=" + wlStore),
      ap("/api/admin/worklogs?month=" + month + "&store_id=" + wlStore),
      ap("/api/admin/system?key=worklog_manager_edit").catch(() => ({ data: true })),
    ]).then(([t, l, perm]) => { setTemplates(t.data || []); setLogs(l.data || []); setWlMgrPerm(perm.data === true || perm.data === "true"); setWlLd(false); });
  };
  useEffect(() => { loadWl(); }, [wlStore, month]);

  const addTemplate = async () => {
    if (!newItem.item) return;
    await ap("/api/admin/worklogs", { action: "add_template", store_id: wlStore, ...newItem });
    setNewItem({ ...newItem, item: "" }); loadWl();
  };
  const delTemplate = async (id) => { await ap("/api/admin/worklogs", { action: "delete_template", template_id: id }); loadWl(); };
  const copyItem = async (t) => {
    if (!copyTarget) { alert("請先選擇目標門市"); return; }
    await ap("/api/admin/worklogs", { action: "add_template", store_id: copyTarget, category: t.category, item: t.item, role: t.role, shift_type: t.shift_type, sort_order: t.sort_order });
    alert("已複製到 " + (stores.find(s => s.id === copyTarget) ? stores.find(s => s.id === copyTarget).name : "目標門市"));
  };
  const copyAll = async () => {
    if (!copyTarget || copyTarget === wlStore) return;
    const d = await ap("/api/admin/worklogs", { action: "copy_to_store", from_store_id: wlStore, to_store_id: copyTarget });
    alert("已複製 " + (d.count || 0) + " 個項目"); loadWl();
  };

  const grouped = {};
  for (const t of templates) { const k = t.shift_type === "closing" ? "打烊作業" : "開店/營業"; if (!grouped[k]) grouped[k] = []; grouped[k].push(t); }

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{"📋 選擇門市："}</span>
        {visibleStores.map(s => <button key={s.id} onClick={() => setWlStore(s.id)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #ddd", background: wlStore === s.id ? "#1a1a1a" : "#fff", color: wlStore === s.id ? "#fff" : "#666", fontSize: 12, cursor: "pointer", fontWeight: wlStore === s.id ? 600 : 400 }}>{s.name}</button>)}
      </div>

      {wlStore && <div>
        {canEdit && <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center", background: "#e6f1fb", borderRadius: 6, padding: "6px 10px" }}>
          <span style={{ fontSize: 11, color: "#185fa5" }}>{"📋 複製到："}</span>
          <select value={copyTarget} onChange={e => setCopyTarget(e.target.value)} style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}>
            <option value="">選擇目標門市</option>
            {stores.filter(s => s.id !== wlStore).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={copyAll} disabled={!copyTarget} style={{ padding: "3px 10px", borderRadius: 4, border: "none", background: copyTarget ? "#4361ee" : "#ccc", color: "#fff", fontSize: 10, cursor: "pointer" }}>全部複製</button>
        </div>}

        {wlLd ? <p style={{ color: "#ccc", textAlign: "center", padding: 20 }}>載入中...</p> : <div>
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} style={{ marginBottom: 12 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: group === "打烊作業" ? "#b45309" : "#0a7c42", marginBottom: 6 }}>{group === "打烊作業" ? "🌙 " : "☀️ "}{group}</h4>
              <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1" }}>
                {items.map(t => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderBottom: "1px solid #f0eeea" }}>
                    <span style={{ fontSize: 11, flex: 1 }}>
                      <span style={{ fontWeight: 500 }}>{t.item}</span>
                      {t.role !== "all" && <span style={{ fontSize: 9, background: "#fef9c3", color: "#8a6d00", padding: "1px 4px", borderRadius: 3, marginLeft: 4 }}>{t.role}</span>}
                      {t.frequency === "weekly" && <span style={{ fontSize: 9, background: "#e6f1fb", color: "#185fa5", padding: "1px 4px", borderRadius: 3, marginLeft: 4 }}>{"週" + (t.weekday !== null ? ["日","一","二","三","四","五","六"][t.weekday] : "")}</span>}
                      {t.frequency === "monthly" && <span style={{ fontSize: 9, background: "#fde8e8", color: "#b91c1c", padding: "1px 4px", borderRadius: 3, marginLeft: 4 }}>月</span>}
                      {t.requires_value && <span style={{ fontSize: 9, background: "#e6f9f0", color: "#0a7c42", padding: "1px 4px", borderRadius: 3, marginLeft: 4 }}>{"📊" + (t.value_label || "")}</span>}
                    </span>
                    <span style={{ fontSize: 9, color: "#888" }}>{t.category}</span>
                    {canEdit && copyTarget && <button onClick={() => copyItem(t)} style={{ padding: "1px 6px", borderRadius: 3, border: "1px solid #4361ee", background: "transparent", color: "#4361ee", cursor: "pointer", fontSize: 9 }}>{"📋複製"}</button>}
                    {canEdit && <button onClick={() => delTemplate(t.id)} style={{ padding: "1px 4px", borderRadius: 3, border: "1px solid #ddd", background: "transparent", cursor: "pointer", fontSize: 9, color: "#b91c1c" }}>🗑</button>}
                  </div>
                ))}
                {items.length === 0 && <div style={{ padding: 12, textAlign: "center", color: "#ccc", fontSize: 11 }}>無項目</div>}
              </div>
            </div>
          ))}

          {Object.keys(grouped).length === 0 && <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 30, textAlign: "center", color: "#ccc" }}>此門市尚無工作項目</div>}

          {canEdit && <div style={{ background: "#fff", borderRadius: 8, border: "2px dashed #ddd", padding: 10, marginTop: 10 }}>
            <h4 style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>{"＋ 新增工作項目"}</h4>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
              <select value={newItem.frequency} onChange={e => setNewItem({ ...newItem, frequency: e.target.value })} style={{ padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}><option value="daily">每日</option><option value="weekly">週清</option><option value="monthly">月清</option></select>
              {newItem.frequency === "weekly" && <select value={newItem.weekday} onChange={e => setNewItem({ ...newItem, weekday: e.target.value })} style={{ padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}><option value="">星期</option><option value="1">一</option><option value="2">二</option><option value="3">三</option><option value="4">四</option><option value="5">五</option><option value="6">六</option><option value="0">日</option></select>}
              <select value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })} style={{ padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}><option>開店準備</option><option>營業中</option><option>打烊作業</option><option>清潔消毒</option><option>食材管理</option><option>溫度記錄</option><option>盤點</option><option>設備維護</option><option>週清潔</option><option>月清潔</option></select>
              <select value={newItem.shift_type} onChange={e => setNewItem({ ...newItem, shift_type: e.target.value })} style={{ padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}><option value="opening">開店</option><option value="during">營業中</option><option value="closing">打烊</option><option value="daily_check">檢查</option></select>
            </div>
            <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
              <input value={newItem.item} onChange={e => setNewItem({ ...newItem, item: e.target.value })} placeholder="工作項目名稱" onKeyDown={e => e.key === "Enter" && addTemplate()} style={{ flex: 1, padding: "5px 8px", borderRadius: 4, border: "1px solid #ddd", fontSize: 12 }} />
              <button onClick={addTemplate} disabled={!newItem.item} style={{ padding: "5px 14px", borderRadius: 4, border: "none", background: newItem.item ? "#0a7c42" : "#ccc", color: "#fff", fontSize: 11, cursor: "pointer" }}>新增</button>
            </div>
            <div style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 2, cursor: "pointer" }}><input type="checkbox" checked={newItem.requires_value} onChange={e => setNewItem({ ...newItem, requires_value: e.target.checked })} />需輸入數值</label>
              {newItem.requires_value && <>
                <input value={newItem.value_label} onChange={e => setNewItem({ ...newItem, value_label: e.target.value })} placeholder="單位(如°C)" style={{ width: 50, padding: 2, borderRadius: 3, border: "1px solid #ddd", fontSize: 10 }} />
                <input type="number" value={newItem.value_min} onChange={e => setNewItem({ ...newItem, value_min: e.target.value })} placeholder="最小" style={{ width: 40, padding: 2, borderRadius: 3, border: "1px solid #ddd", fontSize: 10 }} />
                <span>~</span>
                <input type="number" value={newItem.value_max} onChange={e => setNewItem({ ...newItem, value_max: e.target.value })} placeholder="最大" style={{ width: 40, padding: 2, borderRadius: 3, border: "1px solid #ddd", fontSize: 10 }} />
              </>}
            </div>
          </div>}

          <h4 style={{ fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 6 }}>{"📝 每日完成度"}</h4>
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#faf8f5" }}>{["日期", "完成度", "協作者"].map(h => <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}</tr></thead>
              <tbody>{logs.length === 0 ? <tr><td colSpan={3} style={{ padding: 16, textAlign: "center", color: "#ccc" }}>本月無紀錄</td></tr> : logs.map(l => <tr key={l.date + l.store_id} style={{ borderBottom: "1px solid #f0eeea" }}><td style={{ padding: 6 }}>{l.date}</td><td style={{ padding: 6 }}><div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 60, height: 6, background: "#f0f0f0", borderRadius: 3 }}><div style={{ height: "100%", width: (l.percent || 0) + "%", background: l.percent === 100 ? "#0a7c42" : "#fbbf24", borderRadius: 3 }} /></div><span style={{ fontWeight: 600, color: l.percent === 100 ? "#0a7c42" : "#b45309" }}>{l.percent + "%"}</span><span style={{ color: "#888" }}>{"(" + l.done + "/" + l.total + ")"}</span></div></td><td style={{ padding: 6, fontSize: 10 }}>{(l.people || []).join("、") || "-"}</td></tr>)}</tbody></table>
          </div>
        </div>}
      </div>}
    </div>
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
  const [expType, setExpType] = useState("all");
  const [payrollData, setPayrollData] = useState([]);
  const [otRecords, setOtRecords] = useState([]); const [otSum, setOtSum] = useState({});
  const [pmtRecords, setPmtRecords] = useState([]); const [pmtSum, setPmtSum] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [expSearch, setExpSearch] = useState("");

  useEffect(() => { ap("/api/admin/stores").then(d => { setStores(d.data || []); window.__stores = d.data || []; }); }, []);
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
    if (myTabs.includes("overtime")) ap("/api/admin/overtime?month=" + month + (sf ? "&store_id=" + sf : "")).then(r => { setOtRecords(r.data || []); setOtSum(r.summary || {}); });
    if (myTabs.includes("payments")) ap("/api/admin/payments?month=" + month).then(r => { setPmtRecords(r.data || []); setPmtSum(r.summary || {}); });
    ap("/api/admin/holidays?month=" + month).then(r => setHolidays(r.data || [])).catch(() => {});
  }, [month, sf, ws, sv, myTabs]);
  useEffect(() => { load(); }, [load]);

  const addEmp = async () => { const d = await ap("/api/admin/employees", { action: "create", ...ne }); if (d.bind_code) { setNbc(d.bind_code); load(); } };
  const activate = async (id) => { const d = await ap("/api/admin/employees", { action: "activate", employee_id: id }); if (d.bind_code) alert("已啟用！綁定碼：" + d.bind_code); load(); };
  const deactivate = async (id) => { 
    const emp = emps.find(e => e.id === id);
    const action = confirm("選擇操作：\n確定 = 離職結算（計算未休特休換薪）\n取消 = 僅停用帳號");
    if (action) {
      const r = await ap("/api/admin/leave-balances?employee_id=" + id + "&year=" + new Date().getFullYear());
      const remaining = r.data ? r.data.annual_remaining || 0 : 0;
      const dailyPay = emp.monthly_salary ? Math.round(emp.monthly_salary / 30) : (emp.hourly_rate ? emp.hourly_rate * 8 : 0);
      const settlement = remaining * dailyPay;
      if (confirm((emp.name || "") + " 離職結算：\n\n未休特休：" + remaining + " 天\n日薪：$" + dailyPay + "\n應付特休換薪：$" + settlement.toLocaleString() + "\n\n確定執行離職？")) {
        await ap("/api/admin/employees", { action: "deactivate", employee_id: id });
        if (settlement > 0) await ap("/api/admin/payments", { action: "create", type: "leave_settlement", employee_id: id, amount: settlement, recipient: emp.name, notes: "離職特休結算 " + remaining + "天", month_key: new Date().toISOString().slice(0, 7) });
        alert("已離職，特休換薪 $" + settlement.toLocaleString() + " 已加入撥款追蹤"); load();
      }
    } else {
      if (confirm("確定停用 " + (emp.name || "") + " 的帳號？")) { await ap("/api/admin/employees", { action: "deactivate", employee_id: id }); load(); }
    }
  };
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
    const pendingLr = lr.find(l => l.employee_id === emp.id && l.status === "pending" && l.start_date <= date && l.end_date >= date);
    return <div>
      {pendingLr && <div style={{ background: "#fef9c3", borderRadius: 3, padding: "1px 3px", fontSize: 8, color: "#8a6d00", marginBottom: 1, border: "1px dashed #d4a017" }}>{"⏳ " + (LT[pendingLr.leave_type] ? LT[pendingLr.leave_type].l : "預休")}</div>}
      <select onChange={e => { const v = e.target.value; e.target.value = ""; if (!v) return; if (v.startsWith("leave:")) addLv(emp.id, date, v.split(":")[1]); else addSch(emp.id, v, date); }} style={{ width: "100%", padding: "1px", borderRadius: 3, border: "1px dashed #ddd", fontSize: 9, color: "#ccc", background: "transparent", cursor: "pointer" }}><option value="">+</option><optgroup label="班別">{shifts.filter(s => !sf || s.store_id === sf).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup><optgroup label="休假">{Object.entries(LT).map(([k, v]) => <option key={k} value={"leave:" + k}>{v.l}</option>)}</optgroup></select>
    </div>;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f5", fontFamily: "system-ui,'Noto Sans TC',sans-serif" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e6e1", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ fontSize: 18 }}>{"🍯"}</span><span style={{ fontSize: 13, fontWeight: 600 }}>小食糖後台</span><RB role={auth.role} /><span style={{ fontSize: 11, color: "#888" }}>{auth.name}</span></div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ padding: "3px 6px", borderRadius: 5, border: "1px solid #ddd", fontSize: 11 }} />
          {auth.role !== "store_manager" && <select value={sf} onChange={e => setSf(e.target.value)} style={{ padding: "3px 6px", borderRadius: 5, border: "1px solid #ddd", fontSize: 11 }}><option value="">全部門市</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
          {auth.role === "store_manager" && <span style={{ padding: "3px 8px", borderRadius: 5, background: "#e6f1fb", color: "#185fa5", fontSize: 11, fontWeight: 500 }}>{"🏠 " + (auth.store_name || stores.find(s => s.id === sf)?.name || "本店")}</span>}
          <button onClick={onLogout} style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid #ddd", background: "transparent", fontSize: 11, cursor: "pointer", color: "#b91c1c" }}>登出</button>
        </div>
      </div>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 8px" }}>
        <div style={{ display: "flex", gap: 2, marginBottom: 10, overflowX: "auto", paddingBottom: 3, alignItems: "center" }}>
          {Object.entries(TAB_GROUPS).map(([group, tabs]) => {
            const visible = tabs.filter(id => myTabs.includes(id));
            if (visible.length === 0) return null;
            return <span key={group} style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 9, color: "#aaa", padding: "0 4px", whiteSpace: "nowrap" }}>{group}</span>
              {visible.map(id => <button key={id} style={{ padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11, fontWeight: tab === id ? 600 : 400, background: tab === id ? "#1a1a1a" : "transparent", color: tab === id ? "#fff" : "#888", whiteSpace: "nowrap" }} onClick={() => setTab(id)}>{TAB_L[id]}</button>)}
              <span style={{ borderLeft: "1px solid #ddd", height: 16, margin: "0 2px" }} />
            </span>;
          })}
        </div>
        {ld && <div style={{ textAlign: "center", padding: 30, color: "#aaa" }}>載入中...</div>}

        {!ld && tab === "dashboard" && <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: "10px 12px" }}><div style={{ fontSize: 10, color: "#888" }}>{"本月營收"}</div><div style={{ fontSize: 20, fontWeight: 700, color: "#0a7c42" }}>{fmt(sum.total_net_sales)}</div></div>
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: "10px 12px" }}><div style={{ fontSize: 10, color: "#888" }}>{"待審核"}</div><div style={{ fontSize: 20, fontWeight: 700, color: "#b45309" }}>{pl.length + lr.filter(l => l.status === "pending").length}</div><div style={{ fontSize: 9, color: "#888" }}>{pl.length + "假 " + exps.filter(e => e.status === "pending").length + "費用"}</div></div>
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: "10px 12px" }}><div style={{ fontSize: 10, color: "#888" }}>{"在職員工"}</div><div style={{ fontSize: 20, fontWeight: 700 }}>{ae.length}</div></div>
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: "10px 12px" }}><div style={{ fontSize: 10, color: "#888" }}>{"待撥款"}</div><div style={{ fontSize: 20, fontWeight: 700, color: "#b91c1c" }}>{fmt(pmtSum.pending)}</div></div>
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: "10px 12px" }}><div style={{ fontSize: 10, color: "#888" }}>{"加班時數"}</div><div style={{ fontSize: 20, fontWeight: 700, color: "#b45309" }}>{Math.round((otSum.totalMinutes || 0) / 60 * 10) / 10 + "hr"}</div>{(otSum.totalMinutes || 0) > 46 * 60 && <div style={{ fontSize: 9, color: "#b91c1c" }}>{"⚠️ 超過46hr上限"}</div>}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{"📊 門市營收比較"}</h4>
              {stores.map(s => { const rev = stl.filter(r => r.store_id === s.id).reduce((a, r) => a + Number(r.net_sales || 0), 0); const target = (s.daily_target || 0) * new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(); const pct = target > 0 ? Math.round(rev / target * 100) : 0; return <div key={s.id} style={{ marginBottom: 6 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}><span>{s.name}</span><span style={{ fontWeight: 600 }}>{fmt(rev)}{target > 0 ? " / " + fmt(target) : ""}</span></div>{target > 0 && <div style={{ height: 5, background: "#f0f0f0", borderRadius: 3, marginTop: 2 }}><div style={{ height: "100%", width: Math.min(100, pct) + "%", background: pct >= 100 ? "#0a7c42" : pct >= 70 ? "#fbbf24" : "#b91c1c", borderRadius: 3 }} /></div>}{target > 0 && <div style={{ fontSize: 9, color: pct >= 100 ? "#0a7c42" : "#888", textAlign: "right" }}>{pct + "%"}</div>}</div>; })}
            </div>
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{"⚠️ 異常通報"}</h4>
              {dep.filter(d => d.status === "anomaly").map(d => <div key={d.id} style={{ fontSize: 11, padding: "3px 0", borderBottom: "1px solid #f0eeea", color: "#b91c1c" }}>{"🚨 存款異常 " + (d.stores ? d.stores.name : "") + " " + d.deposit_date + " 差" + fmt(d.difference)}</div>)}
              {att.filter(a => a.late_minutes > 30).slice(0, 5).map(a => <div key={a.id} style={{ fontSize: 11, padding: "3px 0", borderBottom: "1px solid #f0eeea", color: "#b45309" }}>{"⏰ 嚴重遲到 " + (a.employees ? a.employees.name : "") + " " + a.late_minutes + "分"}</div>)}
              {otRecords.filter(r => r.overtime_minutes > 180).slice(0, 3).map(r => <div key={r.id} style={{ fontSize: 11, padding: "3px 0", borderBottom: "1px solid #f0eeea", color: "#b45309" }}>{"⏱ 大量加班 " + (r.employees ? r.employees.name : "") + " " + r.date + " " + Math.round(r.overtime_minutes / 60) + "hr"}</div>)}
              {dep.filter(d => d.status === "anomaly").length === 0 && att.filter(a => a.late_minutes > 30).length === 0 && <div style={{ fontSize: 11, color: "#ccc", textAlign: "center", padding: 10 }}>{"✅ 本月無異常"}</div>}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{"🏖 特休即將到期"}</h4>
              {ae.filter(e => { const m = e.service_months || 0; const monthInYear = new Date(e.hire_date || "").getMonth(); const expMonth = new Date().getMonth(); return m >= 6 && Math.abs(monthInYear - expMonth) <= 2; }).slice(0, 5).map(e => <div key={e.id} style={{ fontSize: 11, padding: "3px 0", borderBottom: "1px solid #f0eeea" }}>{e.name + " — " + (e.annual_leave_days || 0) + "天特休，到職月：" + (e.hire_date || "").slice(5, 7) + "月"}</div>)}
              {ae.filter(e => (e.service_months || 0) >= 6).length === 0 && <div style={{ fontSize: 11, color: "#ccc", textAlign: "center", padding: 10 }}>無</div>}
            </div>
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{"📋 快捷操作"}</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <button onClick={() => setTab("schedules")} style={{ padding: "6px", borderRadius: 4, border: "1px solid #ddd", background: "transparent", fontSize: 11, cursor: "pointer", textAlign: "left" }}>{"📅 排班管理"}</button>
                <button onClick={() => setTab("payroll")} style={{ padding: "6px", borderRadius: 4, border: "1px solid #ddd", background: "transparent", fontSize: 11, cursor: "pointer", textAlign: "left" }}>{"💰 薪資核算"}</button>
                <button onClick={() => setTab("expenses")} style={{ padding: "6px", borderRadius: 4, border: "1px solid #ddd", background: "transparent", fontSize: 11, cursor: "pointer", textAlign: "left" }}>{"📦 費用審核（" + exps.filter(e => e.status === "pending").length + "待核）"}</button>
                <button onClick={() => setTab("payments")} style={{ padding: "6px", borderRadius: 4, border: "1px solid #ddd", background: "transparent", fontSize: 11, cursor: "pointer", textAlign: "left" }}>{"💳 撥款追蹤（" + fmt(pmtSum.pending) + "待撥）"}</button>
              </div>
            </div>
          </div>
        </div>}

        {!ld && tab === "schedules" && <div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
            <button onClick={() => setSv("week")} style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid #ddd", background: sv === "week" ? "#1a1a1a" : "#fff", color: sv === "week" ? "#fff" : "#666", fontSize: 11, cursor: "pointer" }}>週</button>
            <button onClick={() => setSv("month")} style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid #ddd", background: sv === "month" ? "#1a1a1a" : "#fff", color: sv === "month" ? "#fff" : "#666", fontSize: 11, cursor: "pointer" }}>月</button>
            {sv === "week" && <><button onClick={prevW} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: 11 }}>◀</button>
            <span style={{ fontSize: 12, fontWeight: 500 }}>{ws + "~" + wd[6]}</span>
            <button onClick={nextW} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: 11 }}>▶</button></>}
            {sv === "month" && <span style={{ fontSize: 12, fontWeight: 500 }}>{month}</span>}
            <button onClick={pub} style={{ padding: "4px 12px", borderRadius: 5, border: "none", background: "#0a7c42", color: "#fff", cursor: "pointer", fontSize: 11, marginLeft: "auto" }}>{"📢 發布"}</button>
          </div>
          {pm && <div style={{ background: "#e6f9f0", color: "#0a7c42", padding: "4px 10px", borderRadius: 5, fontSize: 11, marginBottom: 6 }}>{pm}</div>}
          <div style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 10, color: "#888" }}>
            <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#e6f9f0", border: "1px solid #ccc", marginRight: 3 }} />已發布</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#fff8e6", border: "1px solid #ccc", marginRight: 3 }} />未發布</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#fef9c3", border: "1px dashed #d4a017", marginRight: 3 }} />預休申請</span>
          </div>
          {sv === "week" && <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, minWidth: 700 }}>
              <thead><tr style={{ background: "#faf8f5", borderBottom: "1px solid #e8e6e1" }}><th style={{ padding: "7px 5px", textAlign: "left", fontWeight: 500, color: "#666", minWidth: 60, position: "sticky", left: 0, background: "#faf8f5", zIndex: 1 }}>員工</th>{wd.map((d, i) => <th key={d} style={{ padding: "7px 3px", textAlign: "center", fontWeight: 500, color: i === 0 || i === 6 ? "#b91c1c" : "#666", minWidth: 85 }}>{d.slice(5) + "(" + DAYS[new Date(d).getDay()] + ")"}</th>)}</tr></thead>
              <tbody>{fe.map(emp => <tr key={emp.id} style={{ borderBottom: "1px solid #f0eeea" }}><td style={{ padding: "5px", fontWeight: 500, fontSize: 11, position: "sticky", left: 0, background: "#fff", zIndex: 1 }}>{emp.name}<br /><RB role={emp.role} /></td>{wd.map(date => <td key={date} style={{ padding: "2px", textAlign: "center", verticalAlign: "top" }}>{renderCell(emp, date)}</td>)}</tr>)}</tbody>
            </table>
          </div>}
          {sv === "month" && <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, tableLayout: "fixed" }}>
              <thead><tr style={{ background: "#faf8f5" }}>{DAYS.map((d, i) => <th key={d} style={{ padding: "6px 3px", textAlign: "center", color: i === 0 || i === 6 ? "#b91c1c" : "#666", fontWeight: 500 }}>{d}</th>)}</tr></thead>
              <tbody>{(() => { const [y, m] = month.split("-").map(Number); const f = new Date(y, m - 1, 1); const sd = f.getDay(); const daysInMonth = new Date(y, m, 0).getDate(); const rows = []; let cells = []; for (let i = 0; i < sd; i++) cells.push(<td key={"e" + i} style={{ padding: 3, border: "1px solid #f0eeea" }} />); for (let d = 1; d <= daysInMonth; d++) { const date = y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0"); const ds = scheds.filter(s => s.date === date); const hol = holidays.find(h => h.date === date); const isWeekend = new Date(date).getDay() === 0 || new Date(date).getDay() === 6; cells.push(<td key={date} style={{ padding: 3, verticalAlign: "top", border: "1px solid #f0eeea", minHeight: 40, background: hol ? "#fde8e8" : isWeekend ? "#faf8f5" : "transparent" }}><div style={{ fontSize: 10, fontWeight: 500, color: hol ? "#b91c1c" : "#666" }}>{d}{hol ? <span style={{ fontSize: 7, color: "#b91c1c", marginLeft: 2 }}>{hol.name}</span> : ""}</div>{ds.slice(0, 4).map(s => { if (s.type === "leave") { const lt = LT[s.leave_type] || LT.off; return <div key={s.id} style={{ background: lt.bg, borderRadius: 2, padding: "0 2px", fontSize: 8, marginBottom: 1, color: lt.c, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{(s.employees ? s.employees.name : "") + " " + lt.l}</div>; } return <div key={s.id} style={{ background: s.published ? "#e6f9f0" : "#fff8e6", borderRadius: 2, padding: "0 2px", fontSize: 8, marginBottom: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{(s.employees ? s.employees.name : "") + " " + (s.shifts ? s.shifts.name : "")}</div>; })}{ds.length > 4 && <div style={{ fontSize: 8, color: "#999" }}>{"+" + (ds.length - 4)}</div>}</td>); if (cells.length === 7) { rows.push(<tr key={"r" + rows.length}>{cells}</tr>); cells = []; } } while (cells.length < 7) cells.push(<td key={"f" + cells.length} style={{ padding: 3, border: "1px solid #f0eeea" }} />); if (cells.length) rows.push(<tr key={"r" + rows.length}>{cells}</tr>); return rows; })()}</tbody>
            </table>
          </div>}
        </div>}

        {!ld && tab === "store_staff" && <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{"👥 本店員工聯絡資料"}</h3>
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}>
            {fe.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#ccc" }}>無員工</div> : fe.map(e => (
              <div key={e.id} style={{ padding: 12, borderBottom: "1px solid #f0eeea" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{e.name}</span>
                  <RB role={e.role} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, fontSize: 12 }}>
                  <Row l="手機" v={e.phone || "-"} />
                  <Row l="Email" v={e.email || "-"} />
                  <Row l="生日" v={e.birthday || "-"} />
                  <Row l="LINE" v={e.line_uid ? "✅" : "未綁定"} />
                </div>
                <div style={{ marginTop: 4, padding: 6, background: "#fef9c3", borderRadius: 4, fontSize: 11 }}>
                  <b>{"🆘 緊急聯絡人："}</b>{(e.emergency_contact || "-") + " " + (e.emergency_phone || "") + "（" + (e.emergency_relation || "") + "）"}
                </div>
              </div>
            ))}
          </div>
        </div>}

        {!ld && tab === "leaves" && <LeavesMgr lr={lr} pl={pl} rvLv={rvLv} sf={sf} month={month} stores={stores} LT={LT} />}

        {!ld && tab === "shifts" && <div>
          <button onClick={() => { setSsf(!ssf); setEs(null); setSf2({ ...sf2, store_id: sf || sf2.store_id }); }} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #ddd", background: ssf ? "#f0f0f0" : "#1a1a1a", color: ssf ? "#666" : "#fff", fontSize: 11, cursor: "pointer", marginBottom: 8 }}>{ssf ? "✕" : "＋新增班別"}</button>
          {ssf && <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 8 }}><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
            {auth.role === "store_manager" ? <div><label style={{ fontSize: 10, color: "#888" }}>門市</label><div style={{ padding: 4, fontSize: 11, fontWeight: 500 }}>{auth.store_name || "本店"}</div></div> : <div><label style={{ fontSize: 10, color: "#888" }}>門市</label><select value={sf2.store_id} onChange={e => setSf2({ ...sf2, store_id: e.target.value })} style={{ width: "100%", padding: "4px", borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}><option value="">選擇</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
            <div><label style={{ fontSize: 10, color: "#888" }}>名稱</label><input value={sf2.name} onChange={e => setSf2({ ...sf2, name: e.target.value })} style={{ width: "100%", padding: "4px", borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }} /></div>
            <div><label style={{ fontSize: 10, color: "#888" }}>角色</label><select value={sf2.role} onChange={e => setSf2({ ...sf2, role: e.target.value })} style={{ width: "100%", padding: "4px", borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}><option value="all">全場</option><option value="外場">外場</option><option value="內場">內場</option><option value="吧台">吧台</option><option value="烘焙">烘焙</option></select></div>
            <div><label style={{ fontSize: 10, color: "#888" }}>上班</label><input type="time" value={sf2.start_time} onChange={e => setSf2({ ...sf2, start_time: e.target.value })} style={{ width: "100%", padding: "4px", borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }} /></div>
            <div><label style={{ fontSize: 10, color: "#888" }}>下班</label><input type="time" value={sf2.end_time} onChange={e => setSf2({ ...sf2, end_time: e.target.value })} style={{ width: "100%", padding: "4px", borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }} /></div>
            <div><label style={{ fontSize: 10, color: "#888" }}>休息(分)</label><input type="number" value={sf2.break_minutes} onChange={e => setSf2({ ...sf2, break_minutes: Number(e.target.value) })} style={{ width: "100%", padding: "4px", borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }} /></div>
          </div><button onClick={saveShift} style={{ padding: "4px 14px", borderRadius: 4, border: "none", background: "#0a7c42", color: "#fff", fontSize: 11, cursor: "pointer" }}>{es ? "💾 儲存" : "建立"}</button></div>}
          {stores.filter(s => !sf || s.id === sf).map(store => {
            const storeShifts = shifts.filter(s => s.store_id === store.id);
            if (storeShifts.length === 0) return null;
            return <div key={store.id} style={{ marginBottom: 10 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 4, padding: "4px 8px", background: "#faf8f5", borderRadius: 4 }}>{"🏠 " + store.name + "（" + storeShifts.length + "個班別）"}</h4>
              <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#faf8f5" }}>{["班別", "角色", "時間", "休息", "操作"].map(h => <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}</tr></thead>
                <tbody>{storeShifts.map(s => <tr key={s.id} style={{ borderBottom: "1px solid #f0eeea" }}><td style={{ padding: 6, fontWeight: 500 }}>{s.name}</td><td style={{ padding: 6 }}><span style={{ padding: "1px 5px", borderRadius: 3, fontSize: 10, background: s.role === "all" ? "#f0f0f0" : "#fef9c3", color: s.role === "all" ? "#666" : "#8a6d00" }}>{s.role === "all" ? "全場" : s.role || "全場"}</span></td><td style={{ padding: 6 }}>{(s.start_time || "").slice(0, 5) + "~" + (s.end_time || "").slice(0, 5)}</td><td style={{ padding: 6 }}>{s.break_minutes + "分"}</td><td style={{ padding: 6 }}><button onClick={() => editShift(s)} style={{ padding: "1px 5px", borderRadius: 3, border: "1px solid #ddd", background: "transparent", cursor: "pointer", fontSize: 10, marginRight: 2 }}>✏️</button><button onClick={() => delShift(s.id)} style={{ padding: "1px 5px", borderRadius: 3, border: "1px solid #ddd", background: "transparent", cursor: "pointer", fontSize: 10, color: "#b91c1c" }}>🗑</button></td></tr>)}</tbody></table>
              </div>
            </div>;
          })}
        </div>}

        {!ld && tab === "attendance" && <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#faf8f5" }}>{["時間", "員工", "門市", "類型", "距離", "遲到"].map(h => <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}</tr></thead><tbody>{att.map(a => <tr key={a.id} style={{ borderBottom: "1px solid #f0eeea" }}><td style={{ padding: 6, fontSize: 10 }}>{new Date(a.timestamp).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</td><td style={{ padding: 6, fontWeight: 500 }}>{a.employees ? a.employees.name : ""}</td><td style={{ padding: 6 }}>{a.stores ? a.stores.name : ""}</td><td style={{ padding: 6 }}>{a.type === "clock_in" ? "🟢上班" : "🔴下班"}</td><td style={{ padding: 6 }}>{a.distance_meters ? Math.round(a.distance_meters) + "m" : "-"}</td><td style={{ padding: 6, color: a.late_minutes > 0 ? "#b91c1c" : "#0a7c42" }}>{a.late_minutes > 0 ? a.late_minutes + "分" : "準時"}</td></tr>)}</tbody></table></div>}

        {!ld && tab === "worklogs" && <WorklogMgr stores={stores} sf={sf} month={month} load={load} role={auth.role} lockedStore={auth.role === "store_manager" ? sf : ""} />}

        {!ld && tab === "expenses" && <div>
          <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
            {[["all", "全部"], ["petty_cash", "💰零用金"], ["vendor", "📦月結單據"], ["hq_advance", "🏢總部代付"]].map(([k, l]) => <button key={k} onClick={() => setExpType(k)} style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid #ddd", background: expType === k ? "#1a1a1a" : "#fff", color: expType === k ? "#fff" : "#666", fontSize: 11, cursor: "pointer" }}>{l}</button>)}
            <input value={expSearch} onChange={e => setExpSearch(e.target.value)} placeholder="搜尋廠商..." style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid #ddd", fontSize: 11, width: 120 }} />
            <button onClick={() => { const filtered = exps.filter(e => (expType === "all" || e.expense_type === expType) && (!expSearch || (e.vendor_name || "").includes(expSearch))); const csv = "\uFEFF日期,門市,類型,廠商,說明,金額,狀態\n" + filtered.map(e => [e.date, e.stores ? e.stores.name : "", e.expense_type === "vendor" ? "月結" : e.expense_type === "hq_advance" ? "總部代付" : "零用金", e.vendor_name || "", (e.description || "").replace(/,/g, " "), e.amount, e.status].join(",")).join("\n"); const blob = new Blob([csv], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = month + "_費用明細.csv"; a.click(); }} style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid #0a7c42", background: "transparent", color: "#0a7c42", fontSize: 11, cursor: "pointer" }}>{"📥 匯出CSV"}</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
            <div style={{ background: "#fff8e6", borderRadius: 8, padding: "8px 12px" }}><div style={{ fontSize: 10, color: "#8a6d00" }}>💰 零用金</div><div style={{ fontSize: 15, fontWeight: 600 }}>{fmt(exps.filter(e => e.expense_type === "petty_cash").reduce((s, e) => s + Number(e.amount || 0), 0))}</div></div>
            <div style={{ background: "#e6f1fb", borderRadius: 8, padding: "8px 12px" }}><div style={{ fontSize: 10, color: "#185fa5" }}>📦 月結</div><div style={{ fontSize: 15, fontWeight: 600 }}>{fmt(exps.filter(e => e.expense_type === "vendor").reduce((s, e) => s + Number(e.amount || 0), 0))}</div></div>
            <div style={{ background: "#fde8e8", borderRadius: 8, padding: "8px 12px" }}><div style={{ fontSize: 10, color: "#b91c1c" }}>🏢 總部代付</div><div style={{ fontSize: 15, fontWeight: 600 }}>{fmt(exps.filter(e => e.expense_type === "hq_advance").reduce((s, e) => s + Number(e.amount || 0), 0))}</div></div>
          </div>
          {(() => {
            const catTotals = {}; exps.forEach(e => { const c = e.category_suggestion || e.expense_categories?.name || "未分類"; catTotals[c] = (catTotals[c] || 0) + Number(e.amount || 0); });
            const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
            const total = sorted.reduce((s, [, v]) => s + v, 0);
            const colors = ["#4361ee", "#0a7c42", "#b45309", "#b91c1c", "#8a6d00", "#993556", "#185fa5", "#666"];
            return sorted.length > 0 ? <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 8 }}>
              <h4 style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>{"📊 費用分類佔比"}</h4>
              <div style={{ height: 12, borderRadius: 6, overflow: "hidden", display: "flex", marginBottom: 8 }}>
                {sorted.map(([cat, amt], i) => <div key={cat} style={{ width: (amt / total * 100) + "%", background: colors[i % colors.length], minWidth: 2 }} title={cat + " " + fmt(amt)} />)}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {sorted.slice(0, 8).map(([cat, amt], i) => <div key={cat} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[i % colors.length] }} />
                  <span>{cat}</span><span style={{ fontWeight: 600 }}>{fmt(amt)}</span><span style={{ color: "#888" }}>{"(" + Math.round(amt / total * 100) + "%)"}</span>
                </div>)}
              </div>
            </div> : null;
          })()}
          {(() => { const filtered = exps.filter(e => (expType === "all" || e.expense_type === expType) && (!expSearch || (e.vendor_name || "").includes(expSearch) || (e.description || "").includes(expSearch))); return <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#faf8f5" }}>{["日期", "門市", "類型", "廠商/說明", "提交人", "金額", "狀態", "操作"].map(h => <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}</tr></thead><tbody>{filtered.length === 0 && <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: "#ccc" }}>無紀錄</td></tr>}{filtered.map(e => <tr key={e.id} style={{ borderBottom: "1px solid #f0eeea" }}><td style={{ padding: 6 }}>{e.date}</td><td style={{ padding: 6 }}>{e.stores ? e.stores.name : ""}</td><td style={{ padding: 6 }}>{e.expense_type === "vendor" ? "📦月結" : e.expense_type === "hq_advance" ? "🏢代付" : "💰零用金"}</td><td style={{ padding: 6 }}><div style={{ fontWeight: 500 }}>{e.vendor_name || "-"}</div>{e.description && <div style={{ fontSize: 9, color: "#888" }}>{e.description}</div>}</td><td style={{ padding: 6, fontSize: 10 }}>{e.submitted_by_name || (e.employees ? e.employees.name : "-")}</td><td style={{ padding: 6, fontWeight: 600 }}>{e.image_url ? <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => setSi(e.image_url)}>{fmt(e.amount)}</span> : fmt(e.amount)}</td><td style={{ padding: 6 }}><Badge status={e.status} /></td><td style={{ padding: 6 }}>{e.status === "pending" && <span><button onClick={() => rvExp(e.id, "approved")} style={{ padding: "1px 6px", borderRadius: 3, border: "none", background: "#0a7c42", color: "#fff", fontSize: 9, cursor: "pointer", marginRight: 2 }}>✅</button><button onClick={() => rvExp(e.id, "rejected")} style={{ padding: "1px 6px", borderRadius: 3, border: "none", background: "#b91c1c", color: "#fff", fontSize: 9, cursor: "pointer" }}>❌</button></span>}</td></tr>)}</tbody></table></div>; })()}
        </div>}

        {!ld && tab === "overtime" && <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{"⏱ " + month + " 加班紀錄"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: "8px 12px" }}><div style={{ fontSize: 10, color: "#888" }}>加班筆數</div><div style={{ fontSize: 18, fontWeight: 600 }}>{otSum.count || 0}</div></div>
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: "8px 12px" }}><div style={{ fontSize: 10, color: "#888" }}>總加班時數</div><div style={{ fontSize: 18, fontWeight: 600 }}>{Math.round((otSum.totalMinutes || 0) / 60 * 10) / 10 + "hr"}</div></div>
            <div style={{ background: "#fff8e6", borderRadius: 8, padding: "8px 12px" }}><div style={{ fontSize: 10, color: "#8a6d00" }}>加班費合計</div><div style={{ fontSize: 18, fontWeight: 600 }}>{fmt(otSum.totalAmount)}</div></div>
          </div>
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#faf8f5" }}>{["日期", "員工", "門市", "加班時數", "類型", "費率", "金額", "狀態"].map(h => <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}</tr></thead>
          <tbody>{otRecords.length === 0 ? <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: "#ccc" }}>本月無加班紀錄</td></tr> : otRecords.map(r => <tr key={r.id} style={{ borderBottom: "1px solid #f0eeea" }}><td style={{ padding: 6 }}>{r.date}</td><td style={{ padding: 6, fontWeight: 500 }}>{r.employees ? r.employees.name : ""}</td><td style={{ padding: 6 }}>{r.stores ? r.stores.name : ""}</td><td style={{ padding: 6 }}>{Math.round(r.overtime_minutes / 60 * 10) / 10 + "hr"}</td><td style={{ padding: 6 }}>{r.overtime_type === "weekday_1" ? "平日" : r.overtime_type === "rest_1" ? "休息日" : r.overtime_type === "holiday" ? "國定假日" : r.overtime_type}</td><td style={{ padding: 6 }}>{r.rate + "倍"}</td><td style={{ padding: 6, fontWeight: 600 }}>{fmt(r.amount)}</td><td style={{ padding: 6 }}><Badge status={r.status} /></td></tr>)}</tbody></table></div>
          <p style={{ fontSize: 10, color: "#999", marginTop: 6 }}>{"* 加班費率：平日前2hr 1.34倍/後2hr 1.67倍、休息日前2hr 1.34倍/後6hr 1.67倍、國定假日 2倍"}</p>
          {(() => { const byEmp = {}; otRecords.forEach(r => { const n = r.employees ? r.employees.name : "?"; byEmp[n] = (byEmp[n] || 0) + (r.overtime_minutes || 0); }); const over = Object.entries(byEmp).filter(([, m]) => m > 46 * 60); return over.length > 0 ? <div style={{ background: "#fde8e8", borderRadius: 6, padding: 8, marginTop: 8, fontSize: 11, color: "#b91c1c" }}>{"⚠️ 月加班超過46小時上限：" + over.map(([n, m]) => n + "（" + Math.round(m / 60) + "hr）").join("、")}</div> : null; })()}
        </div>}

        {!ld && tab === "payments" && <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{"💳 " + month + " 撥款追蹤"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
            <div style={{ background: "#fff8e6", borderRadius: 8, padding: "8px 12px" }}><div style={{ fontSize: 10, color: "#8a6d00" }}>待撥款</div><div style={{ fontSize: 18, fontWeight: 600, color: "#b91c1c" }}>{fmt(pmtSum.pending)}</div></div>
            <div style={{ background: "#e6f9f0", borderRadius: 8, padding: "8px 12px" }}><div style={{ fontSize: 10, color: "#0a7c42" }}>已撥款</div><div style={{ fontSize: 18, fontWeight: 600, color: "#0a7c42" }}>{fmt(pmtSum.paid)}</div></div>
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: "8px 12px" }}><div style={{ fontSize: 10, color: "#888" }}>總金額</div><div style={{ fontSize: 18, fontWeight: 600 }}>{fmt(pmtSum.total)}</div></div>
          </div>
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#faf8f5" }}>{["類型", "對象", "門市", "金額", "狀態", "撥款日", "操作"].map(h => <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}</tr></thead>
          <tbody>{pmtRecords.length === 0 ? <tr><td colSpan={7} style={{ padding: 30, textAlign: "center", color: "#ccc" }}>本月無撥款紀錄</td></tr> : pmtRecords.map(p => <tr key={p.id} style={{ borderBottom: "1px solid #f0eeea" }}><td style={{ padding: 6 }}>{p.type === "salary" ? "💰薪資" : p.type === "vendor" ? "📦廠商" : p.type === "petty_cash" ? "💰零用金" : "🏢" + p.type}</td><td style={{ padding: 6, fontWeight: 500 }}>{p.recipient || (p.employees ? p.employees.name : "-")}</td><td style={{ padding: 6 }}>{p.stores ? p.stores.name : "-"}</td><td style={{ padding: 6, fontWeight: 600 }}>{fmt(p.amount)}</td><td style={{ padding: 6 }}><Badge status={p.status} /></td><td style={{ padding: 6 }}>{p.paid_date || "-"}</td><td style={{ padding: 6 }}>{p.status === "pending" && <button onClick={async () => { await ap("/api/admin/payments", { action: "mark_paid", payment_id: p.id }); load(); }} style={{ padding: "1px 6px", borderRadius: 3, border: "none", background: "#0a7c42", color: "#fff", fontSize: 9, cursor: "pointer" }}>{"✅ 已撥"}</button>}</td></tr>)}</tbody></table></div>
        </div>}

        {!ld && tab === "payroll" && <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{"💰 " + month + " 薪資核算"}</h3>
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead><tr style={{ background: "#faf8f5" }}>{["員工", "門市", "底薪/時薪", "出勤", "加班費", "應發", "勞保", "健保", "實發"].map(h => <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}</tr></thead>
              <tbody>{ae.length === 0 ? <tr><td colSpan={9} style={{ padding: 30, textAlign: "center", color: "#ccc" }}>無員工</td></tr> : ae.map(e => {
                const workDays = att.filter(a => a.employees && a.employees.name === e.name && a.type === "clock_in").length;
                const basePay = e.monthly_salary ? Number(e.monthly_salary) : (e.hourly_rate ? Number(e.hourly_rate) * workDays * 8 : 0);
                const otPay = otRecords.filter(r => r.employee_id === e.id && r.status === "approved").reduce((s, r) => s + Number(r.amount || 0), 0);
                const gross = basePay + otPay;
                const laborSelf = e.labor_tier ? [690, 723, 761, 799, 836, 874, 912, 959, 1007, 1055, 1103, 1150][e.labor_tier - 1] || 0 : 0;
                const healthSelf = e.health_tier ? [438, 459, 483, 507, 531, 555, 579, 609, 640, 670, 700, 730][e.health_tier - 1] || 0 : 0;
                const netPay = gross - laborSelf - healthSelf;
                return <tr key={e.id} style={{ borderBottom: "1px solid #f0eeea" }}>
                  <td style={{ padding: 6, fontWeight: 500 }}>{e.name}</td>
                  <td style={{ padding: 6 }}>{e.stores ? e.stores.name : "總部"}</td>
                  <td style={{ padding: 6, fontSize: 10 }}>{e.monthly_salary ? "月" + fmt(e.monthly_salary) : e.hourly_rate ? "時" + fmt(e.hourly_rate) : "-"}</td>
                  <td style={{ padding: 6 }}>{workDays + "天"}</td>
                  <td style={{ padding: 6, color: otPay > 0 ? "#b45309" : "#ccc" }}>{otPay > 0 ? "+" + fmt(otPay) : "-"}</td>
                  <td style={{ padding: 6, fontWeight: 600 }}>{fmt(gross)}</td>
                  <td style={{ padding: 6, color: "#b45309", fontSize: 10 }}>{laborSelf > 0 ? "-" + fmt(laborSelf) : "-"}</td>
                  <td style={{ padding: 6, color: "#0a7c42", fontSize: 10 }}>{healthSelf > 0 ? "-" + fmt(healthSelf) : "-"}</td>
                  <td style={{ padding: 6, fontWeight: 700, fontSize: 13 }}>{fmt(netPay)}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          {(() => { let totalGross = 0, totalDeduct = 0; ae.forEach(e => { const wd = att.filter(a => a.employees && a.employees.name === e.name && a.type === "clock_in").length; const bp = e.monthly_salary ? Number(e.monthly_salary) : (e.hourly_rate ? Number(e.hourly_rate) * wd * 8 : 0); const ot = otRecords.filter(r => r.employee_id === e.id && r.status === "approved").reduce((s, r) => s + Number(r.amount || 0), 0); totalGross += bp + ot; const ls = e.labor_tier ? [690, 723, 761, 799, 836, 874, 912, 959, 1007, 1055, 1103, 1150][e.labor_tier - 1] || 0 : 0; const hs = e.health_tier ? [438, 459, 483, 507, 531, 555, 579, 609, 640, 670, 700, 730][e.health_tier - 1] || 0 : 0; totalDeduct += ls + hs; }); return <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: "10px 14px" }}><div style={{ fontSize: 10, color: "#888" }}>應發合計</div><div style={{ fontSize: 18, fontWeight: 600 }}>{fmt(totalGross)}</div></div>
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: "10px 14px" }}><div style={{ fontSize: 10, color: "#888" }}>扣除合計</div><div style={{ fontSize: 18, fontWeight: 600, color: "#b91c1c" }}>{fmt(totalDeduct)}</div></div>
            <div style={{ background: "#e6f9f0", borderRadius: 8, padding: "10px 14px" }}><div style={{ fontSize: 10, color: "#888" }}>實發合計</div><div style={{ fontSize: 18, fontWeight: 700, color: "#0a7c42" }}>{fmt(totalGross - totalDeduct)}</div></div>
          </div>; })()}
          <p style={{ fontSize: 10, color: "#999", marginTop: 8 }}>{"* 出勤依打卡｜時薪×天數×8hr｜加班費依核准紀錄｜勞健保依一般級距自付額"}</p>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={async () => { if (!confirm("確定發送薪資條到所有員工LINE？")) return; for (const e of ae) { if (!e.line_uid) continue; const wd = att.filter(a => a.employees && a.employees.name === e.name && a.type === "clock_in").length; const bp = e.monthly_salary ? Number(e.monthly_salary) : (e.hourly_rate ? Number(e.hourly_rate) * wd * 8 : 0); const ot = otRecords.filter(r => r.employee_id === e.id && r.status === "approved").reduce((s, r) => s + Number(r.amount || 0), 0); const ls = e.labor_tier ? [690,723,761,799,836,874,912,959,1007,1055,1103,1150][e.labor_tier-1]||0:0; const hs = e.health_tier ? [438,459,483,507,531,555,579,609,640,670,700,730][e.health_tier-1]||0:0; const net = bp + ot - ls - hs; try { await fetch("/api/webhook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "push_text", line_uid: e.line_uid, text: "💰 " + month + " 薪資條\n━━━━━━━━━━━━\n👤 " + e.name + "\n📅 出勤 " + wd + " 天\n💵 底薪 $" + bp.toLocaleString() + (ot > 0 ? "\n⏱ 加班費 +$" + ot.toLocaleString() : "") + (ls > 0 ? "\n🛡 勞保 -$" + ls.toLocaleString() : "") + (hs > 0 ? "\n🏥 健保 -$" + hs.toLocaleString() : "") + "\n━━━━━━━━━━━━\n💰 實發 $" + net.toLocaleString() }) }); } catch(ex) {} } alert("已發送 " + ae.filter(e => e.line_uid).length + " 位員工的薪資條"); }} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#4361ee", color: "#fff", fontSize: 11, cursor: "pointer" }}>{"📱 LINE發送薪資條"}</button>
          </div>
        </div>}

        {!ld && tab === "pnl" && pnl && <div style={{ maxWidth: 500 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{"📊 " + month + " 損益表"}</h3>
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 14, marginBottom: 10 }}>
            <h4 style={{ fontSize: 13, color: "#0a7c42", marginBottom: 8 }}>收入</h4>
            <Row l="營業收入" v={<b style={{ color: "#0a7c42" }}>{fmt(pnl.revenue ? pnl.revenue.total : 0)}</b>} />
          </div>
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 14, marginBottom: 10 }}>
            <h4 style={{ fontSize: 13, color: "#b91c1c", marginBottom: 8 }}>支出</h4>
            <Row l="月結廠商" v={fmt(pnl.expenses ? pnl.expenses.vendor : 0)} />
            <Row l="零用金" v={fmt(pnl.expenses ? pnl.expenses.petty_cash : 0)} />
            <Row l="總部代付" v={fmt(pnl.expenses ? pnl.expenses.hq_advance : 0)} />
            <Row l="人事成本" v={fmt(pnl.expenses ? pnl.expenses.labor : 0)} />
            <Row l="加班費" v={fmt(otSum.totalAmount || 0)} />
            <Row l="支出合計" v={<b style={{ color: "#b91c1c" }}>{fmt(pnl.expenses ? pnl.expenses.total : 0)}</b>} />
          </div>
          <div style={{ background: (pnl.profit ? pnl.profit.net : 0) >= 0 ? "#e6f9f0" : "#fde8e8", borderRadius: 8, padding: 14 }}>
            <Row l="淨利" v={<b style={{ fontSize: 18, color: (pnl.profit ? pnl.profit.net : 0) >= 0 ? "#0a7c42" : "#b91c1c" }}>{fmt(pnl.profit ? pnl.profit.net : 0)}</b>} />
            <Row l="利潤率" v={(pnl.profit ? pnl.profit.margin : 0) + "%"} />
          </div>
        </div>}

        {!ld && tab === "announcements" && <div>
          {(auth.role === "admin" || auth.role === "manager") && <button onClick={() => setShowAnnForm(!showAnnForm)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #ddd", background: showAnnForm ? "#f0f0f0" : "#1a1a1a", color: showAnnForm ? "#666" : "#fff", fontSize: 11, cursor: "pointer", marginBottom: 8 }}>{showAnnForm ? "✕" : "＋新增公告"}</button>}
          {showAnnForm && <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 8 }}>
            <div style={{ marginBottom: 6 }}><label style={{ fontSize: 10, color: "#888" }}>標題*</label><input value={newAnn.title} onChange={e => setNewAnn({ ...newAnn, title: e.target.value })} style={{ width: "100%", padding: 5, borderRadius: 4, border: "1px solid #ddd", fontSize: 12 }} /></div>
            <div style={{ marginBottom: 6 }}><label style={{ fontSize: 10, color: "#888" }}>內容*</label><textarea value={newAnn.content} onChange={e => setNewAnn({ ...newAnn, content: e.target.value })} rows={3} style={{ width: "100%", padding: 5, borderRadius: 4, border: "1px solid #ddd", fontSize: 12 }} /></div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <div style={{ flex: 1 }}><label style={{ fontSize: 10, color: "#888" }}>門市</label><select value={newAnn.store_id} onChange={e => setNewAnn({ ...newAnn, store_id: e.target.value })} style={{ width: "100%", padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}><option value="">全部</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div style={{ flex: 1 }}><label style={{ fontSize: 10, color: "#888" }}>優先級</label><select value={newAnn.priority} onChange={e => setNewAnn({ ...newAnn, priority: e.target.value })} style={{ width: "100%", padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}><option value="normal">一般</option><option value="urgent">急件</option></select></div>
            </div>
            <button onClick={addAnn} disabled={!newAnn.title || !newAnn.content} style={{ padding: "5px 14px", borderRadius: 4, border: "none", background: newAnn.title && newAnn.content ? "#0a7c42" : "#ccc", color: "#fff", fontSize: 11, cursor: "pointer" }}>發布</button>
          </div>}
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1" }}>{anns.filter(a => !sf || !a.store_id || a.store_id === sf).length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#ccc" }}>尚無公告</div> : anns.filter(a => !sf || !a.store_id || a.store_id === sf).map(a => <div key={a.id} style={{ padding: 10, borderBottom: "1px solid #f0eeea", display: "flex", gap: 8 }}><div style={{ flex: 1 }}>{a.priority === "urgent" && <span style={{ background: "#b91c1c", color: "#fff", padding: "1px 5px", borderRadius: 3, fontSize: 9, marginRight: 4 }}>急</span>}{a.store_id && <span style={{ background: "#e6f1fb", color: "#185fa5", padding: "1px 5px", borderRadius: 3, fontSize: 9, marginRight: 4 }}>{stores.find(s => s.id === a.store_id) ? stores.find(s => s.id === a.store_id).name : "門市"}</span>}<b style={{ fontSize: 13 }}>{a.title}</b><p style={{ fontSize: 12, color: "#555", marginTop: 3 }}>{a.content}</p><span style={{ fontSize: 10, color: "#aaa" }}>{new Date(a.created_at).toLocaleDateString("zh-TW")}</span></div>{(auth.role === "admin" || auth.role === "manager") && <button onClick={() => delAnn(a.id)} style={{ padding: "2px 6px", borderRadius: 3, border: "1px solid #ddd", background: "transparent", cursor: "pointer", fontSize: 10, color: "#b91c1c" }}>🗑</button>}</div>)}</div>
        </div>}

        {!ld && tab === "settings" && <Settings stores={stores} as2={as2} upS={upS} />}

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
