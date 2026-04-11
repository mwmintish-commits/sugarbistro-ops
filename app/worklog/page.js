"use client";
import { useState, useEffect, useCallback } from "react";

export default function WorkLogPage() {
  const [empId, setEmpId] = useState(null);
  const [storeId, setStoreId] = useState(null);
  const [empName, setEmpName] = useState("");
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ total: 0, done: 0, percent: 0 });
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shiftType, setShiftType] = useState("opening");
  const [revenue, setRevenue] = useState({ dt: 0, mt: 0, ta: 0, mm: 0 });
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const thisMonth = today.slice(0, 7);

  const loadItems = useCallback(() => {
    if (!storeId) return;
    fetch("/api/admin/worklogs?type=collab&store_id=" + storeId + "&date=" + today).then(r => r.json()).then(r => {
      setItems(r.data || []);
      setSummary(r.summary || { total: 0, done: 0, percent: 0 });
    });
  }, [storeId, today]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const eid = p.get("eid"), sid = p.get("sid"), name = p.get("name");
    setEmpId(eid); setStoreId(sid); setEmpName(name || "");

    Promise.all([
      fetch("/api/admin/worklogs?type=collab&store_id=" + sid + "&date=" + today).then(r => r.json()),
      fetch("/api/admin/announcements").then(r => r.json()),
      fetch("/api/admin/stores").then(r => r.json()).catch(() => ({ data: [] })),
      fetch("/api/admin/settlements?store_id=" + sid + "&month=" + thisMonth).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([wl, a, st, stl]) => {
      setItems(wl.data || []);
      setSummary(wl.summary || {});
      setAnnouncements(a.data || []);
      const store = (st.data || []).find(s => s.id === sid);
      const todayS = (stl.data || []).find(s => s.date === today);
      const monthS = (stl.data || []).reduce((s, r) => s + Number(r.net_sales || 0), 0);
      const dailyT = store ? Number(store.daily_target || 0) : 0;
      const daysInMonth = new Date(parseInt(thisMonth.split("-")[0]), parseInt(thisMonth.split("-")[1]), 0).getDate();
      setRevenue({ dt: dailyT, mt: dailyT * daysInMonth, ta: todayS ? Number(todayS.net_sales || 0) : 0, mm: monthS });
      setLoading(false);
    });
  }, []);

  // 自動刷新（每30秒）
  useEffect(() => {
    if (!storeId) return;
    const timer = setInterval(loadItems, 30000);
    return () => clearInterval(timer);
  }, [storeId, loadItems]);

  const toggle = async (item) => {
    const next = !item.completed;
    // 樂觀更新
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, completed: next, completed_by_name: next ? empName : null, completed_at: next ? new Date().toISOString() : null } : i));
    setSummary(prev => ({ ...prev, done: prev.done + (next ? 1 : -1), percent: Math.round((prev.done + (next ? 1 : -1)) / prev.total * 100) }));
    await fetch("/api/admin/worklogs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_item", item_id: item.id, employee_id: empId, employee_name: empName, completed: next }),
    });
  };

  const opening = items.filter(i => i.shift_type !== "closing");
  const closing = items.filter(i => i.shift_type === "closing");
  const current = shiftType === "opening" ? opening : closing;

  // 依分類分組
  const grouped = {};
  for (const item of current) { const c = item.category || "其他"; if (!grouped[c]) grouped[c] = []; grouped[c].push(item); }

  if (loading) return <Box><div style={{ textAlign: "center", padding: 40, color: "#ccc" }}>載入中...</div></Box>;

  const currentDone = current.filter(i => i.completed).length;
  const currentTotal = current.length;
  const currentPct = currentTotal > 0 ? Math.round(currentDone / currentTotal * 100) : 0;

  return (
    <Box>
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 24, marginBottom: 4 }}>{"🍯"}</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{"小食糖工作日誌"}</div>
        <div style={{ fontSize: 11, color: "#888" }}>{today + " " + empName}</div>
      </div>

      {announcements.filter(a => a.priority === "urgent").map(a => (
        <div key={a.id} style={{ background: "#fde8e8", borderRadius: 8, padding: "8px 10px", marginBottom: 8, fontSize: 12 }}>
          <b style={{ color: "#b91c1c" }}>{"🔴 " + a.title}</b><div style={{ color: "#666", marginTop: 2 }}>{a.content}</div>
        </div>
      ))}

      {(revenue.dt > 0 || revenue.mt > 0) && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
        <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 8, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#888" }}>今日營收</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: revenue.dt > 0 && revenue.ta >= revenue.dt ? "#0a7c42" : "#b91c1c" }}>{"$" + revenue.ta.toLocaleString()}</div>
          {revenue.dt > 0 && <div style={{ marginTop: 3, height: 5, background: "#f0f0f0", borderRadius: 3 }}><div style={{ height: "100%", width: Math.min(100, Math.round(revenue.ta / revenue.dt * 100)) + "%", background: revenue.ta >= revenue.dt ? "#0a7c42" : "#fbbf24", borderRadius: 3 }} /></div>}
          {revenue.dt > 0 && <div style={{ fontSize: 10, fontWeight: 600, color: "#888", marginTop: 1 }}>{Math.round(revenue.ta / revenue.dt * 100) + "%"}</div>}
        </div>
        <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 8, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#888" }}>本月累積</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{"$" + revenue.mm.toLocaleString()}</div>
          {revenue.mt > 0 && <div style={{ marginTop: 3, height: 5, background: "#f0f0f0", borderRadius: 3 }}><div style={{ height: "100%", width: Math.min(100, Math.round(revenue.mm / revenue.mt * 100)) + "%", background: revenue.mm >= revenue.mt ? "#0a7c42" : "#4361ee", borderRadius: 3 }} /></div>}
          {revenue.mt > 0 && <div style={{ fontSize: 10, fontWeight: 600, color: "#888", marginTop: 1 }}>{Math.round(revenue.mm / revenue.mt * 100) + "%"}</div>}
        </div>
      </div>}

      {/* 進度條 */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: "10px 12px", marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{shiftType === "opening" ? "☀️ 開店/營業" : "🌙 打烊作業"}</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: currentPct === 100 ? "#0a7c42" : "#b45309" }}>{currentPct + "%"}</span>
        </div>
        <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: currentPct + "%", background: currentPct === 100 ? "#0a7c42" : "#fbbf24", borderRadius: 4, transition: "width 0.3s" }} />
        </div>
        <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{currentDone + " / " + currentTotal + " 項完成"}</div>
      </div>

      {/* 切換 */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        <button onClick={() => setShiftType("opening")} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid #ddd", background: shiftType === "opening" ? "#1a1a1a" : "#fff", color: shiftType === "opening" ? "#fff" : "#666", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{"☀️ 開店/營業"}</button>
        <button onClick={() => setShiftType("closing")} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid #ddd", background: shiftType === "closing" ? "#1a1a1a" : "#fff", color: shiftType === "closing" ? "#fff" : "#666", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{"🌙 打烊作業"}</button>
      </div>

      {/* 項目清單 */}
      {Object.entries(grouped).map(([cat, catItems]) => (
        <div key={cat} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 4, padding: "0 4px" }}>{cat}</div>
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1" }}>
            {catItems.map(item => (
              <div key={item.id} onClick={() => toggle(item)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid #f0eeea", cursor: "pointer" }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, border: item.completed ? "none" : "2px solid #ddd", background: item.completed ? "#0a7c42" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {item.completed && <span style={{ color: "#fff", fontSize: 13 }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, textDecoration: item.completed ? "line-through" : "none", color: item.completed ? "#aaa" : "#333" }}>{item.item_name}</div>
                  {item.completed && item.completed_by_name && (
                    <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>
                      {"✅ " + item.completed_by_name + " · " + (item.completed_at ? new Date(item.completed_at).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : "")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {currentTotal === 0 && <div style={{ textAlign: "center", padding: 30, color: "#ccc", fontSize: 12 }}>此時段無工作項目</div>}

      <div style={{ textAlign: "center", marginTop: 16, fontSize: 10, color: "#ccc" }}>{"每30秒自動同步夥伴進度"}</div>
    </Box>
  );
}

function Box({ children }) { return <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 10px", fontFamily: "system-ui, 'Noto Sans TC', sans-serif", background: "#faf8f5", minHeight: "100vh" }}>{children}</div>; }
