"use client";
import { useState, useEffect } from "react";

const DAYS = ["日", "一", "二", "三", "四", "五", "六"];
const LEAVE_TYPES = [
  { k: "off",       l: "⬛ 例假",  c: "#666",    bg: "#f0f0f0" },
  { k: "annual",    l: "🏖 特休",  c: "#4361ee", bg: "#e6f1fb" },
  { k: "personal",  l: "📋 事假",  c: "#8a6d00", bg: "#fef9c3" },
  { k: "comp_time", l: "🔄 補休",  c: "#185fa5", bg: "#e6f1fb" },
  { k: "sick",      l: "🤒 病假",  c: "#b45309", bg: "#fff8e6" },
  { k: "rest",      l: "🔲 休息",  c: "#888",    bg: "#f5f5f5" },
];
const LT = Object.fromEntries(LEAVE_TYPES.map(t => [t.k, t]));

export default function PreLeavePage() {
  const [eid, setEid] = useState("");
  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [month, setMonth] = useState(() => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }).slice(0, 7));
  const [existing, setExisting] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [leaveType, setLeaveType] = useState("off");
  const [halfDay, setHalfDay] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [doneCount, setDoneCount] = useState(0);

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

  const loadExisting = (empId, mo) => {
    const [y, m] = mo.split("-").map(Number);
    const start = `${mo}-01`;
    const end = new Date(y, m, 0).toLocaleDateString("sv-SE");
    fetch(`/api/admin/leaves?employee_id=${empId}&request_type=pre_arranged`).then(r => r.json()).then(r => {
      setExisting((r.data || []).filter(l => l.start_date >= start && l.start_date <= end));
    });
  };

  useEffect(() => {
    if (eid) loadExisting(eid, month);
    setSelected(new Set());
  }, [eid, month]);

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const todayDay = Number(today.slice(8, 10));
  const todayMonthStr = today.slice(0, 7);
  const [todayY, todayM] = todayMonthStr.split("-").map(Number);
  const nextMonthStr = new Date(todayY, todayM, 1).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }).slice(0, 7);

  // 每月25日後鎖定下個月預排
  const isNextMonthLocked = todayDay > 25;
  const isViewingNextMonth = month === nextMonthStr;
  const isViewingBeyond = month > nextMonthStr;
  const isLocked = isViewingBeyond || (isViewingNextMonth && isNextMonthLocked);

  const prevMonth = () => {
    const d = new Date(y, m - 2, 1);
    const nm = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }).slice(0, 7);
    if (nm >= todayMonthStr) setMonth(nm);
  };
  const nextMonth = () => {
    const d = new Date(y, m, 1);
    const nm = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }).slice(0, 7);
    if (nm <= nextMonthStr) setMonth(nm);
  };

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay();

  const existingByDate = {};
  for (const l of existing) {
    existingByDate[l.start_date] = l;
  }

  const toggleDate = (dateStr) => {
    if (isLocked) return;
    if (dateStr <= today) return;
    if (existingByDate[dateStr]) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr); else next.add(dateStr);
      return next;
    });
  };

  const submit = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    const dates = [...selected].sort();
    const r = await fetch("/api/admin/leaves", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "batch_create",
        employee_id: eid,
        dates,
        leave_type: leaveType,
        half_day: halfDay || null,
        reason: notes || "預排假申請",
      }),
    }).then(r => r.json());
    setSubmitting(false);
    if (r.error) { alert("❌ " + r.error); return; }
    setDoneCount(dates.length);
    setDone(true);
  };

  const wrap = { maxWidth: 480, margin: "0 auto", padding: 8, fontFamily: "system-ui, 'Noto Sans TC', sans-serif", background: "#f7f5f0", minHeight: "100vh", boxSizing: "border-box" };

  if (loading) return <div style={wrap}><p style={{ textAlign: "center", color: "#888", padding: 60 }}>載入中...</p></div>;
  if (err) return <div style={wrap}><p style={{ textAlign: "center", color: "#b91c1c", padding: 60 }}>{err}</p></div>;

  if (done) return (
    <div style={wrap}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 32, textAlign: "center", marginTop: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>預排假已送出</div>
        <div style={{ fontSize: 13, color: "#888", marginTop: 6 }}>共 {doneCount} 天，等待主管審核</div>
        <button onClick={() => { setDone(false); setSelected(new Set()); loadExisting(eid, month); }}
          style={{ marginTop: 20, padding: "10px 24px", borderRadius: 8, border: "none", background: "#3f51b5", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", marginRight: 10 }}>
          繼續選擇
        </button>
        <a href={`/me?eid=${eid}`} style={{ display: "inline-block", marginTop: 20, padding: "10px 24px", borderRadius: 8, background: "#f0ede8", color: "#333", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          回面板
        </a>
      </div>
    </div>
  );

  const lt = LT[leaveType] || LEAVE_TYPES[0];

  return (
    <div style={wrap}>
      <div style={{ background: "linear-gradient(135deg, #3f51b5, #1a237e)", borderRadius: 14, padding: "14px 16px", marginBottom: 10, color: "#fff" }}>
        <div style={{ fontSize: 11, opacity: 0.85 }}>📆 預排假申請</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{emp?.name}</div>
        <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>{emp?.stores?.name || "🏢 總部"}</div>
      </div>

      {/* 假別選擇 */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: "10px 10px 8px", marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>假別</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {LEAVE_TYPES.map(t => (
            <button key={t.k} onClick={() => setLeaveType(t.k)}
              style={{ padding: "6px 10px", borderRadius: 6, border: leaveType === t.k ? `2px solid ${t.c}` : "1px solid #ddd", background: leaveType === t.k ? t.bg : "#fff", cursor: "pointer", fontSize: 12, fontWeight: leaveType === t.k ? 700 : 400, color: leaveType === t.k ? t.c : "#555" }}>
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {/* 時間選擇 */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: "10px 10px 8px", marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>時間</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["", "整天"], ["am", "上午"], ["pm", "下午"]].map(([v, l]) => (
            <button key={v} onClick={() => setHalfDay(v)}
              style={{ flex: 1, padding: "7px 0", borderRadius: 6, border: halfDay === v ? "2px solid #3f51b5" : "1px solid #ddd", background: halfDay === v ? "#e8eaf6" : "#fff", cursor: "pointer", fontSize: 12, fontWeight: halfDay === v ? 700 : 400, color: halfDay === v ? "#3f51b5" : "#555" }}>
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

      {/* 鎖定提示 */}
      {isLocked ? (
        <div style={{ background: "#fff3e0", border: "1px solid #fb8c00", borderRadius: 8, padding: "10px 12px", marginBottom: 8, fontSize: 12, color: "#e65100", display: "flex", alignItems: "flex-start", gap: 6 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>🔒</span>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>預排假申請已截止</div>
            <div style={{ lineHeight: 1.5 }}>每月 25 日後無法再申請下個月排休，請於下個月 1–25 日重新申請。</div>
          </div>
        </div>
      ) : isViewingNextMonth ? (
        <div style={{ background: "#e8f5e9", border: "1px solid #66bb6a", borderRadius: 8, padding: "10px 12px", marginBottom: 8, fontSize: 12, color: "#2e7d32", display: "flex", alignItems: "flex-start", gap: 6 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>📌</span>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>下個月預排開放中</div>
            <div style={{ lineHeight: 1.5 }}>申請截止：本月 25 日（{todayMonthStr}-25）。逾期後本月無法再修改。</div>
          </div>
        </div>
      ) : null}

      {/* 月曆 */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", overflow: "hidden", marginBottom: 8, opacity: isLocked ? 0.6 : 1 }}>
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
            const existRec = existingByDate[dateStr];
            const isSel = selected.has(dateStr);

            let cellBg = "transparent";
            let numColor = dow === 0 ? "#b91c1c" : dow === 6 ? "#b45309" : "#444";
            let tag = null;
            let border = "none";

            if (isToday) { border = "2px solid #3f51b5"; numColor = "#3f51b5"; }
            if (isPast) { numColor = "#ccc"; }
            if (existRec) {
              const status = existRec.status;
              const elt = LT[existRec.leave_type] || LT.off;
              cellBg = status === "approved" ? "#e8f5e9" : "#fff8e6";
              border = `2px solid ${status === "approved" ? "#0a7c42" : "#b45309"}`;
              tag = { label: status === "approved" ? "已排" : "待審", color: status === "approved" ? "#0a7c42" : "#b45309", lt: elt };
            } else if (isSel) {
              cellBg = lt.bg;
              border = `2px solid ${lt.c}`;
            }

            const canClick = !isLocked && !isPast && !existRec;

            return (
              <div key={dateStr} onClick={() => canClick && toggleDate(dateStr)}
                style={{ minHeight: 52, borderTop: "1px solid #f0eeea", padding: 3, background: cellBg, border, boxSizing: "border-box", cursor: canClick ? "pointer" : "default", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: numColor, marginBottom: 2 }}>{d}</div>
                {existRec && tag && (
                  <div style={{ fontSize: 8, color: tag.color, fontWeight: 600, lineHeight: 1.2 }}>
                    <div>{tag.lt.l}</div>
                    <div>{tag.label}</div>
                  </div>
                )}
                {isSel && !existRec && (
                  <div style={{ fontSize: 8, color: lt.c, fontWeight: 700 }}>✓ {lt.l.split(" ")[1]}</div>
                )}
                {!existRec && !isSel && isPast && (
                  <div style={{ fontSize: 7, color: "#ddd", textAlign: "center" }}>-</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 圖例 */}
      <div style={{ display: "flex", gap: 10, marginBottom: 8, padding: "0 2px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#888" }}>
          <div style={{ width: 10, height: 10, background: lt.bg, border: `1px solid ${lt.c}`, borderRadius: 2 }} />
          選取
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#888" }}>
          <div style={{ width: 10, height: 10, background: "#fff8e6", border: "1px solid #b45309", borderRadius: 2 }} />
          待審
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#888" }}>
          <div style={{ width: 10, height: 10, background: "#e8f5e9", border: "1px solid #0a7c42", borderRadius: 2 }} />
          已排
        </div>
      </div>

      {/* 備註 */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: "10px", marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>備註（選填）</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="例：家庭因素、個人事務..." rows={2}
          style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #ddd", fontSize: 13, resize: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
      </div>

      {/* 已選取提示 + 送出 */}
      <div style={{ position: "sticky", bottom: 0, background: "#f7f5f0", paddingBottom: 12 }}>
        {selected.size > 0 && (
          <div style={{ fontSize: 12, color: "#3f51b5", textAlign: "center", marginBottom: 6, fontWeight: 600 }}>
            已選 {selected.size} 天：{[...selected].sort().join("、")}
          </div>
        )}
        <button onClick={submit} disabled={submitting || selected.size === 0}
          style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: selected.size === 0 ? "#ccc" : "#3f51b5", color: "#fff", fontSize: 15, fontWeight: 700, cursor: selected.size === 0 ? "default" : "pointer" }}>
          {submitting ? "送出中..." : selected.size === 0 ? "請點選日期" : `📤 送出申請（${selected.size} 天）`}
        </button>
      </div>

      <div style={{ textAlign: "center", paddingTop: 4, paddingBottom: 8 }}>
        <a href={`/me?eid=${eid}`} style={{ fontSize: 12, color: "#3f51b5" }}>← 回面板</a>
      </div>
    </div>
  );
}
