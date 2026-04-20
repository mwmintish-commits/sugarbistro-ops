"use client";
import { useState, useEffect } from "react";

const DAYS = ["日", "一", "二", "三", "四", "五", "六"];
const HALF_LABELS = { "": "整天", am: "上午", pm: "下午" };
const HALF_COLORS = { "": "#b91c1c", am: "#1565c0", pm: "#6a1b9a" };

export default function PreLeavePage() {
  const [eid, setEid] = useState("");
  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // 預設下個月
  const [month, setMonth] = useState(() => {
    const now = new Date(new Date().toLocaleString("sv-SE", { timeZone: "Asia/Taipei" }));
    return new Date(now.getFullYear(), now.getMonth() + 1, 1)
      .toLocaleDateString("sv-SE").slice(0, 7);
  });

  // selections: Map<dateStr, half_day>  ("" | "am" | "pm")
  const [selections, setSelections] = useState(new Map());
  const [mode, setMode] = useState(""); // 當前點擊模式
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("eid") || "";
    setEid(id);
    if (!id) { setErr("缺少員工識別碼"); setLoading(false); return; }
    fetch("/api/admin/employees?id=" + id).then(r => r.json()).then(r => {
      if (!r.data) { setErr("找不到員工資料"); setLoading(false); return; }
      setEmp(r.data);
      setLoading(false);
    }).catch(() => { setErr("載入失敗"); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!eid || !month) return;
    fetch(`/api/availability?employee_id=${eid}&month=${month}`)
      .then(r => r.json()).then(r => {
        const map = new Map();
        for (const rec of (r.data || [])) {
          map.set(rec.start_date, rec.half_day || "");
        }
        setSelections(map);
      });
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

  const prevMonth = () => {
    const d = new Date(y, m - 2, 1);
    const nm = d.toLocaleDateString("sv-SE").slice(0, 7);
    if (nm >= todayMonthStr) setMonth(nm);
  };
  const nextMonth = () => {
    const d = new Date(y, m, 1);
    const nm = d.toLocaleDateString("sv-SE").slice(0, 7);
    if (nm <= nextMonthStr) setMonth(nm);
  };

  const toggleDate = (dateStr) => {
    if (isLocked || dateStr <= today) return;
    setSelections(prev => {
      const next = new Map(prev);
      if (next.has(dateStr)) {
        // 若已選且 mode 相同 → 移除；若 mode 不同 → 更新時段
        if (next.get(dateStr) === mode) next.delete(dateStr);
        else next.set(dateStr, mode);
      } else {
        next.set(dateStr, mode);
      }
      return next;
    });
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const slots = [...selections.entries()].map(([date, half_day]) => ({ date, half_day }));
    const r = await fetch("/api/availability", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", employee_id: eid, month, slots, notes }),
    }).then(r => r.json());
    setSubmitting(false);
    if (r.error) { alert("❌ " + r.error); return; }
    setDone(true);
  };

  const IS_MANAGER = ["admin", "manager", "store_manager"].includes(emp?.role);

  const wrap = {
    maxWidth: 480, margin: "0 auto", padding: 8,
    fontFamily: "system-ui, 'Noto Sans TC', sans-serif",
    background: "#f7f5f0", minHeight: "100vh", boxSizing: "border-box",
  };

  if (loading) return <div style={wrap}><p style={{ textAlign: "center", color: "#888", padding: 60 }}>載入中...</p></div>;
  if (err) return <div style={wrap}><p style={{ textAlign: "center", color: "#b91c1c", padding: 60 }}>{err}</p></div>;

  if (done) return (
    <div style={wrap}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 32, textAlign: "center", marginTop: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>回報已送出</div>
        <div style={{ fontSize: 13, color: "#888", marginTop: 6 }}>
          {selections.size > 0 ? `共回報 ${selections.size} 個不可出勤日，主管已收到通知` : "已清除本月回報"}
        </div>
        <button onClick={() => setDone(false)}
          style={{ marginTop: 20, padding: "10px 24px", borderRadius: 8, border: "none", background: "#3f51b5", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", marginRight: 10 }}>
          繼續修改
        </button>
        <a href={`/me?eid=${eid}`}
          style={{ display: "inline-block", marginTop: 20, padding: "10px 24px", borderRadius: 8, background: "#f0ede8", color: "#333", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          回面板
        </a>
      </div>
    </div>
  );

  return (
    <div style={wrap}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #3f51b5, #1a237e)", borderRadius: 14, padding: "14px 16px", marginBottom: 10, color: "#fff" }}>
        <div style={{ fontSize: 11, opacity: 0.85 }}>📋 不可出勤回報</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{emp?.name}</div>
        <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>{emp?.stores?.name || "🏢 總部"}</div>
      </div>

      {/* 說明 */}
      <div style={{ background: "#e8eaf6", borderRadius: 8, padding: "9px 12px", marginBottom: 8, fontSize: 12, color: "#283593", lineHeight: 1.6 }}>
        📌 請點選下個月<strong>無法配合出勤</strong>的日期，幫助主管安排排班。<br />
        每月 25 日截止，逾期無法修改。
      </div>

      {/* 鎖定警告 */}
      {isLocked && (
        <div style={{ background: "#fff3e0", border: "1px solid #fb8c00", borderRadius: 8, padding: "10px 12px", marginBottom: 8, fontSize: 12, color: "#e65100" }}>
          🔒 本月 25 日後已截止，下個月 1 日起可重新回報。
        </div>
      )}

      {/* 主管快捷入口 */}
      {IS_MANAGER && (
        <a href={`/availability-overview?eid=${eid}`}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: "1px solid #c5cae9", borderRadius: 8, padding: "10px 12px", marginBottom: 8, textDecoration: "none" }}>
          <span style={{ fontSize: 13, color: "#3f51b5", fontWeight: 600 }}>👥 查看所有員工可用時段總覽</span>
          <span style={{ color: "#9e9e9e" }}>▶</span>
        </a>
      )}

      {/* 時段模式選擇 */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: "10px", marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>點日期時套用的時段</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["", "❌ 整天"], ["am", "🌅 上午"], ["pm", "🌆 下午"]].map(([v, l]) => (
            <button key={v} onClick={() => setMode(v)}
              style={{ flex: 1, padding: "8px 0", borderRadius: 6, border: mode === v ? `2px solid ${HALF_COLORS[v]}` : "1px solid #ddd", background: mode === v ? "#f3f4fb" : "#fff", cursor: "pointer", fontSize: 12, fontWeight: mode === v ? 700 : 400, color: mode === v ? HALF_COLORS[v] : "#555" }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* 月份導航 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
        <button onClick={prevMonth} style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 13 }}>◀</button>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{y} 年 {m} 月</span>
        <button onClick={nextMonth} style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 13 }}>▶</button>
      </div>

      {/* 月曆 */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", overflow: "hidden", marginBottom: 8, opacity: isLocked ? 0.55 : 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", background: "#faf8f5" }}>
          {DAYS.map(d => (
            <div key={d} style={{ padding: "5px 0", textAlign: "center", fontSize: 11, fontWeight: 600, color: d === "日" ? "#b91c1c" : d === "六" ? "#b45309" : "#666" }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={"e" + i} style={{ minHeight: 52, borderTop: "1px solid #f0eeea" }} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const dow = new Date(dateStr).getDay();
            const isPast = dateStr <= today;
            const isToday = dateStr === today;
            const hd = selections.get(dateStr); // undefined = not selected
            const isSel = selections.has(dateStr);
            const canClick = !isLocked && !isPast;

            const cellColor = isSel ? HALF_COLORS[hd] : null;

            return (
              <div key={dateStr} onClick={() => canClick && toggleDate(dateStr)}
                style={{
                  minHeight: 52, borderTop: "1px solid #f0eeea", padding: 3, boxSizing: "border-box",
                  background: isSel ? "#fde8e8" : isToday ? "#e8eaf6" : "transparent",
                  border: isSel ? `2px solid ${cellColor}` : isToday ? "2px solid #3f51b5" : "none",
                  cursor: canClick ? "pointer" : "default",
                }}>
                <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isPast ? "#ccc" : dow === 0 ? "#b91c1c" : dow === 6 ? "#b45309" : "#444", marginBottom: 2 }}>{d}</div>
                {isSel && (
                  <div style={{ fontSize: 9, color: cellColor, fontWeight: 700, lineHeight: 1.3 }}>
                    ✕ {HALF_LABELS[hd] || "整天"}
                  </div>
                )}
                {!isSel && !isPast && (
                  <div style={{ fontSize: 7, color: "#ddd", textAlign: "center" }}>○</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 已標記摘要 */}
      {selections.size > 0 && (
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: "10px 12px", marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#b91c1c", marginBottom: 6 }}>❌ 已標記不可出勤（{selections.size} 天）</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {[...selections.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, hd]) => (
              <span key={date} style={{ fontSize: 11, background: "#fde8e8", color: "#b91c1c", borderRadius: 4, padding: "2px 6px" }}>
                {date.slice(5)}{hd ? `(${HALF_LABELS[hd]})` : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 備註 */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: "10px", marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>備註（選填）</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="例：學校課程、固定有事..." rows={2}
          style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #ddd", fontSize: 13, resize: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
      </div>

      {/* 送出 */}
      {!isLocked && (
        <div style={{ position: "sticky", bottom: 0, background: "#f7f5f0", paddingBottom: 12 }}>
          <button onClick={submit} disabled={submitting}
            style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: submitting ? "#ccc" : "#3f51b5", color: "#fff", fontSize: 15, fontWeight: 700, cursor: submitting ? "default" : "pointer" }}>
            {submitting ? "送出中..." : selections.size === 0 ? "📤 送出（清除本月回報）" : `📤 送出回報（不可出勤 ${selections.size} 天）`}
          </button>
          <div style={{ fontSize: 10, color: "#aaa", textAlign: "center", marginTop: 4 }}>送出後主管會收到 LINE 通知</div>
        </div>
      )}

      <div style={{ textAlign: "center", paddingTop: 4, paddingBottom: 16 }}>
        <a href={`/me?eid=${eid}`} style={{ fontSize: 12, color: "#3f51b5" }}>← 回面板</a>
      </div>
    </div>
  );
}
