"use client";
import { useState, useEffect } from "react";
import { ap, fmt, Badge, LT } from "./utils";

export default function LeavesMgr({ lr, pl, rvLv, sf }) {
  const [view, setView] = useState("pending");
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadBal = () => {
    setLoading(true);
    ap("/api/admin/leave-balances?year=" + new Date().getFullYear() + (sf ? "&store_id=" + sf : ""))
      .then(r => { setBalances(r.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { if (view === "balances") loadBal(); }, [view, sf]);

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        <button onClick={() => setView("pending")} style={{
          padding: "4px 10px", borderRadius: 5, border: "1px solid #ddd",
          background: view === "pending" ? "#1a1a1a" : "#fff",
          color: view === "pending" ? "#fff" : "#666", fontSize: 11, cursor: "pointer"
        }}>⏳ 待審核</button>
        <button onClick={() => setView("balances")} style={{
          padding: "4px 10px", borderRadius: 5, border: "1px solid #ddd",
          background: view === "balances" ? "#1a1a1a" : "#fff",
          color: view === "balances" ? "#fff" : "#666", fontSize: 11, cursor: "pointer"
        }}>📊 休假總表</button>
      </div>

      {/* 待審核 */}
      {view === "pending" && (
        <div>
          {pl.length > 0 && (
            <div style={{ background: "#fff8e6", borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{"⏳ 待審核（" + pl.length + "）"}</h3>
              {pl.map(l => (
                <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0", borderBottom: "1px solid #f0eeea", flexWrap: "wrap", fontSize: 12 }}>
                  <b>{l.employees ? l.employees.name : ""}</b>
                  <span style={{ color: LT[l.leave_type] ? LT[l.leave_type].c : "#666", background: LT[l.leave_type] ? LT[l.leave_type].bg : "#f0f0f0", padding: "1px 6px", borderRadius: 4, fontSize: 10 }}>
                    {LT[l.leave_type] ? LT[l.leave_type].l : l.leave_type}
                  </span>
                  <span>{l.start_date}{l.end_date !== l.start_date ? " ~ " + l.end_date : ""}</span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
                    <button onClick={() => rvLv(l.id, "approved")} style={{ padding: "3px 10px", borderRadius: 4, border: "none", background: "#0a7c42", color: "#fff", fontSize: 10, cursor: "pointer" }}>✅</button>
                    <button onClick={() => rvLv(l.id, "rejected")} style={{ padding: "3px 10px", borderRadius: 4, border: "none", background: "#b91c1c", color: "#fff", fontSize: 10, cursor: "pointer" }}>❌</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {lr.filter(l => l.status !== "pending").length > 0 && (
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead><tr style={{ background: "#faf8f5" }}>
                  {["員工", "假別", "日期", "狀態"].map(h => <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}
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

      {/* 休假總表 */}
      {view === "balances" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>{new Date().getFullYear() + " 年度休假總表"}</h3>
            <button onClick={loadBal} style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #ddd", background: "#fff", fontSize: 9, cursor: "pointer" }}>🔄</button>
          </div>
          {loading ? <div style={{ textAlign: "center", padding: 20, color: "#ccc" }}>計算中...</div> : (
            <div>
              {balances.map(b => (
                <div key={b.employee_id} style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 8 }}>
                  {/* 員工標頭 */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{b.name}</span>
                      <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>{b.store_name}</span>
                    </div>
                    {b.next_milestone && (
                      <span style={{ fontSize: 9, color: "#4361ee", background: "#e6f1fb", padding: "1px 6px", borderRadius: 4 }}>
                        {"下次升級：" + b.next_milestone.days_left + "天後（滿" + b.next_milestone.months + "月）"}
                      </span>
                    )}
                  </div>

                  {/* 假別表格 */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 6, marginBottom: 6 }}>
                    {/* 特休 */}
                    <div style={{ background: "#e6f1fb", borderRadius: 6, padding: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "#185fa5" }}>🏖 特休</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#185fa5" }}>{b.annual_remaining}</div>
                      <div style={{ fontSize: 9, color: "#888" }}>{"總" + b.annual_total + " 用" + b.annual_used}
                        {b.annual_overridden && <span style={{ color: "#b45309" }}> ✏️</span>}
                      </div>
                      <button onClick={async () => {
                        const v = prompt("修改特休時數（自動" + b.annual_auto + "hr）：", b.annual_total);
                        if (v === null) return;
                        await ap("/api/admin/leave-balances", { action: "update_balance", employee_id: b.employee_id, annual_total: Number(v) });
                        loadBal();
                      }} style={{ fontSize: 8, color: "#4361ee", background: "none", border: "none", cursor: "pointer", marginTop: 2 }}>✏️修改</button>
                    </div>

                    {/* 病假 */}
                    <div style={{ background: "#fef9c3", borderRadius: 6, padding: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "#8a6d00" }}>🏥 病假</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#8a6d00" }}>{b.sick_remaining}</div>
                      <div style={{ fontSize: 9, color: "#888" }}>{"用" + b.sick_used + " / 240hr"}</div>
                    </div>

                    {/* 事假 */}
                    <div style={{ background: "#faf8f5", borderRadius: 6, padding: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "#666" }}>📋 事假</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#666" }}>{b.personal_remaining}</div>
                      <div style={{ fontSize: 9, color: "#888" }}>{"用" + b.personal_used + " / 112hr"}</div>
                    </div>

                    {/* 補休 */}
                    <div style={{ background: b.comp_available > 0 ? "#e6f9f0" : "#f5f5f5", borderRadius: 6, padding: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "#0a7c42" }}>🔄 補休</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: b.comp_available > 0 ? "#0a7c42" : "#ccc" }}>{b.comp_available > 0 ? b.comp_available + "hr" : "-"}</div>
                      <div style={{ fontSize: 9, color: "#888" }}>
                        {b.comp_used > 0 && "已休" + b.comp_used + "hr "}
                        {b.comp_converted > 0 && "轉薪" + b.comp_converted + "hr"}
                      </div>
                      {b.comp_expiring > 0 && (
                        <div style={{ fontSize: 8, color: "#b91c1c", marginTop: 2 }}>{"⚠️ " + b.comp_expiring + "hr 即將到期"}</div>
                      )}
                    </div>
                  </div>

                  {/* 加班摘要 + 轉現金 */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "#888", borderTop: "1px solid #f0eeea", paddingTop: 6 }}>
                    <span>{"⏱ 年度加班 " + b.ot_total_hours + "hr" + (b.ot_pay_total > 0 ? "｜已領加班費 " + fmt(b.ot_pay_total) : "")}</span>
                    {b.comp_available > 0 && (
                      <button onClick={async () => {
                        if (!confirm(b.name + " 補休 " + b.comp_available + "hr 全部轉現金？")) return;
                        const r = await ap("/api/admin/leave-balances", { action: "convert_to_cash", employee_id: b.employee_id, record_ids: b.convertible_ids });
                        alert("已轉換 " + (r.converted_hours || 0) + "hr → " + fmt(r.amount));
                        loadBal();
                      }} style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #b45309", background: "transparent", color: "#b45309", fontSize: 9, cursor: "pointer" }}>
                        💰 補休轉現金
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: 9, color: "#999", marginTop: 6 }}>
            特休以月份計算（到職滿6月→24hr、12月→56hr、24月→80hr...），系統自動偵測門檻觸發。總部可✏️修改覆蓋。
          </p>
        </div>
      )}
    </div>
  );
}
