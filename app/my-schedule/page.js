"use client";
import { useState, useEffect } from "react";
import { PageShell, PageHeader, LoadingSkeleton, ErrorState, BackLink } from "../components/ui";
import { fetchJSON } from "@/lib/fetch-json";

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
  const [scopeView, setScopeView] = useState("me"); // "me" | "store"

  const eid = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("eid") : null;

  useEffect(() => {
    if (!eid) return;
    fetchJSON("/api/admin/employees?id=" + eid).then(r => setEmp(r.data)).catch(() => {});
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
    // me 模式：只抓自己的班（快）；store 模式：抓整店所有同事的班（含 employees.name/phone）
    const empParam = scopeView === "me" ? `&employee_id=${eid}` : "";
    fetchJSON(`/api/admin/schedules?week_start=${ws}&week_end=${we}${storeParam}${empParam}&published_only=1&slim=1`).then(r => {
      setScheds(r.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [eid, month, emp, view, weekStart, scopeView]);

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });

  if (!eid) return <PageShell style={{ padding: 8 }}><ErrorState message="缺少員工識別碼" /></PageShell>;

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
    const name = sc.employees?.name || (isMine ? emp?.name : "");
    const phone = sc.employees?.phone || "";
    const timeStr = sc.shifts ? `${(sc.shifts.start_time || "").slice(0, 5)}～${(sc.shifts.end_time || "").slice(0, 5)}` : "";
    return (
      <div key={sc.id} style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
        background: isMine ? "var(--success-bg)" : "var(--surface)",
        border: `1px solid ${isMine ? "var(--success)" : "var(--border)"}`,
        borderRadius: 8, marginBottom: 5,
      }}>
        <div style={{ fontSize: 16, width: 20, textAlign: "center" }}>
          {isMine ? "⭐" : isLeave ? "🌿" : isRestDay ? "💰" : isHoliday ? "🎉" : "👤"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: isMine ? 700 : 500, color: isMine ? "var(--success)" : "var(--text)" }}>{name}</div>
          {!isLeave && timeStr && <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2 }}>🕐 {timeStr}</div>}
          {isLeave && <div style={{ fontSize: 11, color: lt.c, marginTop: 2 }}>{lt.l}</div>}
          {isRestDay && <div style={{ fontSize: 10, color: "var(--warning)", marginTop: 2 }}>休息日出勤</div>}
          {isHoliday && <div style={{ fontSize: 10, color: "var(--danger)", marginTop: 2 }}>國定假日</div>}
        </div>
        {!isMine && phone && (
          <a href={`tel:${phone}`} onClick={e => e.stopPropagation()}
            style={{ padding: "10px 12px", background: "var(--brand-strong)", color: "#fff", borderRadius: 6, fontSize: 11, textDecoration: "none", whiteSpace: "nowrap" }}>
            📞 撥打
          </a>
        )}
      </div>
    );
  };

  return (
    <PageShell style={{ padding: 8 }}>
      <PageHeader emoji="📅" title="我的班表" subtitle={`${emp?.name || "..."}${emp?.stores?.name ? "　·　" + emp.stores.name : ""}`} />

      {/* 我的/全店切換 */}
      <div style={{ display: "flex", gap: 4, marginBottom: 6, background: "var(--surface)", padding: 3, borderRadius: 8, border: "1px solid var(--border)" }}>
        {[{ k: "me", l: "👤 我的班" }, { k: "store", l: "👥 全店班" }].map(t => (
          <button key={t.k} onClick={() => setScopeView(t.k)} style={{
            flex: 1, padding: "10px 0", border: "none", borderRadius: 6,
            background: scopeView === t.k ? "var(--brand-strong)" : "transparent",
            color: scopeView === t.k ? "#fff" : "var(--text-2)", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>{t.l}</button>
        ))}
      </div>
      {scopeView === "store" && (
        <div style={{ fontSize: 10, color: "var(--text-2)", textAlign: "center", marginBottom: 8, padding: "4px 10px", background: "var(--warning-bg)", borderRadius: 4 }}>
          💡 點同事可看電話、緊急可直接撥打。請僅於工作所需聯絡。
        </div>
      )}

      {/* 月/週切換 */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10, background: "var(--surface)", padding: 3, borderRadius: 8, border: "1px solid var(--border)" }}>
        {[{ k: "month", l: "📅 月檢視" }, { k: "week", l: "📋 週清單" }].map(t => (
          <button key={t.k} onClick={() => setView(t.k)} style={{
            flex: 1, padding: "10px 0", border: "none", borderRadius: 6,
            background: view === t.k ? "var(--ink)" : "transparent",
            color: view === t.k ? "#fff" : "var(--text-2)", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>{t.l}</button>
        ))}
      </div>

      {/* 導覽列 */}
      {view === "month" ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
          <button onClick={() => { const d = new Date(y, m - 2, 1); setMonth(d.toLocaleDateString("sv-SE").slice(0, 7)); }}
            className="sb-btn sb-btn-ghost" style={{ width: "auto", background: "var(--surface)", padding: "0 16px" }}>◀</button>
          <span style={{ fontSize: 15, fontWeight: 600, minWidth: 110, textAlign: "center" }}>{y} 年 {m} 月</span>
          <button onClick={() => { const d = new Date(y, m, 1); setMonth(d.toLocaleDateString("sv-SE").slice(0, 7)); }}
            className="sb-btn sb-btn-ghost" style={{ width: "auto", background: "var(--surface)", padding: "0 16px" }}>▶</button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d.toLocaleDateString("sv-SE")); }}
            className="sb-btn sb-btn-ghost" style={{ width: "auto", background: "var(--surface)", padding: "0 14px" }}>◀</button>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {weekStart.slice(5)} ～ {(() => { const d = new Date(weekStart); d.setDate(d.getDate() + 6); return d.toLocaleDateString("sv-SE").slice(5); })()}
          </span>
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d.toLocaleDateString("sv-SE")); }}
            className="sb-btn sb-btn-ghost" style={{ width: "auto", background: "var(--surface)", padding: "0 14px" }}>▶</button>
          <button onClick={() => { const t = new Date(); t.setDate(t.getDate() - t.getDay()); setWeekStart(t.toLocaleDateString("sv-SE")); }}
            className="sb-btn sb-btn-primary" style={{ width: "auto", padding: "0 14px", fontSize: 12 }}>本週</button>
        </div>
      )}

      {loading ? <LoadingSkeleton kind="card" /> : view === "month" ? (
        /* ===== 月檢視 ===== */
        <div className="sb-card" style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", background: "var(--surface-warm)" }}>
            {DAYS.map(d => <div key={d} style={{ padding: "4px 0", textAlign: "center", fontSize: 10, fontWeight: 600, color: d === "日" ? "var(--danger)" : d === "六" ? "var(--warning)" : "var(--text-2)" }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
            {Array.from({ length: firstDow }).map((_, i) => <div key={"e" + i} style={{ minHeight: 56, borderTop: "1px solid var(--divider)" }} />)}
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
                    minHeight: 56, borderTop: "1px solid var(--divider)", padding: 3,
                    background: isToday ? "var(--sugar-50)" : dow === 0 ? "var(--danger-bg)" : "transparent",
                    cursor: total > 0 ? "pointer" : "default",
                  }}>
                  <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 500, color: dow === 0 ? "var(--danger)" : dow === 6 ? "var(--warning)" : "var(--text-2)", marginBottom: 2 }}>
                    {d}{isToday && <span style={{ fontSize: 7, color: "var(--brand)", marginLeft: 2 }}>●</span>}
                  </div>
                  {/* 我的班（加粗強調） */}
                  {mine && !hasLeave && mine.shifts && (
                    <div style={{ background: "var(--success)", color: "#fff", borderRadius: 3, padding: "1px 2px", fontSize: 8, fontWeight: 700, marginBottom: 1, lineHeight: 1.2 }}>
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
                    <div style={{ fontSize: 9, color: "var(--text-3)", textAlign: "center", marginTop: 2 }}>
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
        <div className="sb-card" style={{ overflow: "hidden" }}>
          {Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            const date = d.toLocaleDateString("sv-SE");
            const dow = d.getDay();
            const list = getDaySchedules(date);
            const isToday = date === today;
            return (
              <div key={date} style={{ borderBottom: i < 6 ? "1px solid var(--divider)" : "none", background: isToday ? "var(--sugar-50)" : "var(--surface)" }}>
                <div style={{ padding: "8px 12px", background: isToday ? "var(--sugar-50)" : "var(--surface-warm)", fontSize: 12, fontWeight: 600, color: dow === 0 ? "var(--danger)" : dow === 6 ? "var(--warning)" : "var(--text)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{date.slice(5)} （{DAYS[dow]}）{isToday && <span style={{ color: "var(--brand-strong)", marginLeft: 6, fontSize: 10 }}>● 今天</span>}</span>
                  <span style={{ fontSize: 10, color: "var(--text-3)" }}>{list.length > 0 ? `${list.length} 人` : "休息"}</span>
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
          <div className="sb-card" style={{ marginTop: 12, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>📊 本月統計</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, fontSize: 11 }}>
              <div style={{ textAlign: "center", padding: 6, background: "var(--success-bg)", borderRadius: 6 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--success)" }}>{shifts.length}</div>
                <div style={{ color: "var(--text-3)", fontSize: 9 }}>排班天</div>
              </div>
              <div style={{ textAlign: "center", padding: 6, background: "var(--info-bg)", borderRadius: 6 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--info)" }}>{leaves.length}</div>
                <div style={{ color: "var(--text-3)", fontSize: 9 }}>休假天</div>
              </div>
              <div style={{ textAlign: "center", padding: 6, background: "var(--warning-bg)", borderRadius: 6 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--warning)" }}>{restDays.length}</div>
                <div style={{ color: "var(--text-3)", fontSize: 9 }}>休息日出勤</div>
              </div>
            </div>
          </div>
        );
      })()}

      <BackLink eid={eid} />

      {/* 日期詳細抽屜 */}
      {selectedDate && (() => {
        const list = getDaySchedules(selectedDate);
        const d = new Date(selectedDate);
        const dow = d.getDay();
        return (
          <div onClick={() => setSelectedDate(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", width: "100%", maxWidth: 480, maxHeight: "80vh", borderRadius: "14px 14px 0 0", overflow: "auto", animation: "slideUp 0.2s", paddingBottom: "env(safe-area-inset-bottom)" }}>
              <div style={{ position: "sticky", top: 0, background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedDate.slice(5)} （{DAYS[dow]}）</div>
                  <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>{list.length} 人排班</div>
                </div>
                <button onClick={() => setSelectedDate(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-3)", padding: "4px 10px" }}>✕</button>
              </div>
              <div style={{ padding: 12 }}>
                {list.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--text-hint)", padding: 30 }}>當日無排班</div>
                ) : list.map(sc => renderSchedRow(sc, sc.employee_id === eid))}
              </div>
            </div>
          </div>
        );
      })()}

      <style jsx>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </PageShell>
  );
}
