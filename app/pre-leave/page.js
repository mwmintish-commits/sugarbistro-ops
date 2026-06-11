"use client";
import { useState, useEffect } from "react";
import { PageShell, PageHeader, LoadingSkeleton, ErrorState, BackLink } from "../components/ui";
import { fetchJSON } from "@/lib/fetch-json";

const DAYS = ["日", "一", "二", "三", "四", "五", "六"];
const HOURS = Array.from({ length: 17 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);
// ["07:00" ... "23:00"]

const fmtHd = (hd) => {
  if (!hd) return "整天✕";
  const [f, t] = hd.split("~");
  return `可${f}~${t}`;
};
const hdColor = (hd) => hd ? "var(--warning)" : "var(--danger)";
const hdBg   = (hd) => hd ? "var(--warning-bg)" : "var(--danger-bg)";
const hdBorder = (hd) => hd ? "var(--sugar-400)" : "var(--danger)";

const fmtDate = (dateStr) => {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-");
  const dow = ["日","一","二","三","四","五","六"][new Date(dateStr).getDay()];
  return `${Number(m)}月${Number(d)}日（${dow}）`;
};

export default function PreLeavePage() {
  const [eid, setEid] = useState("");
  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [month, setMonth] = useState(() => {
    const now = new Date(new Date().toLocaleString("sv-SE", { timeZone: "Asia/Taipei" }));
    return new Date(now.getFullYear(), now.getMonth() + 1, 1)
      .toLocaleDateString("sv-SE").slice(0, 7);
  });

  // selections: Map<dateStr, null | "HH:MM~HH:MM">
  //   null  → 整天不可
  //   "HH:MM~HH:MM" → 可出勤時段
  const [selections, setSelections] = useState(new Map());

  // 編輯面板狀態
  const [activeDate, setActiveDate] = useState(null);
  const [panelMode, setPanelMode] = useState("full"); // "full" | "range"
  const [panelFrom, setPanelFrom] = useState("09:00");
  const [panelTo,   setPanelTo]   = useState("17:00");

  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("eid") || "";
    setEid(id);
    if (!id) { setErr("缺少員工識別碼"); setLoading(false); return; }
    fetchJSON("/api/admin/employees?id=" + id).then(r => {
      if (!r.data) { setErr("找不到員工資料"); setLoading(false); return; }
      setEmp(r.data); setLoading(false);
    }).catch(() => { setErr("載入失敗"); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!eid || !month) return;
    fetchJSON(`/api/availability?employee_id=${eid}&month=${month}`)
      .then(r => {
        const map = new Map();
        for (const rec of (r.data || [])) map.set(rec.start_date, rec.half_day || null);
        setSelections(map);
        setActiveDate(null);
      }).catch(() => {});
  }, [eid, month]);

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const todayDay = Number(today.slice(8, 10));
  const todayMonthStr = today.slice(0, 7);
  const [todayY, todayM] = todayMonthStr.split("-").map(Number);
  const nextMonthStr = new Date(todayY, todayM, 1).toLocaleDateString("sv-SE").slice(0, 7);
  const isLocked = todayDay > 25 && month === nextMonthStr;

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay();

  const openPanel = (dateStr) => {
    if (isLocked || dateStr <= today) return;
    const existing = selections.get(dateStr);
    if (existing !== undefined) {
      // 已有設定：帶入現有值
      if (existing === null) { setPanelMode("full"); }
      else { setPanelMode("range"); const [f, t] = existing.split("~"); setPanelFrom(f); setPanelTo(t); }
    } else {
      setPanelMode("full"); setPanelFrom("09:00"); setPanelTo("17:00");
    }
    setActiveDate(dateStr);
  };

  const confirmDate = () => {
    const val = panelMode === "full" ? null : `${panelFrom}~${panelTo}`;
    setSelections(prev => { const next = new Map(prev); next.set(activeDate, val); return next; });
    setActiveDate(null);
  };

  const removeDate = () => {
    setSelections(prev => { const next = new Map(prev); next.delete(activeDate); return next; });
    setActiveDate(null);
  };

  const prevMonth = () => {
    const d = new Date(y, m - 2, 1);
    const nm = d.toLocaleDateString("sv-SE").slice(0, 7);
    if (nm >= todayMonthStr) { setMonth(nm); setActiveDate(null); }
  };
  const nextMonth = () => {
    const d = new Date(y, m, 1);
    const nm = d.toLocaleDateString("sv-SE").slice(0, 7);
    if (nm <= nextMonthStr) { setMonth(nm); setActiveDate(null); }
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const slots = [...selections.entries()].map(([date, hd]) => ({ date, half_day: hd }));
    const r = await fetch("/api/availability", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", employee_id: eid, month, slots, notes }),
    }).then(r => r.json());
    setSubmitting(false);
    if (r.error) { alert("❌ " + r.error); return; }
    setDone(true);
  };

  const IS_MANAGER = ["admin", "manager", "store_manager"].includes(emp?.role);
  if (loading) return <PageShell style={{ padding: 8 }}><LoadingSkeleton kind="card" /></PageShell>;
  if (err)     return <PageShell style={{ padding: 8 }}><ErrorState message={err} onRetry={() => window.location.reload()} /></PageShell>;

  if (done) return (
    <PageShell style={{ padding: 8 }}>
      <div className="sb-card" style={{ padding: 32, textAlign: "center", marginTop: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>回報已送出</div>
        <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 6 }}>
          {selections.size > 0 ? `共回報 ${selections.size} 個限制日，主管已收到通知` : "已清除本月回報"}
        </div>
        <button onClick={() => setDone(false)}
          className="sb-btn sb-btn-primary" style={{ width: "auto", marginTop: 20, padding: "0 24px", marginRight: 10 }}>
          繼續修改
        </button>
        <a href={`/me?eid=${eid}`} className="sb-btn sb-btn-ghost" style={{ display: "inline-flex", alignItems: "center", width: "auto", marginTop: 20, padding: "12px 24px", textDecoration: "none", boxSizing: "border-box" }}>
          回面板
        </a>
      </div>
    </PageShell>
  );

  return (
    <PageShell style={{ padding: 8 }}>
      <PageHeader emoji="📋" title="不可出勤回報" subtitle={`${emp?.name || ""}　·　${emp?.stores?.name || "🏢 總部"}`} />

      <div style={{ background: "var(--info-bg)", borderRadius: 8, padding: "9px 12px", marginBottom: 8, fontSize: 12, color: "var(--info)", lineHeight: 1.6 }}>
        📌 點選日期標記<strong>無法出勤或可出勤時段</strong>，幫助主管排班。每月 25 日截止。
      </div>

      {isLocked && (
        <div style={{ background: "var(--warning-bg)", border: "1px solid var(--sugar-400)", borderRadius: 8, padding: "10px 12px", marginBottom: 8, fontSize: 12, color: "var(--warning)" }}>
          🔒 本月 25 日後已截止，下個月 1 日起可重新回報。
        </div>
      )}

      {IS_MANAGER && (
        <a href={`/availability-overview?eid=${eid}`}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px", marginBottom: 8, textDecoration: "none" }}>
          <span style={{ fontSize: 13, color: "var(--brand-strong)", fontWeight: 600 }}>👥 查看所有員工可用時段總覽</span>
          <span style={{ color: "var(--text-hint)" }}>▶</span>
        </a>
      )}

      {/* 月份導航 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
        <button onClick={prevMonth} className="sb-btn sb-btn-ghost" style={{ width: "auto", background: "var(--surface)", padding: "0 16px" }}>◀</button>
        <span style={{ fontSize: 15, fontWeight: 600, minWidth: 110, textAlign: "center" }}>{y} 年 {m} 月</span>
        <button onClick={nextMonth} className="sb-btn sb-btn-ghost" style={{ width: "auto", background: "var(--surface)", padding: "0 16px" }}>▶</button>
      </div>

      {/* 月曆 */}
      <div className="sb-card" style={{ overflow: "hidden", marginBottom: 8, opacity: isLocked ? 0.55 : 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", background: "var(--surface-warm)" }}>
          {DAYS.map(d => (
            <div key={d} style={{ padding: "5px 0", textAlign: "center", fontSize: 11, fontWeight: 600, color: d === "日" ? "var(--danger)" : d === "六" ? "var(--warning)" : "var(--text-2)" }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={"e" + i} style={{ minHeight: 52, borderTop: "1px solid var(--divider)" }} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const dow = new Date(dateStr).getDay();
            const isPast = dateStr <= today;
            const isToday = dateStr === today;
            const isSel = selections.has(dateStr);
            const hd = selections.get(dateStr);
            const isActive = activeDate === dateStr;

            return (
              <div key={dateStr} onClick={() => !isLocked && !isPast && openPanel(dateStr)}
                style={{
                  minHeight: 52, borderTop: "1px solid var(--divider)", padding: "3px 2px", boxSizing: "border-box",
                  background: isActive ? "var(--sugar-50)" : isSel ? hdBg(hd) : isToday ? "var(--sugar-50)" : "transparent",
                  outline: isActive ? "2px solid var(--brand)" : isSel ? `2px solid ${hdBorder(hd)}` : isToday ? "1px solid var(--sugar-300)" : "none",
                  outlineOffset: -2,
                  cursor: !isLocked && !isPast ? "pointer" : "default",
                }}>
                <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isPast ? "var(--text-hint)" : dow === 0 ? "var(--danger)" : dow === 6 ? "var(--warning)" : "var(--text-2)" }}>{d}</div>
                {isSel && (
                  <div style={{ fontSize: 8, color: hdColor(hd), fontWeight: 700, lineHeight: 1.25, marginTop: 1, wordBreak: "break-all" }}>
                    {fmtHd(hd)}
                  </div>
                )}
                {!isSel && !isPast && (
                  <div style={{ fontSize: 8, color: "var(--line)", textAlign: "center", marginTop: 2 }}>＋</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 日期設定面板 */}
      {activeDate && (
        <div style={{ background: "var(--surface)", borderRadius: 12, border: "2px solid var(--brand)", padding: 14, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--brand-strong)" }}>{fmtDate(activeDate)}</span>
            <button onClick={() => setActiveDate(null)} style={{ background: "none", border: "none", fontSize: 16, color: "var(--text-3)", cursor: "pointer", padding: "8px 10px" }}>✕</button>
          </div>

          {/* 模式切換 */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <button onClick={() => setPanelMode("full")}
              style={{ flex: 1, minHeight: "var(--tap-min)", borderRadius: 8, border: panelMode === "full" ? "2px solid var(--danger)" : "1px solid var(--border)", background: panelMode === "full" ? "var(--danger-bg)" : "var(--surface)", cursor: "pointer", fontSize: 13, fontWeight: panelMode === "full" ? 700 : 400, color: panelMode === "full" ? "var(--danger)" : "var(--text-2)" }}>
              ✕ 整天不可
            </button>
            <button onClick={() => setPanelMode("range")}
              style={{ flex: 1, minHeight: "var(--tap-min)", borderRadius: 8, border: panelMode === "range" ? "2px solid var(--warning)" : "1px solid var(--border)", background: panelMode === "range" ? "var(--warning-bg)" : "var(--surface)", cursor: "pointer", fontSize: 13, fontWeight: panelMode === "range" ? 700 : 400, color: panelMode === "range" ? "var(--warning)" : "var(--text-2)" }}>
              ⏰ 指定時段
            </button>
          </div>

          {/* 可出勤時段選擇 */}
          {panelMode === "range" && (
            <div style={{ background: "var(--surface-warm)", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>可出勤時段</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <select value={panelFrom} onChange={e => { setPanelFrom(e.target.value); if (e.target.value >= panelTo) setPanelTo(HOURS[Math.min(HOURS.indexOf(e.target.value) + 1, HOURS.length - 1)]); }}
                  style={{ flex: 1, padding: "10px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", textAlign: "center" }}>
                  {HOURS.slice(0, -1).map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <span style={{ fontSize: 14, color: "#888", flexShrink: 0 }}>～</span>
                <select value={panelTo} onChange={e => setPanelTo(e.target.value)}
                  style={{ flex: 1, padding: "10px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", textAlign: "center" }}>
                  {HOURS.filter(h => h > panelFrom).map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>
                例：14:00 ～ 22:00 表示這天只有下午兩點後可排班
              </div>
            </div>
          )}

          {/* 確認 / 移除 */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={confirmDate}
              className="sb-btn sb-btn-primary" style={{ flex: 2, width: "auto" }}>
              ✓ 確認
            </button>
            {selections.has(activeDate) && (
              <button onClick={removeDate}
                className="sb-btn sb-btn-ghost" style={{ flex: 1, width: "auto", background: "var(--surface)" }}>
                移除
              </button>
            )}
          </div>
        </div>
      )}

      {/* 已標記摘要 */}
      {selections.size > 0 && (
        <div className="sb-card" style={{ borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>本月回報（{selections.size} 天）</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {[...selections.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, hd]) => (
              <button key={date} onClick={() => openPanel(date)}
                style={{ fontSize: 11, background: hdBg(hd), color: hdColor(hd), border: `1px solid ${hdBorder(hd)}`, borderRadius: 4, padding: "6px 8px", cursor: "pointer" }}>
                {date.slice(5)} {fmtHd(hd)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 備註 */}
      <div className="sb-card" style={{ borderRadius: 10, padding: "10px", marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>備註（選填）</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="例：學校課程、固定有事..." rows={2}
          style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)", resize: "none", boxSizing: "border-box" }} />
      </div>

      {!isLocked && (
        <div style={{ position: "sticky", bottom: 0, background: "var(--bg)", paddingBottom: 12 }}>
          <button onClick={submit} disabled={submitting}
            className="sb-btn sb-btn-primary" style={{ fontWeight: 700 }}>
            {submitting ? "送出中..." : selections.size === 0 ? "📤 送出（清除本月回報）" : `📤 送出回報（${selections.size} 天）`}
          </button>
          <div style={{ fontSize: 10, color: "var(--text-hint)", textAlign: "center", marginTop: 4 }}>送出後主管會收到 LINE 通知</div>
        </div>
      )}

      <BackLink eid={eid} />
    </PageShell>
  );
}
