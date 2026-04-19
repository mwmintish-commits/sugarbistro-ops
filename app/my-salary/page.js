"use client";
import { useState, useEffect } from "react";

const fmt = n => "$" + Number(n || 0).toLocaleString();

export default function MySalary() {
  const [emp, setEmp] = useState(null);
  const [record, setRecord] = useState(null);
  const [month, setMonth] = useState(() => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }).slice(0, 7));
  const [loading, setLoading] = useState(true);

  const eid = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("eid") : null;

  useEffect(() => {
    if (!eid) return;
    fetch("/api/admin/employees?id=" + eid).then(r => r.json()).then(r => setEmp(r.data));
  }, [eid]);

  useEffect(() => {
    if (!eid || !month) return;
    setLoading(true);
    fetch(`/api/admin/payroll?month=${month}`).then(r => r.json()).then(r => {
      const mine = (r.data || []).find(p => p.employee_id === eid);
      setRecord(mine || null);
      setLoading(false);
    });
  }, [eid, month]);

  const wrap = { maxWidth: 420, margin: "0 auto", padding: 16, fontFamily: "system-ui, 'Noto Sans TC', sans-serif", background: "#f7f5f0", minHeight: "100vh" };
  if (!eid) return <div style={wrap}><p style={{ textAlign: "center", color: "#b91c1c", padding: 40 }}>缺少員工識別碼</p></div>;

  const [y, m] = month.split("-").map(Number);

  return (
    <div style={wrap}>
      <div style={{ background: "linear-gradient(135deg, #b45309, #d97706)", borderRadius: 14, padding: "16px", marginBottom: 12, color: "#fff" }}>
        <div style={{ fontSize: 11, opacity: 0.9 }}>💰 我的薪資</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{emp?.name || "..."}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
        <button onClick={() => { const d = new Date(y, m - 2, 1); setMonth(d.toLocaleDateString("sv-SE").slice(0, 7)); }}
          style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>◀</button>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{y} 年 {m} 月</span>
        <button onClick={() => { const d = new Date(y, m, 1); setMonth(d.toLocaleDateString("sv-SE").slice(0, 7)); }}
          style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>▶</button>
      </div>

      {loading ? <p style={{ textAlign: "center", color: "#888" }}>載入中...</p> : !record ? (
        <div style={{ background: "#fff", borderRadius: 12, padding: 24, textAlign: "center", color: "#888" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
          <div style={{ fontSize: 13 }}>本月尚未結算薪資</div>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", background: "#faf8f5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>薪資明細</span>
            <span style={{ fontSize: 10, color: "#888" }}>出勤 {record.work_days} 天</span>
          </div>
          <div style={{ padding: 14 }}>
            <Row l="底薪" v={fmt(record.base_salary)} bold />
            {record.overtime_pay > 0 && <Row l="⏱ 加班費" v={"+" + fmt(record.overtime_pay)} color="#0a7c42" />}
            {record.holiday_pay > 0 && <Row l="🎉 國定假日" v={"+" + fmt(record.holiday_pay)} color="#0a7c42" />}
            {record.rest_day_pay > 0 && <Row l="💰 休息日加班" v={"+" + fmt(record.rest_day_pay)} color="#0a7c42" />}
            {record.allowance > 0 && <Row l={"津貼" + (record.allowance_note ? "（" + record.allowance_note + "）" : "")} v={"+" + fmt(record.allowance)} color="#0a7c42" />}
            {record.bonus_amount > 0 && <Row l="🏆 獎金" v={"+" + fmt(record.bonus_amount)} color="#0a7c42" />}
            <div style={{ height: 1, background: "#e8e6e1", margin: "6px 0" }} />
            {record.labor_self > 0 && <Row l="🛡 勞保自付" v={"-" + fmt(record.labor_self)} color="#b91c1c" />}
            {record.health_self > 0 && <Row l="🏥 健保自付" v={"-" + fmt(record.health_self)} color="#b91c1c" />}
            {record.supplementary_health > 0 && <Row l="🏥 補充保費" v={"-" + fmt(record.supplementary_health)} color="#b91c1c" />}
            {record.leave_deduction > 0 && <Row l={"📋 請假扣款" + (record.leave_detail ? "（" + record.leave_detail + "）" : "")} v={"-" + fmt(record.leave_deduction)} color="#b91c1c" />}
            {record.other_deduction > 0 && <Row l={"扣項" + (record.deduction_note ? "（" + record.deduction_note + "）" : "")} v={"-" + fmt(record.other_deduction)} color="#b91c1c" />}
            <div style={{ height: 2, background: "#1a1a1a", margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700 }}>
              <span>實發金額</span>
              <span style={{ color: "#0a7c42" }}>{fmt(record.net_salary)}</span>
            </div>
            {record.comp_hours > 0 && <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>🔄 本月補休 {record.comp_hours} 小時</div>}
          </div>
        </div>
      )}

      <div style={{ marginTop: 14, textAlign: "center" }}>
        <a href={`/me?eid=${eid}`} style={{ fontSize: 12, color: "#4361ee" }}>← 回面板</a>
      </div>
    </div>
  );
}

function Row({ l, v, bold, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 13 }}>
      <span style={{ color: "#666" }}>{l}</span>
      <span style={{ fontWeight: bold ? 600 : 400, color: color || "#222" }}>{v}</span>
    </div>
  );
}
