"use client";
import { useState, useEffect } from "react";
import { ap, fmt } from "./utils";

export default function WorklogMgr({ stores, sf, month }) {
  const [view, setView] = useState("completion");
  const [completionData, setCompletionData] = useState([]);
  const [inventoryData, setInventoryData] = useState([]);
  const [invDate, setInvDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [loading, setLoading] = useState(false);

  const displayStores = sf ? stores.filter(s => s.id === sf) : stores;

  const loadCompletion = () => {
    setLoading(true);
    const today = new Date().toLocaleDateString("sv-SE");
    Promise.all(
      displayStores.map(s =>
        ap("/api/admin/worklogs?month=" + month + "&store_id=" + s.id)
          .then(r => ({
            store_id: s.id,
            store_name: s.name,
            logs: r.data || [],
          }))
      )
    ).then(results => {
      setCompletionData(results);
      setLoading(false);
    });
  };

  const loadInventory = () => {
    setLoading(true);
    const storeParam = sf ? "&store_id=" + sf : "";
    ap("/api/admin/worklogs?type=inventory&date=" + invDate + storeParam)
      .then(r => {
        setInventoryData(r.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (view === "completion") loadCompletion();
    else loadInventory();
  }, [view, month, sf, invDate]);

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        <button onClick={() => setView("completion")} style={{
          padding: "4px 10px", borderRadius: 5, border: "1px solid #ddd",
          background: view === "completion" ? "#1a1a1a" : "#fff",
          color: view === "completion" ? "#fff" : "#666", fontSize: 11, cursor: "pointer"
        }}>📊 各店完成度</button>
        <button onClick={() => setView("inventory")} style={{
          padding: "4px 10px", borderRadius: 5, border: "1px solid #ddd",
          background: view === "inventory" ? "#1a1a1a" : "#fff",
          color: view === "inventory" ? "#fff" : "#666", fontSize: 11, cursor: "pointer"
        }}>📦 盤點回報</button>
      </div>

      {loading && <div style={{ textAlign: "center", padding: 20, color: "#ccc" }}>載入中...</div>}

      {/* 各店完成度 */}
      {!loading && view === "completion" && (
        <div>
          {completionData.length === 0 && (
            <div style={{ background: "#fff", borderRadius: 8, padding: 30, textAlign: "center", color: "#ccc" }}>無日誌紀錄</div>
          )}
          {completionData.map(store => {
            const todayStr = new Date().toLocaleDateString("sv-SE");
            const todayLogs = store.logs.filter(l => l.date === todayStr);
            const todayLog = todayLogs[0];
            const pct = todayLog ? todayLog.percent || 0 : 0;
            const done = todayLog ? todayLog.done || 0 : 0;
            const total = todayLog ? todayLog.total || 0 : 0;
            const people = todayLog ? (todayLog.people || []).join("、") : "";

            // 本月統計
            const monthLogs = store.logs;
            const completeDays = monthLogs.filter(l => l.percent === 100).length;
            const totalDays = monthLogs.length;

            return (
              <div key={store.store_id} style={{
                background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1",
                padding: 12, marginBottom: 8
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{"🏠 " + store.store_name}</div>
                  {pct === 100 ? (
                    <span style={{ background: "#e6f9f0", color: "#0a7c42", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>✅ 完成</span>
                  ) : total > 0 ? (
                    <span style={{ background: "#fff8e6", color: "#8a6d00", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{pct + "%"}</span>
                  ) : (
                    <span style={{ background: "#f0f0f0", color: "#ccc", padding: "2px 8px", borderRadius: 4, fontSize: 10 }}>尚未開始</span>
                  )}
                </div>

                {/* 今日進度條 */}
                {total > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#888", marginBottom: 2 }}>
                      <span>今日進度</span>
                      <span>{done + "/" + total + " 項"}</span>
                    </div>
                    <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4 }}>
                      <div style={{ height: "100%", width: Math.min(100, pct) + "%", background: pct === 100 ? "#0a7c42" : pct >= 50 ? "#fbbf24" : "#b91c1c", borderRadius: 4 }} />
                    </div>
                  </div>
                )}

                {/* 協作者 */}
                {people && (
                  <div style={{ fontSize: 10, color: "#888" }}>{"👥 " + people}</div>
                )}

                {/* 本月統計 */}
                <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>
                  {"📅 本月 " + completeDays + "/" + totalDays + " 天全完成"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 盤點回報 */}
      {!loading && view === "inventory" && (
        <div>
          <div style={{ display: "flex", gap: 4, marginBottom: 8, alignItems: "center" }}>
            <input type="date" value={invDate} onChange={e => setInvDate(e.target.value)}
              style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid #ddd", fontSize: 11 }} />
            <button onClick={loadInventory}
              style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid #ddd", background: "#fff", fontSize: 11, cursor: "pointer" }}>🔄</button>
          </div>

          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: "#faf8f5" }}>
                  {["日期", "門市", "分類", "品項", "數量", "填報人"].map(h =>
                    <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {inventoryData.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "#ccc" }}>
                    {invDate + " 無盤點紀錄"}
                  </td></tr>
                ) : inventoryData.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #f0eeea" }}>
                    <td style={{ padding: 6 }}>{item.date}</td>
                    <td style={{ padding: 6 }}>{item.store_name || ""}</td>
                    <td style={{ padding: 6 }}>
                      <span style={{
                        padding: "1px 5px", borderRadius: 3, fontSize: 9,
                        background: item.category === "庫存盤點" ? "#e6f1fb" : item.category === "冷藏盤點" ? "#e6f9f0" : "#fef9c3",
                        color: item.category === "庫存盤點" ? "#185fa5" : item.category === "冷藏盤點" ? "#0a7c42" : "#8a6d00"
                      }}>{item.category}</span>
                    </td>
                    <td style={{ padding: 6, fontWeight: 500 }}>{item.item}</td>
                    <td style={{ padding: 6, fontWeight: 700, fontSize: 13 }}>{item.value}</td>
                    <td style={{ padding: 6, fontSize: 10 }}>{item.employee_name || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
