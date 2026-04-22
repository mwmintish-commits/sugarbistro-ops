"use client";
import { useState, useEffect, useCallback } from "react";
export default function WorkLogPage() {
  const [empId, setEmpId] = useState(null);
  const [storeId, setStoreId] = useState(null);
  const [empName, setEmpName] = useState("");
  const [items, setItems] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [stockQty, setStockQty] = useState({});
  const [stockSubmitted, setStockSubmitted] = useState({ morning: false, evening: false });
  const [anns, setAnns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("opening");
  const [revenue, setRevenue] = useState({ dt: 0, mt: 0, ta: 0, mm: 0 });
  const [incType, setIncType] = useState("設備故障");
  const [incDesc, setIncDesc] = useState("");
  const [incSending, setIncSending] = useState(false);
  const [deepItems, setDeepItems] = useState([]);
  const [deepContrib, setDeepContrib] = useState([]);
  const [deliveryMode, setDeliveryMode] = useState(false);
  const [deliveryLines, setDeliveryLines] = useState([]);
  const [shiftMode, setShiftMode] = useState("single");
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const thisMonth = today.slice(0, 7);
  const dayNames = ["日", "一", "二", "三", "四", "五", "六"];
  const todayDow = new Date().getDay();
  const loadItems = useCallback(() => {
    if (!storeId) return;
    fetch("/api/admin/worklogs?type=collab&store_id=" + storeId + "&date=" + today + "&frequency=daily").then(r => r.json()).then(r => setItems(r.data || []));
  }, [storeId, today]);
  const calcContrib = (list) => {
    const m = {};
    for (const i of list) { if (i.completed && i.completed_by_name) m[i.completed_by_name] = (m[i.completed_by_name] || 0) + 1; }
    const t = Object.values(m).reduce((a, b) => a + b, 0);
    return Object.entries(m).map(([name, count]) => ({ name, count, pct: t > 0 ? Math.round(count / t * 100) : 0 })).sort((a, b) => b.count - a.count);
  };
  const loadDeep = useCallback(() => {
    if (!storeId) return;
    Promise.all([
      fetch("/api/admin/worklogs?type=collab&store_id=" + storeId + "&date=" + today + "&frequency=weekly").then(r => r.json()),
      fetch("/api/admin/worklogs?type=collab&store_id=" + storeId + "&date=" + today + "&frequency=monthly").then(r => r.json()),
    ]).then(([w, m]) => {
      const all = [...(w.data || []).map(i => ({ ...i, freq: "weekly" })), ...(m.data || []).map(i => ({ ...i, freq: "monthly" }))];
      setDeepItems(all); setDeepContrib(calcContrib(all));
    });
  }, [storeId, today]);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const eid = p.get("eid"), sid = p.get("sid"), name = p.get("name");
    setEmpId(eid); setStoreId(sid); setEmpName(name || "");
    Promise.all([
      fetch("/api/admin/worklogs?type=collab&store_id=" + sid + "&date=" + today + "&frequency=daily").then(r => r.json()),
      fetch("/api/admin/announcements").then(r => r.json()),
      fetch("/api/admin/stores").then(r => r.json()).catch(() => ({ data: [] })),
      fetch("/api/admin/settlements?store_id=" + sid + "&month=" + thisMonth).then(r => r.json()).catch(() => ({ data: [] })),
      fetch("/api/admin/stock?type=items&store_id=" + sid).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([wl, a, st, stl, sk]) => {
      setItems(wl.data || []); setAnns(a.data || []); setStockItems(sk.data || []);
      const store = (st.data || []).find(s => s.id === sid);
      const mode = store?.shift_mode || "single";
      setShiftMode(mode);
      setTab(mode === "double" ? "morning_start" : "opening");
      const todayS = (stl.data || []).find(s => s.date === today);
      const monthS = (stl.data || []).reduce((s, r) => s + Number(r.net_sales || 0), 0);
      const dailyT = store ? Number(store.daily_target || 0) : 0;
      const dim = new Date(parseInt(thisMonth.split("-")[0]), parseInt(thisMonth.split("-")[1]), 0).getDate();
      setRevenue({ dt: dailyT, mt: dailyT * dim, ta: todayS ? Number(todayS.net_sales || 0) : 0, mm: monthS });
      setLoading(false);
    });
  }, []);
  useEffect(() => { if (tab === "deep") loadDeep(); }, [tab, loadDeep]);
  useEffect(() => { if (!storeId) return; const t = setInterval(loadItems, 30000); return () => clearInterval(t); }, [storeId, loadItems]);
  const toggle = async (item, isDeep) => {
    const next = !item.completed;
    const setter = isDeep ? setDeepItems : setItems;
    setter(prev => prev.map(i => i.id === item.id ? { ...i, completed: next, completed_by_name: next ? empName : null, completed_at: next ? new Date().toISOString() : null } : i));
    await fetch("/api/admin/worklogs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle_item", item_id: item.id, employee_id: empId, employee_name: empName, completed: next }) });
    if (isDeep) { setTimeout(() => { setDeepContrib(prev => { const updated = deepItems.map(i => i.id === item.id ? { ...i, completed: next, completed_by_name: next ? empName : null } : i); return calcContrib(updated); }); }, 100); }
  };
  const submitValue = async (item, val) => {
    const r = await fetch("/api/admin/worklogs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle_item", item_id: item.id, employee_id: empId, employee_name: empName, completed: true, value: Number(val) }) }).then(r => r.json());
    if (r.data) setItems(prev => prev.map(i => i.id === item.id ? { ...r.data } : i));
  };
  const submitStock = async (period) => {
    const lines = stockItems.map(i => ({ item_id: i.id, item_name: i.name, quantity: Number(stockQty[i.id] || 0), unit: i.unit }));
    if (lines.filter(l => stockQty[l.item_id] !== undefined && stockQty[l.item_id] !== "").length === 0) { alert("請至少填一項"); return; }
    await fetch("/api/admin/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit_count", store_id: storeId, date: today, period, lines, submitted_by: empId, submitted_by_name: empName }) });
    setStockSubmitted(p => ({ ...p, [period]: true }));
  };
  const submitDelivery = async () => {
    const valid = deliveryLines.filter(d => d.item_id && Number(d.quantity) > 0);
    if (!valid.length) { alert("請至少填一項"); return; }
    await fetch("/api/admin/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add_delivery", store_id: storeId, items: valid, received_by: empId, received_by_name: empName }) });
    setDeliveryMode(false); setDeliveryLines([]); alert("✅ 進貨已登記");
  };
  const currentItems = tab === "deep" ? [] : items.filter(i => i.shift_type === tab);
  const grouped = {}; for (const item of currentItems) { const c = item.category || "其他"; if (!grouped[c]) grouped[c] = []; grouped[c].push(item); }
  const stockCats = [...new Set(stockItems.map(i => i.category))];
  const openingTabs = shiftMode === "double" ? ["morning_start", "evening_start"] : ["opening"];
  const closingTabs = shiftMode === "double" ? ["morning_end", "evening_end"] : ["closing"];
  const stockPeriod = openingTabs.includes(tab) ? "morning" : "evening";
  const showStock = (openingTabs.includes(tab) || closingTabs.includes(tab)) && stockItems.length > 0;
  const stockFilled = Object.values(stockQty).filter(v => v !== "" && v !== undefined).length;
  const tasksDone = currentItems.filter(i => i.completed).length;
  const tasksTotal = currentItems.length;
  const stockDone = showStock ? (stockSubmitted[stockPeriod] ? stockItems.length : stockFilled) : 0;
  const stockTotal = showStock ? stockItems.length : 0;
  const pct = (tasksTotal + stockTotal) > 0 ? Math.round((tasksDone + stockDone) / (tasksTotal + stockTotal) * 100) : 0;
  const deepWeekly = deepItems.filter(i => i.freq === "weekly");
  const deepMonthly = deepItems.filter(i => i.freq === "monthly");
  const weekDone = deepWeekly.filter(i => i.completed).length;
  const monthDone = deepMonthly.filter(i => i.completed).length;
  const TABS = shiftMode === "double"
    ? [{ id: "morning_start", l: "🌅早上" }, { id: "morning_end", l: "🌤早下" }, { id: "evening_start", l: "🌇晚上" }, { id: "evening_end", l: "🌙晚下" }, { id: "deep", l: "🧹清潔" }]
    : [{ id: "opening", l: "☀️開店" }, { id: "during", l: "🔥營業" }, { id: "closing", l: "🌙閉店" }, { id: "deep", l: "🧹清潔" }];
  if (loading) return <Box><div style={{ textAlign: "center", padding: 40, color: "#ccc" }}>載入中...</div></Box>;
  return (
    <Box>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 22 }}>🍯</div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>小食糖工作日誌</div>
        <div style={{ fontSize: 11, color: "#888" }}>{today + "（" + dayNames[todayDow] + "）" + empName}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: "8px 10px" }}>
          <div style={{ fontSize: 10, color: "#888" }}>今日營收</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: revenue.ta >= revenue.dt && revenue.dt > 0 ? "#0a7c42" : "#333" }}>{"$" + revenue.ta.toLocaleString()}</div>
          {revenue.dt > 0 && <><div style={{ marginTop: 3, height: 6, background: "#f0f0f0", borderRadius: 3 }}><div style={{ height: "100%", width: Math.min(100, Math.round(revenue.ta / revenue.dt * 100)) + "%", background: revenue.ta >= revenue.dt ? "#0a7c42" : "#fbbf24", borderRadius: 3 }} /></div><div style={{ fontSize: 9, color: "#888", marginTop: 2 }}>{"目標$" + revenue.dt.toLocaleString()}</div></>}
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: "8px 10px" }}>
          <div style={{ fontSize: 10, color: "#888" }}>本月累積</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{"$" + revenue.mm.toLocaleString()}</div>
          {revenue.mt > 0 && <><div style={{ marginTop: 3, height: 6, background: "#f0f0f0", borderRadius: 3 }}><div style={{ height: "100%", width: Math.min(100, Math.round(revenue.mm / revenue.mt * 100)) + "%", background: revenue.mm >= revenue.mt ? "#0a7c42" : "#4361ee", borderRadius: 3 }} /></div><div style={{ fontSize: 9, color: "#888", marginTop: 2 }}>{"月目標$" + revenue.mt.toLocaleString()}</div></>}
        </div>
      </div>
      {anns.filter(a => a.is_active).slice(0, 3).map(a => (<div key={a.id} style={{ background: a.priority === "urgent" ? "#fde8e8" : "#e6f1fb", borderRadius: 8, padding: "6px 10px", marginBottom: 4, fontSize: 12 }}><b style={{ color: a.priority === "urgent" ? "#b91c1c" : "#185fa5" }}>{(a.priority === "urgent" ? "🔴 " : "📢 ") + a.title}</b><div style={{ color: "#666", marginTop: 1, fontSize: 11 }}>{(a.content || "").slice(0, 60)}</div></div>))}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${TABS.length}, 1fr)`, gap: 4, margin: "8px 0 10px" }}>
        {TABS.map(t => <button key={t.id} onClick={() => { setTab(t.id); setStockQty({}); setDeliveryMode(false); }} style={{ padding: "10px 2px", borderRadius: 10, border: tab === t.id ? "2px solid #1a1a1a" : "1px solid #ddd", background: tab === t.id ? "#1a1a1a" : "#fff", color: tab === t.id ? "#fff" : "#666", fontSize: 12, fontWeight: tab === t.id ? 700 : 400, cursor: "pointer" }}>{t.l}</button>)}
      </div>
      {tab !== "deep" && <>
        {(tasksTotal + stockTotal) > 0 && <div style={{ background: pct === 100 ? "#e6f9f0" : "#fff", borderRadius: 10, border: "1px solid " + (pct === 100 ? "#0a7c42" : "#e8e6e1"), padding: "10px 12px", marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}><span style={{ fontSize: 13, fontWeight: 600 }}>{pct === 100 ? "🎉 全部完成！" : TABS.find(x => x.id === tab)?.l}</span><span style={{ fontSize: 20, fontWeight: 700, color: pct === 100 ? "#0a7c42" : "#b45309" }}>{pct + "%"}</span></div>
          <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: pct + "%", background: pct === 100 ? "#0a7c42" : "#fbbf24", borderRadius: 4, transition: "width 0.3s" }} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "#888" }}><span>{"✅" + tasksDone + "/" + tasksTotal}</span>{showStock && <span>{"📦" + (stockSubmitted[stockPeriod] ? stockItems.length : stockFilled) + "/" + stockItems.length}</span>}</div>
        </div>}
        {tab === "during" && !deliveryMode && <button onClick={() => { setDeliveryMode(true); setDeliveryLines([{ item_id: "", item_name: "", quantity: "", unit: "" }]); }} style={{ width: "100%", padding: 12, borderRadius: 10, border: "2px dashed #b45309", background: "#fff8e6", color: "#b45309", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 10 }}>📦 登記進貨</button>}
        {deliveryMode && <div style={{ background: "#fff8e6", borderRadius: 10, border: "1px solid #f0e6c8", padding: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#b45309", marginBottom: 8 }}>📦 進貨登記</div>
          {deliveryLines.map((d, idx) => (<div key={idx} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}><select value={d.item_id} onChange={e => { const item = stockItems.find(i => i.id === e.target.value); const n = [...deliveryLines]; n[idx] = { ...n[idx], item_id: e.target.value, item_name: item?.name || "", unit: item?.unit || "" }; setDeliveryLines(n); }} style={{ flex: 2, padding: 8, borderRadius: 8, border: "1px solid #ddd", fontSize: 12 }}><option value="">選品項</option>{stockItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select><input type="number" inputMode="decimal" value={d.quantity} onChange={e => { const n = [...deliveryLines]; n[idx].quantity = e.target.value; setDeliveryLines(n); }} placeholder="數量" style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ddd", fontSize: 14, textAlign: "center" }} /><button onClick={() => setDeliveryLines(deliveryLines.filter((_, i) => i !== idx))} style={{ border: "none", background: "none", color: "#b91c1c", fontSize: 16, cursor: "pointer" }}>✕</button></div>))}
          <div style={{ display: "flex", gap: 6 }}><button onClick={() => setDeliveryLines([...deliveryLines, { item_id: "", quantity: "" }])} style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px dashed #ccc", background: "transparent", fontSize: 12, cursor: "pointer" }}>＋</button><button onClick={submitDelivery} style={{ flex: 1, padding: 8, borderRadius: 8, border: "none", background: "#b45309", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>確認進貨</button><button onClick={() => setDeliveryMode(false)} style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd", fontSize: 12, cursor: "pointer" }}>取消</button></div>
        </div>}
        {Object.entries(grouped).map(([cat, ci]) => (<div key={cat} style={{ marginBottom: 8 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 4, padding: "0 4px" }}>{cat}</div><div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1" }}>{ci.map(item => <CI key={item.id} item={item} toggle={() => toggle(item, false)} submitValue={submitValue} />)}</div></div>))}
        {showStock && <div style={{ marginBottom: 8 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#b45309", marginBottom: 4, padding: "0 4px" }}>📦 庫存盤點</div><div style={{ background: stockSubmitted[stockPeriod] ? "#e6f9f0" : "#fff", borderRadius: 10, border: "1px solid " + (stockSubmitted[stockPeriod] ? "#0a7c42" : "#e8e6e1") }}>{stockSubmitted[stockPeriod] ? <div style={{ padding: 20, textAlign: "center" }}><div style={{ fontSize: 28 }}>✅</div><div style={{ fontSize: 13, fontWeight: 600, color: "#0a7c42" }}>{(openingTabs.includes(tab) ? "開店" : "閉店") + "盤點已送出"}</div></div> : <>{stockCats.map(cat => <div key={cat}><div style={{ fontSize: 10, fontWeight: 600, color: "#888", padding: "8px 12px 2px", background: "#faf8f5" }}>{cat}</div>{stockItems.filter(i => i.category === cat).map(item => <div key={item.id} style={{ display: "flex", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid #f0eeea", gap: 10 }}><div style={{ flex: 1 }}><div style={{ fontSize: 14 }}>{item.name}</div>{item.par_level > 0 && <div style={{ fontSize: 10, color: "#888" }}>{"標準" + item.par_level + item.unit}</div>}</div><input type="number" inputMode="decimal" value={stockQty[item.id] || ""} onChange={e => setStockQty({ ...stockQty, [item.id]: e.target.value })} placeholder="0" style={{ width: 60, padding: "6px 4px", borderRadius: 8, border: "2px solid " + (stockQty[item.id] ? "#b45309" : "#ddd"), fontSize: 16, textAlign: "center", fontWeight: 700 }} /><span style={{ fontSize: 11, color: "#888" }}>{item.unit}</span></div>)}</div>)}<div style={{ padding: 12 }}><button onClick={() => submitStock(stockPeriod)} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: stockFilled > 0 ? "#b45309" : "#ddd", color: "#fff", fontSize: 14, fontWeight: 600, cursor: stockFilled > 0 ? "pointer" : "default" }}>{"📦送出" + (openingTabs.includes(tab) ? "開店" : "閉店") + "盤點（" + stockFilled + "/" + stockItems.length + "）"}</button></div></>}</div></div>}
        {tasksTotal === 0 && !showStock && <div style={{ textAlign: "center", padding: 30, color: "#ccc", fontSize: 12 }}>此時段無工作項目</div>}
      </>}
      {tab === "deep" && <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: 10, textAlign: "center" }}><div style={{ fontSize: 10, color: "#888" }}>本週</div><div style={{ fontSize: 20, fontWeight: 700, color: weekDone >= deepWeekly.length && deepWeekly.length > 0 ? "#0a7c42" : "#333" }}>{weekDone + "/" + deepWeekly.length}</div>{deepWeekly.length > 0 && <div style={{ height: 5, background: "#f0f0f0", borderRadius: 3, marginTop: 4 }}><div style={{ height: "100%", width: Math.round(weekDone / deepWeekly.length * 100) + "%", background: "#0a7c42", borderRadius: 3 }} /></div>}</div>
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: 10, textAlign: "center" }}><div style={{ fontSize: 10, color: "#888" }}>本月</div><div style={{ fontSize: 20, fontWeight: 700, color: monthDone >= deepMonthly.length && deepMonthly.length > 0 ? "#0a7c42" : "#333" }}>{monthDone + "/" + deepMonthly.length}</div>{deepMonthly.length > 0 && <div style={{ height: 5, background: "#f0f0f0", borderRadius: 3, marginTop: 4 }}><div style={{ height: "100%", width: Math.round(monthDone / deepMonthly.length * 100) + "%", background: "#4361ee", borderRadius: 3 }} /></div>}</div>
        </div>
        {deepContrib.length > 0 && <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: 10, marginBottom: 10 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 6 }}>🏆 貢獻度</div>{deepContrib.map((c, i) => <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><span style={{ fontSize: 14, width: 20, textAlign: "center" }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1)}</span><span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{c.name}</span><div style={{ width: 80, height: 6, background: "#f0f0f0", borderRadius: 3 }}><div style={{ height: "100%", width: c.pct + "%", background: i === 0 ? "#fbbf24" : "#4361ee", borderRadius: 3 }} /></div><span style={{ fontSize: 11, color: "#888", minWidth: 50, textAlign: "right" }}>{c.count + "項" + c.pct + "%"}</span></div>)}</div>}
        {deepWeekly.length > 0 && <div style={{ marginBottom: 8 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 4 }}>🗓 每週</div><div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1" }}>{deepWeekly.map(item => <CI key={item.id} item={item} toggle={() => toggle(item, true)} freq="週" />)}</div></div>}
        {deepMonthly.length > 0 && <div style={{ marginBottom: 8 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 4 }}>📅 每月</div><div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1" }}>{deepMonthly.map(item => <CI key={item.id} item={item} toggle={() => toggle(item, true)} freq="月" />)}</div></div>}
        {deepWeekly.length === 0 && deepMonthly.length === 0 && <div style={{ textAlign: "center", padding: 30, color: "#ccc", fontSize: 12 }}>尚未設定細部清潔項目</div>}
        <div style={{ marginTop: 10, background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>⚠️ 回報異常</div>
          <select value={incType} onChange={e => setIncType(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", fontSize: 12, marginBottom: 6 }}><option>設備故障</option><option>食安問題</option><option>客訴事件</option><option>缺料/斷貨</option><option>人員問題</option><option>其他</option></select>
          <textarea value={incDesc} onChange={e => setIncDesc(e.target.value)} rows={3} placeholder="描述異常..." style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", fontSize: 12, resize: "vertical", marginBottom: 6 }} />
          <button onClick={async () => { if (!incDesc) return; setIncSending(true); await fetch("/api/admin/worklogs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "report_incident", store_id: storeId, employee_id: empId, employee_name: empName, type: incType, description: incDesc }) }); setIncDesc(""); setIncSending(false); alert("已回報"); }} disabled={!incDesc || incSending} style={{ width: "100%", padding: 10, borderRadius: 10, border: "none", background: incDesc ? "#b91c1c" : "#ddd", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{incSending ? "送出中..." : "🚨 送出異常回報"}</button>
        </div>
      </div>}
      <div style={{ textAlign: "center", marginTop: 16, fontSize: 10, color: "#ccc" }}>每30秒自動同步</div>
    </Box>
  );
}
function CI({ item, toggle, submitValue, freq }) {
  return (<div style={{ padding: "10px 12px", borderBottom: "1px solid #f0eeea" }}>
    <div onClick={() => !item.requires_value && toggle()} style={{ display: "flex", alignItems: "center", gap: 10, cursor: item.requires_value ? "default" : "pointer" }}>
      <div style={{ width: 26, height: 26, borderRadius: 8, border: item.completed ? "none" : "2px solid #ddd", background: item.is_abnormal ? "#b91c1c" : item.completed ? "#0a7c42" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>{item.completed && <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{item.is_abnormal ? "!" : "✓"}</span>}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: item.is_abnormal ? "#b91c1c" : item.completed ? "#aaa" : "#333", textDecoration: item.completed && !item.requires_value ? "line-through" : "none" }}>{item.item_name}{freq && <span style={{ fontSize: 10, color: "#b45309", marginLeft: 4 }}>{"(" + freq + ")"}</span>}</div>
        {item.completed && item.completed_by_name && <div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>{item.completed_by_name + (item.completed_at ? " · " + new Date(item.completed_at).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : "") + (item.value != null ? " · " + item.value : "")}</div>}
      </div>
    </div>
    {item.requires_value && !item.completed && submitValue && <div style={{ display: "flex", gap: 6, marginTop: 8, marginLeft: 36 }}><input type="number" inputMode="decimal" id={"val-" + item.id} placeholder={item.value_label || "數值"} style={{ width: 80, padding: "6px 8px", borderRadius: 8, border: "2px solid #ddd", fontSize: 14, textAlign: "center", fontWeight: 600 }} /><button onClick={() => { const v = document.getElementById("val-" + item.id)?.value; if (v) submitValue(item, v); }} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#0a7c42", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>記錄</button></div>}
  </div>);
}
function Box({ children }) { return <div style={{ maxWidth: 460, margin: "0 auto", padding: "12px 10px", fontFamily: "system-ui, 'Noto Sans TC', sans-serif", background: "#faf8f5", minHeight: "100vh" }}>{children}</div>; }
