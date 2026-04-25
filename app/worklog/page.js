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
  const [wasteMode, setWasteMode] = useState(false);
  const [wasteForm, setWasteForm] = useState({ item_id: "", quantity: "", patrol_location: "", waste_reason: "", note: "" });
  const [wastePhoto, setWastePhoto] = useState(null); // dataURL with watermark
  const [wasteUploading, setWasteUploading] = useState(false);
  const [wasteAnalyzing, setWasteAnalyzing] = useState(false);
  const [wasteAiHint, setWasteAiHint] = useState("");
  const [wasteToday, setWasteToday] = useState({ no_waste: false, wastes: [] });
  const [wasteItems, setWasteItems] = useState([]);
  const [gps, setGps] = useState(null);
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
      fetch("/api/admin/inventory?store_id=" + sid).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([wl, a, st, stl, sk]) => {
      setItems(wl.data || []); setAnns(a.data || []); setStockItems(sk.data || []);
      const store = (st.data || []).find(s => s.id === sid);
      const mode = store?.shift_mode || "single";
      setShiftMode(mode);
      const wantTab = p.get("tab");
      const closingDefault = mode === "double" ? "evening_end" : "closing";
      const openingDefault = mode === "double" ? "morning_start" : "opening";
      setTab(wantTab === "closing" ? closingDefault : (wantTab || openingDefault));
      if (p.get("waste") === "1") setWasteMode(true);
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
  const loadWasteToday = useCallback(() => {
    if (!storeId) return;
    fetch("/api/admin/waste?type=today&store_id=" + storeId).then(r => r.json()).then(r => setWasteToday(r.data || { no_waste: false, wastes: [] }));
  }, [storeId]);
  useEffect(() => { loadWasteToday(); }, [loadWasteToday]);
  // 載入該店的庫存品項（報廢登記用）
  useEffect(() => {
    if (!storeId) return;
    fetch("/api/admin/inventory?store_id=" + storeId).then(r => r.json()).then(r => setWasteItems(r.data || [])).catch(() => {});
  }, [storeId]);
  // 取得 GPS（一次）
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(p => setGps({ lat: p.coords.latitude, lng: p.coords.longitude }), () => {}, { timeout: 8000 });
  }, []);
  // 拍照後加浮水印（GPS+時間）
  const handleWastePhoto = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 縮圖到最大寬 1280
        const maxW = 1280;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        // 浮水印底色
        const ts = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
        const gpsTxt = gps ? gps.lat.toFixed(5) + ", " + gps.lng.toFixed(5) : "GPS 未取得";
        const lines = ["小食糖 報廢佐證", ts, "GPS: " + gpsTxt, "登記人: " + empName];
        const fontSize = Math.max(14, Math.round(w / 50));
        ctx.font = "bold " + fontSize + "px sans-serif";
        const lineH = fontSize + 4;
        const boxH = lines.length * lineH + 12;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, h - boxH, w, boxH);
        ctx.fillStyle = "#fff";
        lines.forEach((t, i) => ctx.fillText(t, 8, h - boxH + (i + 1) * lineH));
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setWastePhoto(dataUrl);
        // 拍照完成後送 AI 辨識（背景執行，不阻塞）
        analyzeWasteAI(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };
  const analyzeWasteAI = async (dataUrl) => {
    setWasteAnalyzing(true);
    setWasteAiHint("🤖 AI 辨識中...");
    try {
      const base64 = dataUrl.split(",")[1];
      const r = await fetch("/api/admin/waste", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "analyze_photo", base64, store_id: storeId }) }).then(r => r.json());
      if (r.error) { setWasteAiHint("⚠️ AI 辨識失敗，請手動填寫"); return; }
      // 只在欄位為空時自動填入；保留使用者已填內容
      setWasteForm(prev => ({
        ...prev,
        item_id: prev.item_id || r.item_id || "",
        quantity: prev.quantity || (r.quantity ? String(r.quantity) : ""),
        waste_reason: prev.waste_reason || r.reason || "",
      }));
      const conf = r.confidence === "high" ? "🎯 高" : r.confidence === "medium" ? "⚖️ 中" : "❓ 低";
      setWasteAiHint(`AI 建議：${r.item_name || "?"} × ${r.quantity || "?"}${r.unit || ""}（信心${conf}）— 請確認後送出`);
    } catch (e) {
      setWasteAiHint("⚠️ AI 辨識失敗，請手動填寫");
    } finally { setWasteAnalyzing(false); }
  };
  const submitWaste = async () => {
    if (!wasteForm.item_id || !wasteForm.quantity || !wasteForm.patrol_location || !wasteForm.waste_reason) {
      alert("請完整填寫品項/數量/位置/原因"); return;
    }
    if (!wastePhoto) { alert("請拍照佐證（含垃圾袋入鏡）"); return; }
    setWasteUploading(true);
    try {
      // 1) 上傳照片
      const base64 = wastePhoto.split(",")[1];
      const fn = "waste_" + storeId + "_" + Date.now();
      const up = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ base64, folder: "waste", filename: fn }) }).then(r => r.json());
      if (!up.url) throw new Error("照片上傳失敗");
      // 2) 提交報廢
      const r = await fetch("/api/admin/waste", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        action: "submit_waste", store_id: storeId, employee_id: empId, employee_name: empName,
        item_id: wasteForm.item_id, quantity: Number(wasteForm.quantity),
        patrol_location: wasteForm.patrol_location, waste_reason: wasteForm.waste_reason,
        waste_photo_url: up.url, gps_lat: gps?.lat, gps_lng: gps?.lng, note: wasteForm.note,
      }) }).then(r => r.json());
      if (r.error) { alert("提交失敗：" + r.error); return; }
      alert("✅ 已送出，待主管稽核");
      setWasteForm({ item_id: "", quantity: "", patrol_location: "", waste_reason: "", note: "" });
      setWastePhoto(null); setWasteMode(false);
      loadWasteToday();
    } finally { setWasteUploading(false); }
  };
  const confirmNoWaste = async () => {
    if (!confirm("確認本日 4 區（冷藏/冷凍/常溫/展示櫃）皆已巡邏，無任何食材需報廢？")) return;
    const r = await fetch("/api/admin/waste", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm_no_waste", store_id: storeId, employee_id: empId, employee_name: empName }) }).then(r => r.json());
    if (r.error) { alert("失敗：" + r.error); return; }
    alert("✅ 已紀錄本日無報廢");
    loadWasteToday();
  };
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
        {closingTabs.includes(tab) && <div style={{ marginBottom: 10 }}>
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #f0d6d6", padding: 10, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c" }}>🗑 食材報廢稽核</span>
              <span style={{ fontSize: 10, color: "#888" }}>{wasteToday.no_waste ? "✅ 本日已確認無報廢" : (wasteToday.wastes?.length > 0 ? "本日已登記 " + wasteToday.wastes.length + " 筆" : "尚未登記")}</span>
            </div>
            {!wasteMode && <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setWasteMode(true)} style={{ flex: 2, padding: 10, borderRadius: 8, border: "2px dashed #b91c1c", background: "#fff5f5", color: "#b91c1c", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🗑 報廢登記</button>
              <button onClick={confirmNoWaste} disabled={wasteToday.no_waste} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid " + (wasteToday.no_waste ? "#ccc" : "#0a7c42"), background: wasteToday.no_waste ? "#eee" : "#e6f9f0", color: wasteToday.no_waste ? "#999" : "#0a7c42", fontSize: 12, fontWeight: 600, cursor: wasteToday.no_waste ? "default" : "pointer" }}>{wasteToday.no_waste ? "✅ 已確認" : "本日無報廢"}</button>
            </div>}
            {wasteMode && <div style={{ marginTop: 4 }}>
              <select value={wasteForm.patrol_location} onChange={e => setWasteForm({ ...wasteForm, patrol_location: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", fontSize: 13, marginBottom: 6 }}>
                <option value="">📍 巡邏位置...</option>
                <option value="refrig">🧊 冷藏</option>
                <option value="freezer">❄️ 冷凍</option>
                <option value="ambient">🌡 常溫</option>
                <option value="display">🪟 展示櫃</option>
              </select>
              <select value={wasteForm.item_id} onChange={e => setWasteForm({ ...wasteForm, item_id: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", fontSize: 13, marginBottom: 6 }}>
                <option value="">{wasteItems.length === 0 ? "（此門市無報廢品項，請聯絡管理員）" : "選擇品項..."}</option>
                {wasteItems.map(i => <option key={i.id} value={i.id}>{i.name + " (" + (i.unit || "") + ")"}</option>)}
              </select>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input type="number" inputMode="decimal" value={wasteForm.quantity} onChange={e => setWasteForm({ ...wasteForm, quantity: e.target.value })} placeholder="報廢數量" style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ddd", fontSize: 14, textAlign: "center" }} />
                <select value={wasteForm.waste_reason} onChange={e => setWasteForm({ ...wasteForm, waste_reason: e.target.value })} style={{ flex: 2, padding: 8, borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }}>
                  <option value="">原因...</option>
                  <option value="過期">過期</option>
                  <option value="受潮/變質">受潮/變質</option>
                  <option value="製作失敗">製作失敗</option>
                  <option value="客退">客退</option>
                  <option value="掉落污染">掉落污染</option>
                  <option value="其他">其他</option>
                </select>
              </div>
              <input type="text" value={wasteForm.note} onChange={e => setWasteForm({ ...wasteForm, note: e.target.value })} placeholder="補充說明（可選）" style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", fontSize: 12, marginBottom: 6 }} />
              <label style={{ display: "block", padding: 10, borderRadius: 8, border: "2px dashed " + (wastePhoto ? "#0a7c42" : "#b91c1c"), background: wastePhoto ? "#e6f9f0" : "#fff5f5", color: wastePhoto ? "#0a7c42" : "#b91c1c", fontSize: 12, textAlign: "center", cursor: "pointer", marginBottom: 6 }}>
                {wastePhoto ? "✅ 已拍照（含浮水印）— 點此重拍" : "📷 拍照佐證（含垃圾袋入鏡，自動加 GPS+時間浮水印）"}
                <input type="file" accept="image/*" capture="environment" onChange={e => handleWastePhoto(e.target.files?.[0])} style={{ display: "none" }} />
              </label>
              {wastePhoto && <img src={wastePhoto} alt="預覽" style={{ width: "100%", borderRadius: 8, marginBottom: 6 }} />}
              {wasteAiHint && <div style={{ padding: "6px 8px", borderRadius: 6, background: "#fff8e6", color: "#92400e", fontSize: 11, marginBottom: 6 }}>{wasteAiHint}</div>}
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={submitWaste} disabled={wasteUploading} style={{ flex: 2, padding: 10, borderRadius: 8, border: "none", background: wasteUploading ? "#ccc" : "#b91c1c", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{wasteUploading ? "送出中..." : "送出報廢"}</button>
                <button onClick={() => { setWasteMode(false); setWastePhoto(null); setWasteForm({ item_id: "", quantity: "", patrol_location: "", waste_reason: "", note: "" }); }} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ddd", background: "#fff", fontSize: 12, cursor: "pointer" }}>取消</button>
              </div>
            </div>}
            {wasteToday.wastes?.length > 0 && <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #f0eeea" }}>
              {wasteToday.wastes.map(w => (<div key={w.id} style={{ fontSize: 11, color: "#666", padding: "3px 0" }}>
                {"• " + (w.inventory_items?.name || "?") + " " + Math.abs(w.quantity) + (w.inventory_items?.unit || "") + " · " + (w.waste_reason || "") + " · "}
                <span style={{ color: w.audit_status === "approved" ? "#0a7c42" : w.audit_status === "rejected" ? "#b91c1c" : "#b45309" }}>{w.audit_status === "approved" ? "已核准" : w.audit_status === "rejected" ? "已退回" : w.audit_status === "observe" ? "觀察中" : "待稽核"}</span>
              </div>))}
            </div>}
          </div>
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
