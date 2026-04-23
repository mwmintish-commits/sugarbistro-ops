"use client";
import { useState, useEffect } from "react";

const DAYS = ["日","一","二","三","四","五","六"];
const LT = { advance:{l:"預假",c:"#b45309",bg:"#fef3c7"}, holiday_comp:{l:"國定補假",c:"#b91c1c",bg:"#fde8e8"}, annual:{l:"特休",c:"#4361ee",bg:"#e6f1fb"}, sick:{l:"病假",c:"#b45309",bg:"#fff8e6"}, personal:{l:"事假",c:"#8a6d00",bg:"#fef9c3"}, menstrual:{l:"生理假",c:"#993556",bg:"#fbeaf0"}, off:{l:"例假",c:"#666",bg:"#f0f0f0"}, rest:{l:"休息日",c:"#888",bg:"#f5f5f5"}, comp_time:{l:"補休",c:"#185fa5",bg:"#e6f1fb"} };

export default function MySchedule() {
  const [scheds, setScheds] = useState([]);
  const [emp, setEmp] = useState(null);
  const [month, setMonth] = useState(() => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }).slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("month"); // "month" | "week"
  const [weekStart, setWeekStart] = useState(() => {
    const t = new Date();
    t.setDate(t.getDate() - t.getDay());
    return t.toLocaleDateString("sv-SE");
  });
  const [selectedDate, setSelectedDate] = useState(null);

  const eid = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("eid") : null;

  useEffect(() => {
    if (!eid) return;
    fetch("/api/admin/employees?id=" + eid).then(r => r.json()).then(r => setEmp(r.data));
  }, [eid]);

  useEffect(() => {
    if (!eid || !emp) return;
    setLoading(true);
    let ws, we;
    if (view === "month") {
      const [y, m] = month.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(y, m, 0);
      end.setDate(end.getDate() + (6 - end.getDay()));
      ws = start.toLocaleDateString("sv-SE");
      we = end.toLocaleDateString("sv-SE");
    } else {
      ws = weekStart;
      const we2 = new Date(weekStart);
      we2.setDate(we2.getDate() + 6);
      we = we2.toLocaleDateString("sv-SE");
    }
    const storeParam = emp.store_id ? `&store_id=${emp.store_id}` : "";
    fetch(`/api/admin/schedules?week_start=${ws}&week_end=${we}${storeParam}&published_only=1`).then(r => r.json()).then(r => {
      setScheds(r.data || []);
      setLoading(false);
    });
  }, [eid, month, emp, view, weekStart]);

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });

  const wrap = { maxWidth: 480, margin: "0 auto", padding: 8, fontFamily: "system-ui, 'Noto Sans TC', sans-serif", background: "#f7f5f0", minHeight: "100vh", boxSizing: "border-box" };

  if (!eid) return <div style={wrap}><p style={{ textAlign: "center", color: "#b91c1c", padding: 40 }}>缺少員工識別碼</p></div>;

  // 某天的所有班表（依時間排序，我排第一）
  const getDaySchedules = (date) => {
    const list = scheds.filter(s => s.date === date);
    return list.sort((a, b) => {
      if (a.employee_id === eid && b.employee_id !== eid) return -1;
      if (b.employee_id === eid && a.employee_id !== eid) return 1;
      const at = a.shifts?.start_time || "99:99";
      const bt = b.shifts?.start_time || "99:99";
      return at.localeCompare(bt);
    });
  };

  // 單筆班表列渲染（詳細列表用，較大字體）
  const renderSchedRow = (sc, isMine) => {
    const isLeave = sc.type === "leave";
    const lt = isLeave ? (LT[sc.leave_type] || LT.off) : null;
    const isRestDay = sc.day_type === "rest_day";
    const isHoliday = sc.day_type === "national_holiday";
    const name = sc.employees?.name || "";
    const timeStr = sc.shifts ? `${(sc.shifts.start_time || "").slice(0, 5)}～${(sc.shifts.end_time || "").slice(0, 5)}` : "";
    return (
      <div key={sc.id} style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
        background: isMine ? "#e6f9f0" : "#fff",
        border: `1px solid ${isMine ? "#0a7c42" : "#e8e6e1"}`,
        borderRadius: 8, marginBottom: 5,
      }}>
        <div style={{ fontSize: 16, width: 20, textAlign: "center" }}>
          {isMine ? "⭐" : isLeave ? "🌿" : isRestDay ? "💰" : isHoliday ? "🎉" : "👤"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: isMine ? 700 : 500, color: isMine ? "#0a7c42" : "#333" }}>{name}</div>
          {!isLeave && timeStr && <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>🕐 {timeStr}</div>}
          {isLeave && <div style={{ fontSize: 11, color: lt.c, marginTop: 2 }}>{lt.l}</div>}
          {isRestDay && <div style={{ fontSize: 10, color: "#b45309", marginTop: 2 }}>休息日出勤</div>}
          {isHoliday && <div style={{ fontSize: 10, color: "#b91c1c", marginTop: 2 }}>國定假日</div>}
        </div>
      </div>
    );
  };

  return (
    <div style={wrap}>
      <div style={{ background: "linear-gradient(135deg, #4361ee, #3b82f6)", borderRadius: 14, padding: "16px 16px", marginBottom: 12, color: "#fff" }}>
        <div style={{ fontSize: 11, opacity: 0.9 }}>📅 我的班表</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{emp?.name || "..."}</div>
        <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>{emp?.stores?.name || ""}</div>
      </div>

      {/* 月/週切換 */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10, background: "#fff", padding: 3, borderRadius: 8, border: "1px solid #e8e6e1" }}>
        {[{ k: "month", l: "📅 月檢視" }, { k: "week", l: "📋 週清單" }].map(t => (
          <button key={t.k} onClick={() => setView(t.k)} style={{
            flex: 1, padding: "6px 0", border: "none", borderRadius: 6,
            background: view === t.k ? "#1a1a1a" : "transparent",
            color: view === t.k ? "#fff" : "#666", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>{t.l}</button>
        ))}
      </div>

      {/* 導覽列 */}
      {view === "month" ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
          <button onClick={() => { const d = new Date(y, m - 2, 1); setMonth(d.toLocaleDateString("sv-SE").slice(0, 7)); }}
            style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>◀</button>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{y} 年 {m} 月</span>
          <button onClick={() => { const d = new Date(y, m, 1); setMonth(d.toLocaleDateString("sv-SE").slice(0, 7)); }}
            style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>▶</button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d.toLocaleDateString("sv-SE")); }}
            style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>◀</button>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {weekStart.slice(5)} ～ {(() => { const d = new Date(weekStart); d.setDate(d.getDate() + 6); return d.toLocaleDateString("sv-SE").slice(5); })()}
          </span>
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d.toLocaleDateString("sv-SE")); }}
            style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>▶</button>
          <button onClick={() => { const t = new Date(); t.setDate(t.getDate() - t.getDay()); setWeekStart(t.toLocaleDateString("sv-SE")); }}
            style={{ background: "#4361ee", border: "none", color: "#fff", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>本週</button>
        </div>
      )}

      {loading ? <p style={{ textAlign: "center", color: "#888", padding: 30 }}>載入中...</p> : view === "month" ? (
        /* ===== 月檢視 ===== */
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", background: "#faf8f5" }}>
            {DAYS.map(d => <div key={d} style={{ padding: "4px 0", textAlign: "center", fontSize: 10, fontWeight: 600, color: d === "日" ? "#b91c1c" : d === "六" ? "#b45309" : "#666" }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
            {Array.from({ length: firstDow }).map((_, i) => <div key={"e" + i} style={{ minHeight: 56, borderTop: "1px solid #f0eeea" }} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const dow = new Date(date).getDay();
              const list = getDaySchedules(date);
              const mine = list.find(s => s.employee_id === eid);
              const isToday = date === today;
              const total = list.length;
              const hasLeave = mine && mine.type === "leave";

              return (
                <div key={date} onClick={() => total > 0 && setSelectedDate(date)}
                  style={{
                    minHeight: 56, borderTop: "1px solid #f0eeea", padding: 3,
                    background: isToday ? "#e6f1fb" : dow === 0 ? "#fef2f2" : "transparent",
                    cursor: total > 0 ? "pointer" : "default",
                  }}>
                  <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 500, color: dow === 0 ? "#b91c1c" : dow === 6 ? "#b45309" : "#666", marginBottom: 2 }}>
                    {d}{isToday && <span style={{ fontSize: 7, color: "#4361ee", marginLeft: 2 }}>●</span>}
                  </div>
                  {/* 我的班（加粗強調） */}
                  {mine && !hasLeave && mine.shifts && (
                    <div style={{ background: "#0a7c42", color: "#fff", borderRadius: 3, padding: "1px 2px", fontSize: 8, fontWeight: 700, marginBottom: 1, lineHeight: 1.2 }}>
                      ⭐{(mine.shifts.start_time || "").slice(0, 5)}
                    </div>
                  )}
                  {hasLeave && (
                    <div style={{ background: (LT[mine.leave_type]||LT.off).bg, color: (LT[mine.leave_type]||LT.off).c, borderRadius: 3, padding: "1px 2px", fontSize: 8, fontWeight: 700, marginBottom: 1 }}>
                      🌿{(LT[mine.leave_type]||LT.off).l}
                    </div>
                  )}
                  {/* 其他人計數 */}
                  {total > 0 && (
                    <div style={{ fontSize: 9, color: "#888", textAlign: "center", marginTop: 2 }}>
                      👥 {total} 人
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ===== 週清單檢視 ===== */
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", overflow: "hidden" }}>
          {Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            const date = d.toLocaleDateString("sv-SE");
            const dow = d.getDay();
            const list = getDaySchedules(date);
            const isToday = date === today;
            return (
              <div key={date} style={{ borderBottom: i < 6 ? "1px solid #f0eeea" : "none", background: isToday ? "#e6f1fb" : "#fff" }}>
                <div style={{ padding: "8px 12px", background: isToday ? "#e6f1fb" : "#faf8f5", fontSize: 12, fontWeight: 600, color: dow === 0 ? "#b91c1c" : dow === 6 ? "#b45309" : "#333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{date.slice(5)} （{DAYS[dow]}）{isToday && <span style={{ color: "#4361ee", marginLeft: 6, fontSize: 10 }}>● 今天</span>}</span>
                  <span style={{ fontSize: 10, color: "#888" }}>{list.length > 0 ? `${list.length} 人` : "休息"}</span>
                </div>
                <div style={{ padding: list.length > 0 ? "6px 8px" : 0 }}>
                  {list.length === 0 ? null : list.map(sc => renderSchedRow(sc, sc.employee_id === eid))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 本月統計（月檢視下顯示） */}
      {!loading && view === "month" && (() => {
        const myAll = scheds.filter(s => s.employee_id === eid && s.date >= month + "-01" && s.date <= month + "-31");
        const shifts = myAll.filter(s => s.type === "shift");
        const leaves = myAll.filter(s => s.type === "leave");
        const restDays = shifts.filter(s => s.day_type === "rest_day");
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

      {/* 日期詳細抽屜 */}
      {selectedDate && (() => {
        const list = getDaySchedules(selectedDate);
        const d = new Date(selectedDate);
        const dow = d.getDay();
        return (
          <div onClick={() => setSelectedDate(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 480, maxHeight: "80vh", borderRadius: "14px 14px 0 0", overflow: "auto", animation: "slideUp 0.2s" }}>
              <div style={{ position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #e8e6e1", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedDate.slice(5)} （{DAYS[dow]}）</div>
                  <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{list.length} 人排班</div>
                </div>
                <button onClick={() => setSelectedDate(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>✕</button>
              </div>
              <div style={{ padding: 12 }}>
                {list.length === 0 ? (
                  <div style={{ textAlign: "center", color: "#ccc", padding: 30 }}>當日無排班</div>
                ) : list.map(sc => renderSchedRow(sc, sc.employee_id === eid))}
              </div>
            </div>
          </div>
        );
      })()}

      <style jsx>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}
