"use client";
import { useState, useEffect } from "react";

export default function WorkLogPage() {
  const [token, setToken] = useState(null);
  const [empId, setEmpId] = useState(null);
  const [storeId, setStoreId] = useState(null);
  const [empName, setEmpName] = useState("");
  const [templates, setTemplates] = useState([]);
  const [checked, setChecked] = useState({});
  const [notes, setNotes] = useState("");
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const eid = p.get("eid"), sid = p.get("sid"), name = p.get("name");
    setEmpId(eid); setStoreId(sid); setEmpName(name || "");

    Promise.all([
      fetch(`/api/admin/worklogs?type=templates&store_id=${sid}`).then(r => r.json()),
      fetch(`/api/admin/worklogs?type=log&employee_id=${eid}&date=${today}`).then(r => r.json()),
      fetch("/api/admin/announcements").then(r => r.json()),
    ]).then(([t, l, a]) => {
      setTemplates(t.data || []);
      setAnnouncements(a.data || []);
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

  const grouped = {};
  for (const t of templates) { if (!grouped[t.category]) grouped[t.category] = []; grouped[t.category].push(t); }

  if (loading) return <div style={S.c}>載入中...</div>;

  return (
    <div style={S.box}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 28, marginBottom: 4 }}>🍯</div>
        <h1 style={{ fontSize: 16, fontWeight: 600 }}>每日工作日誌</h1>
        <p style={{ fontSize: 12, color: "#999" }}>👤 {empName}｜📅 {today}</p>
      </div>

      {/* 公布欄 */}
      {announcements.length > 0 && (
        <div style={{ background: "#fff8e6", borderRadius: 10, padding: 12, marginBottom: 14, border: "1px solid #fbbf2440" }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>📢 公布欄</h3>
          {announcements.map(a => (
            <div key={a.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #f0eeea" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {a.priority === "urgent" && <span style={{ background: "#b91c1c", color: "#fff", padding: "1px 6px", borderRadius: 4, fontSize: 10 }}>急</span>}
                <span style={{ fontSize: 13, fontWeight: 500 }}>{a.title}</span>
              </div>
              <p style={{ fontSize: 12, color: "#555", marginTop: 4, lineHeight: 1.6 }}>{a.content}</p>
              <span style={{ fontSize: 10, color: "#aaa" }}>{new Date(a.created_at).toLocaleDateString("zh-TW")}</span>
            </div>
          ))}
        </div>
      )}

      {submitted && <div style={{ background: "#e6f9f0", borderRadius: 10, padding: 12, marginBottom: 14, textAlign: "center" }}>
        <span style={{ fontSize: 14, color: "#0a7c42", fontWeight: 500 }}>✅ 今日工作日誌已提交</span>
      </div>}

      {/* 工作清單 */}
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: 12, marginBottom: 10 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 8 }}>{cat}</h3>
          {items.map(t => (
            <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #f5f3f0", cursor: "pointer" }}>
              <input type="checkbox" checked={!!checked[t.item]} onChange={() => toggle(t.item)} style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 13, color: checked[t.item] ? "#0a7c42" : "#444", textDecoration: checked[t.item] ? "line-through" : "none" }}>{t.item}</span>
            </label>
          ))}
        </div>
      ))}

      {templates.length === 0 && <div style={{ background: "#fff", borderRadius: 10, padding: 20, textAlign: "center", color: "#ccc", marginBottom: 10 }}>尚未設定工作項目</div>}

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: 12, marginBottom: 10 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>📝 備註</h3>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="今日特殊事項或備註..." rows={3} style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", fontSize: 13, resize: "vertical" }} />
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
const S = { box: { maxWidth: 460, margin: "0 auto", padding: "16px 12px", fontFamily: "system-ui,'Noto Sans TC',sans-serif", background: "#faf8f5", minHeight: "100vh" }, c: { minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" } };
