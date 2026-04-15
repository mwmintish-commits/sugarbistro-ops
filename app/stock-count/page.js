"use client";
import { useState, useEffect } from "react";

export default function StockCountPage() {
  const [mode, setMode] = useState(""); // count / delivery
  const [period, setPeriod] = useState(""); // morning / evening
  const [storeId, setStoreId] = useState("");
  const [storeName, setStoreName] = useState("");
  const [empId, setEmpId] = useState("");
  const [empName, setEmpName] = useState("");
  const [items, setItems] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [deliveryItems, setDeliveryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const m = p.get("mode") || "count";
    setMode(m);
    setPeriod(p.get("period") || "morning");
    setStoreId(p.get("store_id") || "");
    setStoreName(decodeURIComponent(p.get("store_name") || ""));
    setEmpId(p.get("employee_id") || "");
    setEmpName(decodeURIComponent(p.get("employee_name") || ""));

    if (p.get("store_id")) {
      fetch("/api/admin/stock?type=items&store_id=" + p.get("store_id"))
        .then(r => r.json()).then(d => { setItems(d.data || []); setLoading(false); })
        .catch(() => setLoading(false));
    } else setLoading(false);
  }, []);

  const cats = [...new Set(items.map(i => i.category))];

  const submitCount = async () => {
    setSubmitting(true);
    const lines = items.map(i => ({ item_id: i.id, item_name: i.name, quantity: quantities[i.id] || 0, unit: i.unit }));
    const date = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
    const res = await fetch("/api/admin/stock", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit_count", store_id: storeId, date, period, lines, submitted_by: empId, submitted_by_name: empName }),
    }).then(r => r.json());
    setResult(res);
    setDone(true);
    setSubmitting(false);
  };

  const addDeliveryLine = () => setDeliveryItems([...deliveryItems, { item_id: "", item_name: "", quantity: "", unit: "" }]);

  const submitDelivery = async () => {
    const valid = deliveryItems.filter(d => d.item_id && Number(d.quantity) > 0);
    if (!valid.length) { alert("請至少填一項進貨"); return; }
    setSubmitting(true);
    const res = await fetch("/api/admin/stock", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_delivery", store_id: storeId, items: valid, received_by: empId, received_by_name: empName }),
    }).then(r => r.json());
    setResult(res);
    setDone(true);
    setSubmitting(false);
  };

  const S = { box: { maxWidth: 420, margin: "0 auto", padding: 16, fontFamily: "-apple-system,sans-serif" } };

  if (done) return (
    <div style={S.box}>
      <div style={{ fontSize: 48, textAlign: "center", marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 16, fontWeight: 600, textAlign: "center" }}>{mode === "count" ? (period === "morning" ? "開店盤點" : "打烊盤點") : "進貨登記"}完成</div>
      <div style={{ fontSize: 13, color: "#888", textAlign: "center", marginTop: 8 }}>{storeName} — {empName}</div>
      {mode === "count" && period === "evening" && <div style={{ fontSize: 12, color: "#4361ee", textAlign: "center", marginTop: 8 }}>系統已自動比對差異，如有異常將通知管理者</div>}
      <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "#888" }}>可關閉此頁面</div>
    </div>
  );

  if (loading) return <div style={S.box}><p style={{ textAlign: "center", color: "#888" }}>載入中...</p></div>;

  // 進貨模式
  if (mode === "delivery") return (
    <div style={S.box}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>📦 進貨登記</h2>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>{storeName} — {empName}</div>

      {deliveryItems.map((d, idx) => (
        <div key={idx} style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 2 }}>
            {idx === 0 && <label style={{ fontSize: 9, color: "#888" }}>品項</label>}
            <select value={d.item_id} onChange={e => {
              const item = items.find(i => i.id === e.target.value);
              const n = [...deliveryItems]; n[idx] = { ...n[idx], item_id: e.target.value, item_name: item?.name || "", unit: item?.unit || "個" }; setDeliveryItems(n);
            }} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }}>
              <option value="">選擇品項</option>
              {cats.map(c => <optgroup key={c} label={c}>{items.filter(i => i.category === c).map(i => <option key={i.id} value={i.id}>{i.name}（{i.unit}）</option>)}</optgroup>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            {idx === 0 && <label style={{ fontSize: 9, color: "#888" }}>數量</label>}
            <input type="number" inputMode="decimal" value={d.quantity} onChange={e => { const n = [...deliveryItems]; n[idx].quantity = e.target.value; setDeliveryItems(n); }}
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd", fontSize: 15, textAlign: "center" }} placeholder="0" />
          </div>
          <button onClick={() => setDeliveryItems(deliveryItems.filter((_, i) => i !== idx))}
            style={{ padding: "6px 8px", border: "none", background: "none", fontSize: 14, cursor: "pointer", color: "#b91c1c" }}>✕</button>
        </div>
      ))}

      <button onClick={addDeliveryLine} style={{ width: "100%", padding: 10, borderRadius: 6, border: "2px dashed #ccc", background: "transparent", fontSize: 13, cursor: "pointer", color: "#888", marginBottom: 16 }}>＋ 新增品項</button>

      <button onClick={submitDelivery} disabled={submitting || !deliveryItems.length}
        style={{ width: "100%", padding: 14, borderRadius: 8, border: "none", background: submitting ? "#888" : "#0a7c42", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
        {submitting ? "⏳ 送出中..." : "📦 確認進貨 " + deliveryItems.filter(d => d.item_id).length + " 項"}
      </button>
    </div>
  );

  // 盤點模式
  return (
    <div style={S.box}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{period === "morning" ? "☀️ 開店盤點" : "🌙 打烊盤點"}</h2>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{storeName} — {empName}</div>
      <div style={{ fontSize: 11, color: "#4361ee", marginBottom: 16 }}>請清點每項庫存的實際數量</div>

      {items.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: "#888", fontSize: 13 }}>尚未設定盤點品項，請聯繫總部</div>
      ) : (
        <>
          {cats.map(cat => (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 6, padding: "4px 8px", background: "#faf8f5", borderRadius: 4 }}>{cat}</div>
              {items.filter(i => i.category === cat).map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f0eeea" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{item.name}</div>
                    <div style={{ fontSize: 10, color: "#888" }}>單位：{item.unit}{item.par_level > 0 ? " ｜標準：" + item.par_level : ""}</div>
                  </div>
                  <input type="number" inputMode="decimal" value={quantities[item.id] || ""}
                    onChange={e => setQuantities({ ...quantities, [item.id]: e.target.value })}
                    placeholder="0" style={{ width: 70, padding: "8px 4px", borderRadius: 8, border: "2px solid #ddd", fontSize: 18, textAlign: "center", fontWeight: 600 }}
                    onFocus={e => { e.target.style.borderColor = "#4361ee"; }} onBlur={e => { e.target.style.borderColor = "#ddd"; }} />
                </div>
              ))}
            </div>
          ))}

          <div style={{ position: "sticky", bottom: 0, padding: "12px 0", background: "#fff" }}>
            <div style={{ fontSize: 11, color: "#888", textAlign: "center", marginBottom: 6 }}>
              已填 {Object.values(quantities).filter(v => v !== "" && v !== undefined).length} / {items.length} 項
            </div>
            <button onClick={submitCount} disabled={submitting}
              style={{ width: "100%", padding: 14, borderRadius: 8, border: "none", background: submitting ? "#888" : "#0a7c42", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              {submitting ? "⏳ 送出中..." : period === "morning" ? "☀️ 送出開店盤點" : "🌙 送出打烊盤點"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
