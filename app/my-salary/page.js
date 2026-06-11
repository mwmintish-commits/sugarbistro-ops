"use client";
import { useState, useEffect } from "react";
import { PageShell, PageHeader, LoadingSkeleton, EmptyState, ErrorState, BackLink } from "../components/ui";
import { fetchJSON } from "@/lib/fetch-json";

const fmt = n => "$" + Number(n || 0).toLocaleString();

export default function MySalary() {
  const [emp, setEmp] = useState(null);
  const [record, setRecord] = useState(null);
  const [month, setMonth] = useState(() => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }).slice(0, 7));
  const [loading, setLoading] = useState(true);

  const eid = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("eid") : null;

  useEffect(() => {
    if (!eid) return;
    fetchJSON("/api/admin/employees?id=" + eid).then(r => setEmp(r.data)).catch(() => {});
  }, [eid]);

  useEffect(() => {
    if (!eid || !month) return;
    setLoading(true);
    fetchJSON(`/api/admin/payroll?month=${month}`).then(r => {
      const mine = (r.data || []).find(p => p.employee_id === eid);
      setRecord(mine || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [eid, month]);

  if (!eid) return <PageShell maxWidth={420}><ErrorState message="缺少員工識別碼" /></PageShell>;

  const [y, m] = month.split("-").map(Number);

  return (
    <PageShell maxWidth={420}>
      <PageHeader emoji="💰" title="我的薪資" subtitle={emp?.name || "..."} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
        <button onClick={() => { const d = new Date(y, m - 2, 1); setMonth(d.toLocaleDateString("sv-SE").slice(0, 7)); }}
          className="sb-btn sb-btn-ghost" style={{ width: "auto", background: "var(--surface)", padding: "0 16px" }}>◀</button>
        <span style={{ fontSize: 15, fontWeight: 600, minWidth: 110, textAlign: "center" }}>{y} 年 {m} 月</span>
        <button onClick={() => { const d = new Date(y, m, 1); setMonth(d.toLocaleDateString("sv-SE").slice(0, 7)); }}
          className="sb-btn sb-btn-ghost" style={{ width: "auto", background: "var(--surface)", padding: "0 16px" }}>▶</button>
      </div>

      {loading ? <LoadingSkeleton /> : !record ? (
        <div className="sb-card">
          <EmptyState icon="📄" title="本月尚未結算薪資" />
        </div>
      ) : (
        <div className="sb-card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", background: "var(--surface-warm)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>薪資明細</span>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>出勤 {record.work_days} 天</span>
          </div>
          <div style={{ padding: 14 }}>
            <Row l="底薪" v={fmt(record.base_salary)} bold />
            {record.overtime_pay > 0 && <Row l="⏱ 加班費" v={"+" + fmt(record.overtime_pay)} color="var(--success)" />}
            {record.holiday_pay > 0 && <Row l="🎉 國定假日" v={"+" + fmt(record.holiday_pay)} color="var(--success)" />}
            {record.rest_day_pay > 0 && <Row l="💰 休息日加班" v={"+" + fmt(record.rest_day_pay)} color="var(--success)" />}
            {record.allowance > 0 && <Row l={"津貼" + (record.allowance_note ? "（" + record.allowance_note + "）" : "")} v={"+" + fmt(record.allowance)} color="var(--success)" />}
            {record.bonus_amount > 0 && <Row l="🏆 獎金" v={"+" + fmt(record.bonus_amount)} color="var(--success)" />}
            <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />
            {record.labor_self > 0 && <Row l="🛡 勞保自付" v={"-" + fmt(record.labor_self)} color="var(--danger)" />}
            {record.health_self > 0 && <Row l="🏥 健保自付" v={"-" + fmt(record.health_self)} color="var(--danger)" />}
            {record.supplementary_health > 0 && <Row l="🏥 補充保費" v={"-" + fmt(record.supplementary_health)} color="var(--danger)" />}
            {record.leave_deduction > 0 && <Row l={"📋 請假扣款" + (record.leave_detail ? "（" + record.leave_detail + "）" : "")} v={"-" + fmt(record.leave_deduction)} color="var(--danger)" />}
            {record.other_deduction > 0 && <Row l={"扣項" + (record.deduction_note ? "（" + record.deduction_note + "）" : "")} v={"-" + fmt(record.other_deduction)} color="var(--danger)" />}
            <div style={{ height: 2, background: "var(--ink)", margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700 }}>
              <span>實發金額</span>
              <span style={{ color: "var(--success)" }}>{fmt(record.net_salary)}</span>
            </div>
            {record.comp_hours > 0 && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>🔄 本月補休 {record.comp_hours} 小時</div>}
          </div>
        </div>
      )}

      <BackLink eid={eid} />
    </PageShell>
  );
}

function Row({ l, v, bold, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 13 }}>
      <span style={{ color: "var(--text-2)" }}>{l}</span>
      <span style={{ fontWeight: bold ? 600 : 400, color: color || "var(--text)" }}>{v}</span>
    </div>
  );
}
