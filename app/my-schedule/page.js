"use client";
import { useState, useEffect } from "react";

const DAYS = ["日","一","二","三","四","五","六"];
const LT = { advance:{l:"預假",c:"#b45309",bg:"#fef3c7"}, holiday_comp:{l:"國定補假",c:"#b91c1c",bg:"#fde8e8"}, annual:{l:"特休",c:"#4361ee",bg:"#e6f1fb"}, sick:{l:"病假",c:"#b45309",bg:"#fff8e6"}, personal:{l:"事假",c:"#8a6d00",bg:"#fef9c3"}, menstrual:{l:"生理假",c:"#993556",bg:"#fbeaf0"}, off:{l:"例假",c:"#666",bg:"#f0f0f0"}, rest:{l:"休息日",c:"#888",bg:"#f5f5f5"}, comp_time:{l:"補休",c:"#185fa5",bg:"#e6f1fb"} };

export default function MySchedule() {
  const [scheds, setScheds] = useState([]);
  const [emp, setEmp] = useState(null);
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
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(y, m, 0);
    end.setDate(end.getDate() + (6 - end.getDay()));
    const ws = start.toLocaleDateString("sv-SE");
    const we = end.toLocaleDateString("sv-SE");
    fetch(`/api/admin/schedules?week_start=${ws}&week_end=${we}`).then(r => r.json()).then(r => {
      setScheds((r.data || []).filter(s => s.employee_id === eid));
      setLoading(false);
    });
  }, [eid, month]);

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay();

  const wrap = { maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "system-ui, 'Noto Sans TC', sans-serif", background: "#f7f5f0", minHeight: "100vh" };

  if (!eid) return <div style={wrap}><p style={{ textAlign: "center", color: "#b91c1c", padding: 40 }}>缺少員工識別碼</p></div>;

  return (
    <div style={wrap}>
      <div style={{ background: "linear-gradient(135deg, #4361ee, #3b82f6)", borderRadius: 14, padding: "16px 16px", marginBottom: 12, color: "#fff" }}>
        <div style={{ fontSize: 11, opacity: 0.9 }}>📅 我的班表</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{emp?.name || "..."}</div>
        <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>{emp?.stores?.name || ""}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
        <button onClick={() => { const d = new Date(y, m - 2, 1); setMonth(d.toLocaleDateString("sv-SE").slice(0, 7)); }}
          style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>◀</button>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{y} 年 {m} 月</span>
        <button onClick={() => { const d = new Date(y, m, 1); setMonth(d.toLocaleDateString("sv-SE").slice(0, 7)); }}
          style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>▶</button>
      </div>

      {loading ? <p style={{ textAlign: "center", color: "#888", padding: 30 }}>載入中...</p> : (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "#faf8f5" }}>
            {DAYS.map(d => <div key={d} style={{ padding: "6px 0", textAlign: "center", fontSize: 11, fontWeight: 600, color: d === "日" ? "#b91c1c" : d === "六" ? "#b45309" : "#666" }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {Array.from({ length: firstDow }).map((_, i) => <div key={"e" + i} style={{ minHeight: 56, borderTop: "1px solid #f0eeea" }} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const dow = new Date(date).getDay();
              const sc = scheds.find(s => s.date === date);
              const isLeave = sc?.type === "leave";
              const lt = isLeave ? (LT[sc.leave_type] || LT.off) : null;
              const isToday = date === new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
              const isRestDay = sc?.day_type === "rest_day" || sc?.is_rest_day;
              const isHoliday = sc?.day_type === "national_holiday";

              return (
                <div key={date} style={{ minHeight: 56, borderTop: "1px solid #f0eeea", padding: 3, background: isToday ? "#e6f1fb" : dow === 0 ? "#fef2f2" : "transparent" }}>
                  <div style={{ fontSize: 10, fontWeight: isToday ? 700 : 400, color: dow === 0 ? "#b91c1c" : dow === 6 ? "#b45309" : "#666", marginBottom: 2 }}>
                    {d}{isToday && <span style={{ fontSize: 7, color: "#4361ee", marginLeft: 2 }}>today</span>}
                  </div>
                  {sc && (
                    <div style={{ background: isLeave ? lt.bg : isRestDay ? "#fff8e6" : isHoliday ? "#fde8e8" : "#e6f9f0", border: `1px solid ${isLeave ? lt.c : isRestDay ? "#b45309" : isHoliday ? "#b91c1c" : "#0a7c42"}`, borderRadius: 4, padding: "2px 3px", fontSize: 8, lineHeight: 1.3 }}>
                      {isLeave ? (
                        <div style={{ color: lt.c, fontWeight: 600 }}>{lt.l}</div>
                      ) : (
                        <>
                          <div style={{ fontWeight: 600, color: isRestDay ? "#b45309" : isHoliday ? "#b91c1c" : "#0a7c42" }}>
                            {isRestDay ? "💰 " : isHoliday ? "🎉 " : ""}{sc.shifts?.name || "班"}
                          </div>
                          <div style={{ color: "#888" }}>{sc.shifts ? `${(sc.shifts.start_time || "").slice(0, 5)}~${(sc.shifts.end_time || "").slice(0, 5)}` : ""}</div>
                        </>
                      )}
                    </div>
                  )}
                  {!sc && <div style={{ fontSize: 8, color: "#ddd", textAlign: "center", marginTop: 8 }}>-</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 本月統計 */}
      {!loading && (() => {
        const shifts = scheds.filter(s => s.type === "shift" && s.date >= month + "-01" && s.date <= month + "-31");
        const leaves = scheds.filter(s => s.type === "leave" && s.date >= month + "-01" && s.date <= month + "-31");
        const restDays = shifts.filter(s => s.day_type === "rest_day" || s.is_rest_day);
        return (
          <div style={{ marginTop: 12, background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>📊 本月統計</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, fontSize: 11 }}>
              <div style={{ textAlign: "center", padding: 6, background: "#e6f9f0", borderRadius: 6 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0a7c42" }}>{shifts.length}</div>
                <div style={{ color: "#888", fontSize: 9 }}>排班天</div>
              </div>
              <div style={{ textAlign: "center", padding: 6, background: "#e6f1fb", borderRadius: 6 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#4361ee" }}>{leaves.length}</div>
                <div style={{ color: "#888", fontSize: 9 }}>休假天</div>
              </div>
              <div style={{ textAlign: "center", padding: 6, background: "#fff8e6", borderRadius: 6 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#b45309" }}>{restDays.length}</div>
                <div style={{ color: "#888", fontSize: 9 }}>休息日出勤</div>
              </div>
            </div>
          </div>
        );
      })()}

      <div style={{ marginTop: 14, textAlign: "center" }}>
        <a href={`/me?eid=${eid}`} style={{ fontSize: 12, color: "#4361ee" }}>← 回面板</a>
      </div>
    </div>
  );
}
