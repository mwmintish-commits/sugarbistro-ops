"use client";
import { useState, useEffect } from "react";

export default function WorkLogPage() {
  const [empId, setEmpId] = useState(null);
  const [storeId, setStoreId] = useState(null);
  const [empName, setEmpName] = useState("");
  const [empRole, setEmpRole] = useState("all");
  const [templates, setTemplates] = useState([]);
  const [checked, setChecked] = useState({});
  const [notes, setNotes] = useState("");
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shiftType, setShiftType] = useState("opening");
  const [revenue, setRevenue] = useState({ dt: 0, mt: 0, ta: 0, mm: 0 });
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const thisMonth = today.slice(0, 7);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const eid = p.get("eid"), sid = p.get("sid"), name = p.get("name"), role = p.get("role") || "all";
    setEmpId(eid); setStoreId(sid); setEmpName(name || ""); setEmpRole(role);

    Promise.all([
      fetch("/api/admin/worklogs?type=templates&store_id=" + sid).then(r => r.json()),
      fetch("/api/admin/worklogs?type=log&employee_id=" + eid + "&date=" + today).then(r => r.json()),
      fetch("/api/admin/announcements").then(r => r.json()),
      fetch("/api/admin/stores").then(r => r.json()).catch(() => ({ data: [] })),
      fetch("/api/admin/settlements?store_id=" + sid + "&month=" + thisMonth).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([t, l, a, st, stl]) => {
      setTemplates(t.data || []);
      setAnnouncements(a.data || []);
      const store = (st.data || []).find(s => s.id === sid);
      const todayS = (stl.data || []).find(s => s.date === today);
      const monthS = (stl.data || []).reduce((s, r) => s + Number(r.net_sales || 0), 0);
      const dailyT = store ? Number(store.daily_target || 0) : 0;
      const daysInMonth = new Date(parseInt(thisMonth.split("-")[0]), parseInt(thisMonth.split("-")[1]), 0).getDate();
      setRevenue({ dt: dailyT, mt: dailyT * daysInMonth, ta: todayS ? Number(todayS.net_sales || 0) : 0, mm: monthS });
      if (l.data?.items) {
        const c = {};
        for (const item of l.data.items) c[item] = true;
        setChecked(c);
        setNotes(l.data.notes || "");
        if (l.data.submitted_at) setSubmitted(true);
      }
      setLoading(false);
    });
  }, []);

  const toggle = (item) => setChecked(p => ({ ...p, [item]: !p[item] }));

  const submit = async () => {
    setSubmitting(true);
    const items = Object.entries(checked).filter(([, v]) => v).map(([k]) => k);
    await fetch("/api/admin/worklogs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit", employee_id: empId, store_id: storeId, date: today, items, notes }),
    });
    setSubmitted(true); setSubmitting(false);
  };

  // 篩選：只顯示 opening/during 或 closing，並且符合角色
  const filtered = templates.filter(t => {
    const matchShift = (t.shift_type || "opening") === shiftType || t.shift_type === "during";
    const matchRole = !t.role || t.role === "all" || t.role === empRole;
    if (shiftType === "opening") return (t.shift_type === "opening" || t.shift_type === "during") && matchRole;
    if (shiftType === "closing") return t.shift_type === "closing" && matchRole;
    return matchRole;
  });

  const grouped = {};
  for (const t of filtered) { if (!grouped[t.category]) grouped[t.category] = []; grouped[t.category].push(t); }

  if (loading) return <div style={S.c}>載入中...</div>;

  return (
    <div style={S.box}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 28 }}>🍯</div>
        <h1 style={{ fontSize: 16, fontWeight: 600 }}>每日工作日誌</h1>
        <p style={{ fontSize: 12, color: "#999" }}>👤 {empName}｜📅 {today}</p>
      </div>

      {/* 公布欄 - 最上面 */}
      {announcements.length > 0 && (
        <div style={{ background: "#fff8e6", borderRadius: 10, padding: 12, marginBottom: 12, border: "1px solid #fbbf2440" }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>📢 公布欄</h3>
          {announcements.map(a => (
            <div key={a.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #f0eeea" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {a.priority === "urgent" && <span style={{ background: "#b91c1c", color: "#fff", padding: "1px 6px", borderRadius: 4, fontSize: 10 }}>急</span>}
                <span style={{ fontSize: 13, fontWeight: 500 }}>{a.title}</span>
              </div>
              <p style={{ fontSize: 12, color: "#555", marginTop: 4, lineHeight: 1.6 }}>{a.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* 切換：開店/打烊 */}
      {(revenue.dt > 0 || revenue.mt > 0) && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
        <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 8, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#888" }}>今日營收 / 目標</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: revenue.dt > 0 && revenue.ta >= revenue.dt ? "#0a7c42" : "#b91c1c" }}>{"$" + revenue.ta.toLocaleString()}</div>
          {revenue.dt > 0 && <div style={{ fontSize: 11, color: "#888" }}>{"目標 $" + revenue.dt.toLocaleString()}</div>}
          {revenue.dt > 0 && <div style={{ marginTop: 4, height: 6, background: "#f0f0f0", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: Math.min(100, Math.round(revenue.ta / revenue.dt * 100)) + "%", background: revenue.ta >= revenue.dt ? "#0a7c42" : "#fbbf24", borderRadius: 3 }} /></div>}
          {revenue.dt > 0 && <div style={{ fontSize: 12, fontWeight: 600, color: revenue.ta >= revenue.dt ? "#0a7c42" : "#b45309", marginTop: 2 }}>{Math.round(revenue.ta / revenue.dt * 100) + "% 達標率"}</div>}
        </div>
        <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 8, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#888" }}>本月累積 / 目標</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: revenue.mt > 0 && revenue.mm >= revenue.mt ? "#0a7c42" : "#1a1a1a" }}>{"$" + revenue.mm.toLocaleString()}</div>
          {revenue.mt > 0 && <div style={{ fontSize: 11, color: "#888" }}>{"目標 $" + revenue.mt.toLocaleString()}</div>}
          {revenue.mt > 0 && <div style={{ marginTop: 4, height: 6, background: "#f0f0f0", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: Math.min(100, Math.round(revenue.mm / revenue.mt * 100)) + "%", background: revenue.mm >= revenue.mt ? "#0a7c42" : "#4361ee", borderRadius: 3 }} /></div>}
          {revenue.mt > 0 && <div style={{ fontSize: 12, fontWeight: 600, color: revenue.mm >= revenue.mt ? "#0a7c42" : "#185fa5", marginTop: 2 }}>{Math.round(revenue.mm / revenue.mt * 100) + "% 達標率"}</div>}
        </div>
      </div>}

      {/* 切換：開店/打烊 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button onClick={() => setShiftType("opening")} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid #ddd", background: shiftType === "opening" ? "#1a1a1a" : "#fff", color: shiftType === "opening" ? "#fff" : "#666", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>☀️ 開店/營業</button>
        <button onClick={() => setShiftType("closing")} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid #ddd", background: shiftType === "closing" ? "#1a1a1a" : "#fff", color: shiftType === "closing" ? "#fff" : "#666", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>🌙 打烊作業</button>
      </div>

      {submitted && <div style={{ background: "#e6f9f0", borderRadius: 10, padding: 10, marginBottom: 10, textAlign: "center" }}>
        <span style={{ fontSize: 13, color: "#0a7c42", fontWeight: 500 }}>✅ 今日已提交</span>
      </div>}

      {/* 工作清單 */}
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: 12, marginBottom: 8 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 6 }}>{cat}</h3>
          {items.map(t => (
            <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid #f5f3f0", cursor: "pointer" }}>
              <input type="checkbox" checked={!!checked[t.item]} onChange={() => toggle(t.item)} style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 13, color: checked[t.item] ? "#0a7c42" : "#444", textDecoration: checked[t.item] ? "line-through" : "none" }}>{t.item}</span>
            </label>
          ))}
        </div>
      ))}

      {filtered.length === 0 && <div style={{ background: "#fff", borderRadius: 10, padding: 20, textAlign: "center", color: "#ccc" }}>尚未設定工作項目，請主管到後台新增</div>}

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: 10, marginBottom: 8 }}>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="備註..." rows={2} style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #ddd", fontSize: 12, resize: "vertical" }} />
      </div>

      <button onClick={submit} disabled={submitting || submitted} style={{
        width: "100%", padding: "12px", borderRadius: 10, border: "none", fontSize: 15, fontWeight: 600, cursor: submitted ? "default" : "pointer",
        background: submitted ? "#ccc" : "#0a7c42", color: "#fff",
      }}>
        {submitted ? "✅ 已提交" : submitting ? "提交中..." : "📋 提交工作日誌"}
      </button>
    </div>
  );
}
const S = { box: { maxWidth: 460, margin: "0 auto", padding: "14px 10px", fontFamily: "system-ui, sans-serif", background: "#faf8f5", minHeight: "100vh" }, c: { minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" } };
