"use client";
import { useState, useEffect } from "react";

const fmt = (n) => "$" + Number(n || 0).toLocaleString();

function Card({ label, value, sub, color }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: "16px 20px",
      border: "1px solid #e8e6e1", flex: "1 1 140px", minWidth: 140,
    }}>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: color || "#1a1a1a" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    matched: { bg: "#e6f9f0", color: "#0a7c42", text: "✅ 吻合" },
    minor_diff: { bg: "#fff8e6", color: "#8a6d00", text: "⚠️ 小差異" },
    anomaly: { bg: "#fde8e8", color: "#b91c1c", text: "🚨 異常" },
    pending: { bg: "#f0f0f0", color: "#666", text: "⏳ 待核" },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 12,
      fontSize: 12, fontWeight: 500, background: s.bg, color: s.color,
    }}>{s.text}</span>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState("settlements");
  const [stores, setStores] = useState([]);
  const [storeFilter, setStoreFilter] = useState("");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [settlements, setSettlements] = useState([]);
  const [summary, setSummary] = useState({});
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => { fetch("/api/admin/stores").then(r => r.json()).then(d => setStores(d.data || [])); }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (storeFilter) params.set("store_id", storeFilter);

    Promise.all([
      fetch(`/api/admin/settlements?${params}`).then(r => r.json()),
      fetch(`/api/admin/deposits?${params}`).then(r => r.json()),
    ]).then(([sRes, dRes]) => {
      setSettlements(sRes.data || []);
      setSummary(sRes.summary || {});
      setDeposits(dRes.data || []);
      setLoading(false);
    });
  }, [month, storeFilter]);

  const tabStyle = (id) => ({
    padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
    fontSize: 14, fontWeight: tab === id ? 600 : 400, transition: "all .2s",
    background: tab === id ? "#1a1a1a" : "transparent",
    color: tab === id ? "#fff" : "#888",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f5", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #e8e6e1",
        padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>🍯</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>小食糖管理後台</div>
            <div style={{ fontSize: 11, color: "#aaa" }}>Sugar Bistro Admin</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }} />
          <select value={storeFilter} onChange={e => setStoreFilter(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }}>
            <option value="">全部門市</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px" }}>
        {/* Summary Cards */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          <Card label="營業淨額合計" value={fmt(summary.total_net_sales)} sub={`${summary.count || 0} 筆日結`} color="#0a7c42" />
          <Card label="現金合計" value={fmt(summary.total_cash)} />
          <Card label="TWQR 合計" value={fmt(summary.total_twqr)} />
          <Card label="UberEat 合計" value={fmt(summary.total_uber_eat)} />
          <Card label="應存現金合計" value={fmt(summary.total_cash_to_deposit)} color="#b45309" />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          <button style={tabStyle("settlements")} onClick={() => setTab("settlements")}>日結紀錄</button>
          <button style={tabStyle("deposits")} onClick={() => setTab("deposits")}>存款紀錄</button>
        </div>

        {loading && <div style={{ textAlign: "center", padding: 40, color: "#aaa" }}>載入中...</div>}

        {/* Settlements Table */}
        {!loading && tab === "settlements" && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
              <thead>
                <tr style={{ background: "#faf8f5", borderBottom: "1px solid #e8e6e1" }}>
                  {["日期", "門市", "結單人", "營業淨額", "現金", "LINE Pay", "TWQR", "UberEat", "悠遊", "餐券", "發票", "應存", "照片"].map(h =>
                    <th key={h} style={{ padding: "10px 8px", textAlign: "left", fontWeight: 500, color: "#666", whiteSpace: "nowrap" }}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {settlements.length === 0 && (
                  <tr><td colSpan={13} style={{ padding: 40, textAlign: "center", color: "#ccc" }}>尚無資料</td></tr>
                )}
                {settlements.map(s => (
                  <tr key={s.id} style={{ borderBottom: "1px solid #f0eeea" }}>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{s.date}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 500 }}>{s.stores?.name}</td>
                    <td style={{ padding: "10px 8px" }}>{s.cashier_name || "-"}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 600, color: "#0a7c42" }}>{fmt(s.net_sales)}</td>
                    <td style={{ padding: "10px 8px" }}>{fmt(s.cash_amount)}</td>
                    <td style={{ padding: "10px 8px" }}>{fmt(s.line_pay_amount)}</td>
                    <td style={{ padding: "10px 8px" }}>{fmt(s.twqr_amount)}</td>
                    <td style={{ padding: "10px 8px" }}>{fmt(s.uber_eat_amount)}</td>
                    <td style={{ padding: "10px 8px" }}>{fmt(s.easy_card_amount)}</td>
                    <td style={{ padding: "10px 8px" }}>{fmt(s.meal_voucher_amount)}</td>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{s.invoice_count || 0} 張</td>
                    <td style={{ padding: "10px 8px", fontWeight: 500, color: "#b45309" }}>{fmt(s.cash_to_deposit)}</td>
                    <td style={{ padding: "10px 8px" }}>
                      {s.image_url && (
                        <button onClick={() => setSelectedImage(s.image_url)} style={{
                          padding: "4px 10px", borderRadius: 6, border: "1px solid #ddd",
                          background: "transparent", cursor: "pointer", fontSize: 12,
                        }}>📷 查看</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Deposits Table */}
        {!loading && tab === "deposits" && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 800 }}>
              <thead>
                <tr style={{ background: "#faf8f5", borderBottom: "1px solid #e8e6e1" }}>
                  {["存款日", "門市", "銀行", "存款金額", "應存金額", "差異", "核對期間", "狀態", "照片"].map(h =>
                    <th key={h} style={{ padding: "10px 8px", textAlign: "left", fontWeight: 500, color: "#666", whiteSpace: "nowrap" }}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {deposits.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#ccc" }}>尚無資料</td></tr>
                )}
                {deposits.map(d => (
                  <tr key={d.id} style={{ borderBottom: "1px solid #f0eeea" }}>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{d.deposit_date}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 500 }}>{d.stores?.name}</td>
                    <td style={{ padding: "10px 8px", fontSize: 12 }}>{d.bank_name} {d.bank_branch}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 600 }}>{fmt(d.amount)}</td>
                    <td style={{ padding: "10px 8px" }}>{fmt(d.expected_cash)}</td>
                    <td style={{
                      padding: "10px 8px", fontWeight: 500,
                      color: Math.abs(d.difference) <= 500 ? "#0a7c42" : d.difference > 2000 ? "#b91c1c" : "#8a6d00",
                    }}>{d.difference >= 0 ? "+" : ""}{fmt(d.difference)}</td>
                    <td style={{ padding: "10px 8px", fontSize: 11, color: "#888" }}>{d.period_start} ~ {d.period_end}</td>
                    <td style={{ padding: "10px 8px" }}><StatusBadge status={d.status} /></td>
                    <td style={{ padding: "10px 8px" }}>
                      {d.image_url && (
                        <button onClick={() => setSelectedImage(d.image_url)} style={{
                          padding: "4px 10px", borderRadius: 6, border: "1px solid #ddd",
                          background: "transparent", cursor: "pointer", fontSize: 12,
                        }}>📷 查看</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div onClick={() => setSelectedImage(null)} style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 9999, cursor: "pointer", padding: 20,
        }}>
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
            <img src={selectedImage} alt="單據照片"
              style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 12, objectFit: "contain" }} />
            <button onClick={() => setSelectedImage(null)} style={{
              position: "absolute", top: -12, right: -12, width: 32, height: 32,
              borderRadius: "50%", border: "none", background: "#fff", fontSize: 16,
              cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
