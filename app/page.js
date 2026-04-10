"use client";
import { useState, useEffect, useCallback } from "react";

const fmt = (n) => "$" + Number(n || 0).toLocaleString();
const ROLES = { admin: "👑 總部", manager: "🏠 管理", staff: "👤 員工" };

function Card({ label, value, sub, color }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", border: "1px solid #e8e6e1", flex: "1 1 140px", minWidth: 140 }}>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: color || "#1a1a1a" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Badge({ status }) {
  const m = { matched: { bg: "#e6f9f0", c: "#0a7c42", t: "✅ 吻合" }, minor_diff: { bg: "#fff8e6", c: "#8a6d00", t: "⚠️ 差異" }, anomaly: { bg: "#fde8e8", c: "#b91c1c", t: "🚨 異常" }, pending: { bg: "#f0f0f0", c: "#666", t: "⏳ 待核" } };
  const s = m[status] || m.pending;
  return <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 500, background: s.bg, color: s.c }}>{s.t}</span>;
}

export default function Admin() {
  const [tab, setTab] = useState("settlements");
  const [stores, setStores] = useState([]);
  const [storeFilter, setStoreFilter] = useState("");
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [settlements, setSettlements] = useState([]);
  const [summary, setSummary] = useState({});
  const [deposits, setDeposits] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmp, setNewEmp] = useState({ name: "", store_id: "", role: "staff", phone: "" });
  const [newBindCode, setNewBindCode] = useState(null);

  useEffect(() => { fetch("/api/admin/stores").then(r => r.json()).then(d => setStores(d.data || [])); }, []);

  const loadData = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (month) p.set("month", month);
    if (storeFilter) p.set("store_id", storeFilter);
    Promise.all([
      fetch(`/api/admin/settlements?${p}`).then(r => r.json()),
      fetch(`/api/admin/deposits?${p}`).then(r => r.json()),
      fetch(`/api/admin/employees`).then(r => r.json()),
    ]).then(([s, d, e]) => {
      setSettlements(s.data || []); setSummary(s.summary || {}); setDeposits(d.data || []); setEmployees(e.data || []); setLoading(false);
    });
  }, [month, storeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const addEmployee = async () => {
    const res = await fetch("/api/admin/employees", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", ...newEmp }),
    });
    const d = await res.json();
    if (d.bind_code) { setNewBindCode(d.bind_code); loadData(); }
  };

  const regenerateCode = async (id) => {
    const res = await fetch("/api/admin/employees", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate_bind_code", employee_id: id }),
    });
    const d = await res.json();
    if (d.bind_code) { alert(`新綁定碼：${d.bind_code}\n請告知員工在 LINE 輸入：綁定 ${d.bind_code}`); loadData(); }
  };

  const ts = (id) => ({
    padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14,
    fontWeight: tab === id ? 600 : 400, background: tab === id ? "#1a1a1a" : "transparent", color: tab === id ? "#fff" : "#888",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f5", fontFamily: "system-ui, 'Noto Sans TC', sans-serif" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e6e1", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>🍯</span>
          <div><div style={{ fontSize: 16, fontWeight: 600 }}>小食糖管理後台</div><div style={{ fontSize: 11, color: "#aaa" }}>Sugar Bistro Admin</div></div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }} />
          <select value={storeFilter} onChange={e => setStoreFilter(e.target.value)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }}>
            <option value="">全部門市</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          <Card label="營業淨額合計" value={fmt(summary.total_net_sales)} sub={`${summary.count || 0} 筆`} color="#0a7c42" />
          <Card label="現金合計" value={fmt(summary.total_cash)} />
          <Card label="應存現金" value={fmt(summary.total_cash_to_deposit)} color="#b45309" />
          <Card label="員工數" value={employees.filter(e => e.is_active).length} sub={`已綁定 ${employees.filter(e => e.line_uid).length}`} />
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[["settlements", "日結紀錄"], ["deposits", "存款紀錄"], ["employees", "員工管理"]].map(([id, label]) =>
            <button key={id} style={ts(id)} onClick={() => setTab(id)}>{label}</button>
          )}
        </div>

        {loading && <div style={{ textAlign: "center", padding: 40, color: "#aaa" }}>載入中...</div>}

        {/* 日結紀錄 */}
        {!loading && tab === "settlements" && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 950 }}>
              <thead><tr style={{ background: "#faf8f5", borderBottom: "1px solid #e8e6e1" }}>
                {["日期", "門市", "結單人", "營業淨額", "現金", "TWQR", "UberEat", "餐券", "發票", "應存", "照片"].map(h =>
                  <th key={h} style={{ padding: "10px 8px", textAlign: "left", fontWeight: 500, color: "#666", whiteSpace: "nowrap" }}>{h}</th>
                )}
              </tr></thead>
              <tbody>
                {settlements.length === 0 && <tr><td colSpan={11} style={{ padding: 40, textAlign: "center", color: "#ccc" }}>尚無資料</td></tr>}
                {settlements.map(s => (
                  <tr key={s.id} style={{ borderBottom: "1px solid #f0eeea" }}>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{s.date}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 500 }}>{s.stores?.name}</td>
                    <td style={{ padding: "10px 8px" }}>{s.cashier_name || "-"}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 600, color: "#0a7c42" }}>{fmt(s.net_sales)}</td>
                    <td style={{ padding: "10px 8px" }}>{fmt(s.cash_amount)}</td>
                    <td style={{ padding: "10px 8px" }}>{fmt(s.twqr_amount)}</td>
                    <td style={{ padding: "10px 8px" }}>{fmt(s.uber_eat_amount)}</td>
                    <td style={{ padding: "10px 8px" }}>{fmt(s.meal_voucher_amount)}</td>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{s.invoice_count || 0}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 500, color: "#b45309" }}>{fmt(s.cash_to_deposit)}</td>
                    <td style={{ padding: "10px 8px" }}>{s.image_url && <button onClick={() => setSelectedImage(s.image_url)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #ddd", background: "transparent", cursor: "pointer", fontSize: 12 }}>📷</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 存款紀錄 */}
        {!loading && tab === "deposits" && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 800 }}>
              <thead><tr style={{ background: "#faf8f5", borderBottom: "1px solid #e8e6e1" }}>
                {["存款日", "門市", "匯款人", "金額", "應存", "差異", "狀態", "照片"].map(h =>
                  <th key={h} style={{ padding: "10px 8px", textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>
                )}
              </tr></thead>
              <tbody>
                {deposits.length === 0 && <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#ccc" }}>尚無資料</td></tr>}
                {deposits.map(d => (
                  <tr key={d.id} style={{ borderBottom: "1px solid #f0eeea" }}>
                    <td style={{ padding: "10px 8px" }}>{d.deposit_date}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 500 }}>{d.stores?.name}</td>
                    <td style={{ padding: "10px 8px" }}>{d.depositor_name || "-"}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 600 }}>{fmt(d.amount)}</td>
                    <td style={{ padding: "10px 8px" }}>{fmt(d.expected_cash)}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 500, color: Math.abs(d.difference) <= 500 ? "#0a7c42" : "#b91c1c" }}>{d.difference >= 0 ? "+" : ""}{fmt(d.difference)}</td>
                    <td style={{ padding: "10px 8px" }}><Badge status={d.status} /></td>
                    <td style={{ padding: "10px 8px" }}>{d.image_url && <button onClick={() => setSelectedImage(d.image_url)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #ddd", background: "transparent", cursor: "pointer", fontSize: 12 }}>📷</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 員工管理 */}
        {!loading && tab === "employees" && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <button onClick={() => { setShowAddForm(!showAddForm); setNewBindCode(null); }} style={{
                padding: "8px 20px", borderRadius: 8, border: "1px solid #ddd", background: showAddForm ? "#f0f0f0" : "#1a1a1a",
                color: showAddForm ? "#666" : "#fff", fontSize: 14, cursor: "pointer",
              }}>{showAddForm ? "✕ 取消" : "＋ 新增員工"}</button>
            </div>

            {showAddForm && (
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", padding: 20, marginBottom: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>姓名 *</label>
                    <input value={newEmp.name} onChange={e => setNewEmp({ ...newEmp, name: e.target.value })} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>電話</label>
                    <input value={newEmp.phone} onChange={e => setNewEmp({ ...newEmp, phone: e.target.value })} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>門市</label>
                    <select value={newEmp.store_id} onChange={e => setNewEmp({ ...newEmp, store_id: e.target.value })} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}>
                      <option value="">總部（無門市）</option>
                      {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>角色</label>
                    <select value={newEmp.role} onChange={e => setNewEmp({ ...newEmp, role: e.target.value })} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}>
                      <option value="staff">👤 員工</option>
                      <option value="manager">🏠 管理（店長）</option>
                      <option value="admin">👑 總部</option>
                    </select>
                  </div>
                </div>
                <button onClick={addEmployee} disabled={!newEmp.name} style={{
                  padding: "10px 24px", borderRadius: 8, border: "none", background: newEmp.name ? "#0a7c42" : "#ccc",
                  color: "#fff", fontSize: 14, cursor: newEmp.name ? "pointer" : "default",
                }}>建立員工 + 產生綁定碼</button>

                {newBindCode && (
                  <div style={{ marginTop: 12, padding: 16, background: "#e6f9f0", borderRadius: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#0a7c42", marginBottom: 4 }}>✅ 員工已建立！</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#0a7c42", letterSpacing: 4, marginBottom: 8 }}>{newBindCode}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      請告知員工：<br />
                      1. 加入 LINE 好友（掃 QR Code）<br />
                      2. 在聊天室輸入：<b>綁定 {newBindCode}</b><br />
                      3. 綁定碼有效期 7 天
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "#faf8f5", borderBottom: "1px solid #e8e6e1" }}>
                  {["姓名", "角色", "門市", "LINE 綁定", "綁定碼", "操作"].map(h =>
                    <th key={h} style={{ padding: "10px 8px", textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>
                  )}
                </tr></thead>
                <tbody>
                  {employees.map(e => (
                    <tr key={e.id} style={{ borderBottom: "1px solid #f0eeea", opacity: e.is_active ? 1 : 0.4 }}>
                      <td style={{ padding: "10px 8px", fontWeight: 500 }}>{e.name}</td>
                      <td style={{ padding: "10px 8px" }}><span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 500, background: e.role === "admin" ? "#fde8e8" : e.role === "manager" ? "#e6f1fb" : "#e6f9f0", color: e.role === "admin" ? "#b91c1c" : e.role === "manager" ? "#185fa5" : "#0a7c42" }}>{ROLES[e.role] || e.role}</span></td>
                      <td style={{ padding: "10px 8px" }}>{e.stores?.name || "總部"}</td>
                      <td style={{ padding: "10px 8px" }}>{e.line_uid ? <span style={{ color: "#0a7c42" }}>✅ 已綁定</span> : <span style={{ color: "#ccc" }}>未綁定</span>}</td>
                      <td style={{ padding: "10px 8px", fontFamily: "monospace", letterSpacing: 2 }}>{e.bind_code || "-"}</td>
                      <td style={{ padding: "10px 8px" }}>
                        {!e.line_uid && (
                          <button onClick={() => regenerateCode(e.id)} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #ddd", background: "transparent", cursor: "pointer", fontSize: 12 }}>
                            🔄 重新產生綁定碼
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div onClick={() => setSelectedImage(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, cursor: "pointer", padding: 20 }}>
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
            <img src={selectedImage} alt="" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 12, objectFit: "contain" }} />
            <button onClick={() => setSelectedImage(null)} style={{ position: "absolute", top: -12, right: -12, width: 32, height: 32, borderRadius: "50%", border: "none", background: "#fff", fontSize: 16, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
