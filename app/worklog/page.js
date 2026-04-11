"use client";
import { useState, useEffect, useCallback } from "react";

const FREQ_TABS = [
  { id: "daily", label: "📋 每日", icon: "📋" },
  { id: "weekly", label: "🗓 週清", icon: "🗓" },
  { id: "monthly", label: "📅 月清", icon: "📅" },
  { id: "incident", label: "⚠️ 異常", icon: "⚠️" },
];

export default function WorkLogPage() {
  const [empId, setEmpId] = useState(null);
  const [storeId, setStoreId] = useState(null);
  const [empName, setEmpName] = useState("");
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ total: 0, done: 0, percent: 0 });
  const [anns, setAnns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shiftType, setShiftType] = useState("opening");
  const [freqTab, setFreqTab] = useState("daily");
  const [revenue, setRevenue] = useState({ dt: 0, mt: 0, ta: 0, mm: 0 });
  const [incType, setIncType] = useState("設備故障");
  const [incDesc, setIncDesc] = useState("");
  const [incSending, setIncSending] = useState(false);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const thisMonth = today.slice(0, 7);
  const dayNames = ["日", "一", "二", "三", "四", "五", "六"];
  const todayDow = new Date().getDay();

  const loadItems = useCallback((freq) => {
    if (!storeId) return;
    fetch("/api/admin/worklogs?type=collab&store_id=" + storeId + "&date=" + today + "&frequency=" + (freq || freqTab)).then(r => r.json()).then(r => {
      setItems(r.data || []);
      setSummary(r.summary || { total: 0, done: 0, percent: 0 });
    });
  }, [storeId, today, freqTab]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const eid = p.get("eid"), sid = p.get("sid"), name = p.get("name");
    setEmpId(eid); setStoreId(sid); setEmpName(name || "");

    Promise.all([
      fetch("/api/admin/worklogs?type=collab&store_id=" + sid + "&date=" + today + "&frequency=daily").then(r => r.json()),
      fetch("/api/admin/announcements").then(r => r.json()),
      fetch("/api/admin/stores").then(r => r.json()).catch(() => ({ data: [] })),
      fetch("/api/admin/settlements?store_id=" + sid + "&month=" + thisMonth).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([wl, a, st, stl]) => {
      setItems(wl.data || []);
      setSummary(wl.summary || {});
      setAnns(a.data || []);
      const store = (st.data || []).find(s => s.id === sid);
      const todayS = (stl.data || []).find(s => s.date === today);
      const monthS = (stl.data || []).reduce((s, r) => s + Number(r.net_sales || 0), 0);
      const dailyT = store ? Number(store.daily_target || 0) : 0;
      const dim = new Date(parseInt(thisMonth.split("-")[0]), parseInt(thisMonth.split("-")[1]), 0).getDate();
      setRevenue({ dt: dailyT, mt: dailyT * dim, ta: todayS ? Number(todayS.net_sales || 0) : 0, mm: monthS });
      setLoading(false);
    });
  }, []);

  useEffect(() => { if (!storeId || freqTab === "incident") return; const t = setInterval(() => loadItems(), 30000); return () => clearInterval(t); }, [storeId, loadItems, freqTab]);

  const switchFreq = (f) => { setFreqTab(f); if (f !== "incident") loadItems(f); };

  const toggle = async (item) => {
    const next = !item.completed;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, completed: next, completed_by_name: next ? empName : null, completed_at: next ? new Date().toISOString() : null } : i));
    setSummary(prev => ({ ...prev, done: prev.done + (next ? 1 : -1), percent: Math.round((prev.done + (next ? 1 : -1)) / prev.total * 100) }));
    await fetch("/api/admin/worklogs", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_item", item_id: item.id, employee_id: empId, employee_name: empName, completed: next }),
    });
  };

  const submitValue = async (item, val) => {
    const numVal = Number(val);
    await fetch("/api/admin/worklogs", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_item", item_id: item.id, employee_id: empId, employee_name: empName, completed: true, value: numVal }),
    }).then(r => r.json()).then(r => {
      if (r.data) setItems(prev => prev.map(i => i.id === item.id ? { ...r.data } : i));
    });
  };

  const sendIncident = async () => {
    if (!incDesc) return;
    setIncSending(true);
    await fetch("/api/admin/worklogs", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "report_incident", store_id: storeId, employee_id: empId, employee_name: empName, type: incType, description: incDesc }),
    });
    setIncDesc(""); setIncSending(false);
    alert("已回報，主管會收到通知");
  };

  const opening = items.filter(i => i.shift_type !== "closing");
  const closing = items.filter(i => i.shift_type === "closing");
  const current = shiftType === "opening" ? opening : closing;
  const grouped = {}; for (const item of current) { const c = item.category || "其他"; if (!grouped[c]) grouped[c] = []; grouped[c].push(item); }
  const currentDone = current.filter(i => i.completed).length;
  const currentTotal = current.length;
  const currentPct = currentTotal > 0 ? Math.round(currentDone / currentTotal * 100) : 0;

  if (loading) return <Box><div style={{ textAlign: "center", padding: 40, color: "#ccc" }}>載入中...</div></Box>;

  return (
    <Box>
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 24 }}>{"🍯"}</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>小食糖工作日誌</div>
        <div style={{ fontSize: 11, color: "#888" }}>{today + "（" + dayNames[todayDow] + "）" + empName}</div>
      </div>

      {anns.filter(a => a.priority === "urgent").map(a => (
        <div key={a.id} style={{ background: "#fde8e8", borderRadius: 8, padding: "8px 10px", marginBottom: 8, fontSize: 12 }}>
          <b style={{ color: "#b91c1c" }}>{"🔴 " + a.title}</b><div style={{ color: "#666", marginTop: 2 }}>{a.content}</div>
        </div>
      ))}

      {(revenue.dt > 0) && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
        <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 8, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#888" }}>今日營收</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: revenue.ta >= revenue.dt ? "#0a7c42" : "#b91c1c" }}>{"$" + revenue.ta.toLocaleString()}</div>
          {revenue.dt > 0 && <div style={{ marginTop: 3, height: 5, background: "#f0f0f0", borderRadius: 3 }}><div style={{ height: "100%", width: Math.min(100, Math.round(revenue.ta / revenue.dt * 100)) + "%", background: revenue.ta >= revenue.dt ? "#0a7c42" : "#fbbf24", borderRadius: 3 }} /></div>}
        </div>
        <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 8, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#888" }}>本月累積</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{"$" + revenue.mm.toLocaleString()}</div>
          {revenue.mt > 0 && <div style={{ marginTop: 3, height: 5, background: "#f0f0f0", borderRadius: 3 }}><div style={{ height: "100%", width: Math.min(100, Math.round(revenue.mm / revenue.mt * 100)) + "%", background: revenue.mm >= revenue.mt ? "#0a7c42" : "#4361ee", borderRadius: 3 }} /></div>}
        </div>
      </div>}

      {/* 頻率 Tab */}
      <div style={{ display: "flex", gap: 3, marginBottom: 10 }}>
        {FREQ_TABS.map(t => <button key={t.id} onClick={() => switchFreq(t.id)} style={{ flex: 1, padding: "6px 4px", borderRadius: 8, border: "1px solid #ddd", background: freqTab === t.id ? "#1a1a1a" : "#fff", color: freqTab === t.id ? "#fff" : "#888", fontSize: 11, fontWeight: freqTab === t.id ? 600 : 400, cursor: "pointer" }}>{t.label}</button>)}
      </div>

      {freqTab !== "incident" && <>
        {/* 進度 */}
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: "10px 12px", marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{freqTab === "daily" ? (shiftType === "opening" ? "☀️ 開店/營業" : "🌙 打烊作業") : freqTab === "weekly" ? "🗓 週清潔（" + dayNames[todayDow] + "）" : "📅 月清潔/盤點"}</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: currentPct === 100 ? "#0a7c42" : "#b45309" }}>{currentPct + "%"}</span>
          </div>
          <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: currentPct + "%", background: currentPct === 100 ? "#0a7c42" : "#fbbf24", borderRadius: 4, transition: "width 0.3s" }} />
          </div>
          <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{currentDone + " / " + currentTotal + " 項完成" + (summary.abnormal > 0 ? " ⚠️" + summary.abnormal + "項異常" : "")}</div>
        </div>

        {/* 每日：開店/打烊切換 */}
        {freqTab === "daily" && <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          <button onClick={() => setShiftType("opening")} style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ddd", background: shiftType === "opening" ? "#1a1a1a" : "#fff", color: shiftType === "opening" ? "#fff" : "#666", fontSize: 12, cursor: "pointer" }}>{"☀️ 開店/營業"}</button>
          <button onClick={() => setShiftType("closing")} style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ddd", background: shiftType === "closing" ? "#1a1a1a" : "#fff", color: shiftType === "closing" ? "#fff" : "#666", fontSize: 12, cursor: "pointer" }}>{"🌙 打烊"}</button>
        </div>}

        {/* 項目清單 */}
        {Object.entries(grouped).map(([cat, catItems]) => (
          <div key={cat} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 4, padding: "0 4px" }}>{cat}</div>
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1" }}>
              {catItems.map(item => (
                <div key={item.id} style={{ padding: "10px 12px", borderBottom: "1px solid #f0eeea" }}>
                  <div onClick={() => !item.requires_value && toggle(item)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: item.requires_value ? "default" : "pointer" }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, border: item.completed ? "none" : "2px solid #ddd", background: item.is_abnormal ? "#b91c1c" : item.completed ? "#0a7c42" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {item.completed && <span style={{ color: "#fff", fontSize: 13 }}>{item.is_abnormal ? "!" : "✓"}</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, textDecoration: item.completed && !item.requires_value ? "line-through" : "none", color: item.is_abnormal ? "#b91c1c" : item.completed ? "#aaa" : "#333" }}>{item.item_name}</div>
                      {item.completed && item.completed_by_name && <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>{"✅ " + item.completed_by_name + (item.completed_at ? " · " + new Date(item.completed_at).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : "") + (item.value !== null && item.value !== undefined ? " · " + item.value + (item.value_label || "") : "")}</div>}
                      {item.is_abnormal && <div style={{ fontSize: 10, color: "#b91c1c", fontWeight: 600 }}>{"⚠️ 數值異常！"}</div>}
                    </div>
                  </div>
                  {item.requires_value && !item.completed && <div style={{ display: "flex", gap: 4, marginTop: 6, marginLeft: 30 }}>
                    <input type="number" id={"val-" + item.id} placeholder={item.value_label || "數值"} style={{ width: 80, padding: "4px 6px", borderRadius: 4, border: "1px solid #ddd", fontSize: 12, textAlign: "center" }} />
                    <button onClick={() => { const v = document.getElementById("val-" + item.id).value; if (v) submitValue(item, v); }} style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: "#0a7c42", color: "#fff", fontSize: 11, cursor: "pointer" }}>記錄</button>
                  </div>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {currentTotal === 0 && <div style={{ textAlign: "center", padding: 30, color: "#ccc", fontSize: 12 }}>{freqTab === "weekly" ? "今天（" + dayNames[todayDow] + "）無排定週清項目" : freqTab === "monthly" ? "本月無排定月清項目" : "無工作項目"}</div>}
      </>}

      {/* 異常回報 */}
      {freqTab === "incident" && <div>
        <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{"⚠️ 回報異常狀況"}</h4>
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 10, color: "#888" }}>異常類型</label>
            <select value={incType} onChange={e => setIncType(e.target.value)} style={{ width: "100%", padding: "6px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12 }}>
              <option>設備故障</option><option>食安問題</option><option>客訴事件</option><option>缺料/斷貨</option><option>人員問題</option><option>其他</option>
            </select>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 10, color: "#888" }}>描述</label>
            <textarea value={incDesc} onChange={e => setIncDesc(e.target.value)} rows={4} placeholder="請描述異常狀況、位置、影響範圍..." style={{ width: "100%", padding: "6px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12, resize: "vertical" }} />
          </div>
          <button onClick={sendIncident} disabled={!incDesc || incSending} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: incDesc && !incSending ? "#b91c1c" : "#ccc", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{incSending ? "送出中..." : "🚨 送出異常回報"}</button>
          <p style={{ fontSize: 10, color: "#888", marginTop: 6, textAlign: "center" }}>送出後主管和總部會立即收到LINE通知</p>
        </div>
      </div>}

      <div style={{ textAlign: "center", marginTop: 16, fontSize: 10, color: "#ccc" }}>{"每30秒自動同步夥伴進度"}</div>
    </Box>
  );
}

function Box({ children }) { return <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 10px", fontFamily: "system-ui, 'Noto Sans TC', sans-serif", background: "#faf8f5", minHeight: "100vh" }}>{children}</div>; }
