"use client";
import { useState, useEffect } from "react";
import { ap, Badge, LT } from "./utils";

export default function LeavesMgr({ lr, pl, rvLv, sf }) {
  const [view, setView] = useState("pending");
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (view === "balances") {
      setLoading(true);
      ap("/api/admin/leave-balances?year=" + new Date().getFullYear() + (sf ? "&store_id=" + sf : ""))
        .then(r => { setBalances(r.data || []); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [view, sf]);

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        <button onClick={() => setView("pending")} style={{
          padding: "4px 10px", borderRadius: 5, border: "1px solid #ddd",
          background: view === "pending" ? "#1a1a1a" : "#fff",
          color: view === "pending" ? "#fff" : "#666", fontSize: 11, cursor: "pointer"
        }}>⏳ 待審核/紀錄</button>
        <button onClick={() => setView("balances")} style={{
          padding: "4px 10px", borderRadius: 5, border: "1px solid #ddd",
          background: view === "balances" ? "#1a1a1a" : "#fff",
          color: view === "balances" ? "#fff" : "#666", fontSize: 11, cursor: "pointer"
        }}>📊 假勤總覽</button>
      </div>

      {view === "pending" && (
        <div>
          {pl.length > 0 && (
            <div style={{ background: "#fff8e6", borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{"⏳ 待審核（" + pl.length + "）"}</h3>
              {pl.map(l => (
                <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0", borderBottom: "1px solid #f0eeea", flexWrap: "wrap", fontSize: 12 }}>
                  <b>{l.employees ? l.employees.name : ""}</b>
                  <span style={{
                    color: LT[l.leave_type] ? LT[l.leave_type].c : "#666",
                    background: LT[l.leave_type] ? LT[l.leave_type].bg : "#f0f0f0",
                    padding: "1px 6px", borderRadius: 4, fontSize: 10
                  }}>{LT[l.leave_type] ? LT[l.leave_type].l : l.leave_type}</span>
                  <span>{l.start_date}{l.end_date !== l.start_date ? " ~ " + l.end_date : ""}</span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
                    <button onClick={() => rvLv(l.id, "approved")}
                      style={{ padding: "3px 10px", borderRadius: 4, border: "none", background: "#0a7c42", color: "#fff", fontSize: 10, cursor: "pointer" }}>✅ 核准</button>
                    <button onClick={() => rvLv(l.id, "rejected")}
                      style={{ padding: "3px 10px", borderRadius: 4, border: "none", background: "#b91c1c", color: "#fff", fontSize: 10, cursor: "pointer" }}>❌ 駁回</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {lr.filter(l => l.status !== "pending").length > 0 && (
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead><tr style={{ background: "#faf8f5" }}>
                  {["員工", "假別", "日期", "狀態"].map(h =>
                    <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>
                  )}
                </tr></thead>
                <tbody>{lr.filter(l => l.status !== "pending").map(l => (
                  <tr key={l.id} style={{ borderBottom: "1px solid #f0eeea" }}>
                    <td style={{ padding: 6, fontWeight: 500 }}>{l.employees ? l.employees.name : ""}</td>
                    <td style={{ padding: 6 }}>{LT[l.leave_type] ? LT[l.leave_type].l : l.leave_type}</td>
                    <td style={{ padding: 6 }}>{l.start_date}{l.end_date !== l.start_date ? " ~ " + l.end_date : ""}</td>
                    <td style={{ padding: 6 }}><Badge status={l.status} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {lr.length === 0 && pl.length === 0 && (
            <div style={{ background: "#fff", borderRadius: 8, padding: 30, textAlign: "center", color: "#ccc" }}>本月無請假紀錄</div>
          )}
        </div>
      )}

      {view === "balances" && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{new Date().getFullYear() + " 年度假勤總覽"}</h3>
          {loading ? <p style={{ color: "#ccc", textAlign: "center", padding: 20 }}>計算中...</p> : (
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead><tr style={{ background: "#faf8f5" }}>
                  {["員工", "門市", "特休(總/用/剩)", "病假(用/30)", "事假(用/14)"].map(h =>
                    <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>
                  )}
                </tr></thead>
                <tbody>{balances.map(b => (
                  <tr key={b.employee_id} style={{ borderBottom: "1px solid #f0eeea" }}>
                    <td style={{ padding: 6, fontWeight: 500 }}>{b.name}</td>
                    <td style={{ padding: 6 }}>{b.store_name}</td>
                    <td style={{ padding: 6 }}>
                      <span style={{ color: "#4361ee" }}>{b.annual_total}</span>
                      {" / "}
                      <span style={{ color: "#b91c1c" }}>{b.annual_used}</span>
                      {" / "}
                      <b style={{ color: b.annual_remaining > 0 ? "#0a7c42" : "#b91c1c" }}>{b.annual_remaining}</b>
                    </td>
                    <td style={{ padding: 6 }}><span style={{ color: "#b91c1c" }}>{b.sick_used}</span>{" / 30"}</td>
                    <td style={{ padding: 6 }}><span style={{ color: "#b91c1c" }}>{b.personal_used}</span>{" / 14"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <p style={{ fontSize: 10, color: "#999", marginTop: 6 }}>
            {"* 特休依勞基法§38自動計算：滿6月3天、1年7天、2年10天、3年14天、5年15天"}
          </p>
        </div>
      )}
    </div>
  );
}
