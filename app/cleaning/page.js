"use client";
import { useState, useEffect, useCallback } from "react";

const DAYS = ["日", "一", "二", "三", "四", "五", "六"];

// 取得某參考日所屬週/月的起訖
function periodRange(refDate, freq) {
  const d = new Date(refDate);
  if (freq === "weekly") {
    const dow = d.getDay();
    const s = new Date(d.getTime() - dow * 86400000);
    const e = new Date(d.getTime() + (6 - dow) * 86400000);
    return [s.toLocaleDateString("sv-SE"), e.toLocaleDateString("sv-SE")];
  }
  const y = d.getFullYear(), m = d.getMonth();
  const s = new Date(y, m, 1);
  const e = new Date(y, m + 1, 0);
  return [s.toLocaleDateString("sv-SE"), e.toLocaleDateString("sv-SE")];
}
function shiftPeriod(refDate, freq, delta) {
  const d = new Date(refDate);
  if (freq === "weekly") d.setDate(d.getDate() + delta * 7);
  else d.setMonth(d.getMonth() + delta);
  return d.toLocaleDateString("sv-SE");
}
function periodLabel(refDate, freq, today) {
  const [s] = periodRange(refDate, freq);
  const [ts] = periodRange(today, freq);
  const diff = Math.round((new Date(s).getTime() - new Date(ts).getTime()) / 86400000 / (freq === "weekly" ? 7 : 30));
  if (freq === "weekly") {
    if (diff === 0) return "本週";
    if (diff === -1) return "上週";
    if (diff === 1) return "下週";
    return s.slice(5).replace("-", "/") + " 那週";
  } else {
    if (diff === 0) return "本月";
    if (diff < 0 && diff >= -1) return "上月";
    if (diff > 0 && diff <= 1) return "下月";
    return s.slice(0, 7);
  }
}

export default function CleaningPage() {
  const [empId, setEmpId] = useState(null);
  const [storeId, setStoreId] = useState(null);
  const [empName, setEmpName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [freq, setFreq] = useState("weekly"); // weekly | monthly
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const [refDate, setRefDate] = useState(today);
  const [items, setItems] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [contrib, setContrib] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});

  // URL 參數解析
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setEmpId(p.get("eid"));
    setStoreId(p.get("sid"));
    setEmpName(p.get("name") || "");
    if (p.get("sid")) {
      fetch("/api/admin/stores").then(r => r.json()).then(r => {
        const st = (r.data || []).find(s => s.id === p.get("sid"));
        if (st) setStoreName(st.name || "");
      }).catch(() => {});
    }
  }, []);

  const loadItems = useCallback(() => {
    if (!storeId) return;
    fetch(`/api/admin/worklogs?type=cleaning_status&store_id=${storeId}&date=${refDate}&frequency=${freq}`)
      .then(r => r.json()).then(r => setItems(r.data || []));
  }, [storeId, refDate, freq]);

  const loadTimeline = useCallback(() => {
    if (!storeId) return;
    fetch(`/api/admin/worklogs?type=recent_cleanings&store_id=${storeId}&days=30`)
      .then(r => r.json()).then(r => setTimeline(r.data || []));
  }, [storeId]);

  const loadContrib = useCallback(() => {
    if (!storeId) return;
    const month = today.slice(0, 7);
    fetch(`/api/admin/worklogs?type=monthly_contrib&store_id=${storeId}&month=${month}`)
      .then(r => r.json()).then(r => setContrib(r.data || []));
  }, [storeId, today]);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    Promise.all([loadItems(), loadTimeline(), loadContrib()]).finally(() => setLoading(false));
  }, [storeId, loadItems, loadTimeline, loadContrib]);

  useEffect(() => { loadItems(); }, [refDate, freq, loadItems]);

  // 期間屬性
  const [pStart, pEnd] = periodRange(refDate, freq);
  const [tStart] = periodRange(today, freq);
  const isCurrent = pStart === tStart;
  const isPast = pStart < tStart;
  const isFuture = pStart > tStart;
  const canToggle = isCurrent; // 只有本期可以勾

  const toggle = async (it) => {
    if (!canToggle) return;
    if (it.completed_this_period) {
      if (!confirm("已由「" + (it.last_done_by || "他人") + "」完成，確定要取消？")) return;
    }
    setBusy(prev => ({ ...prev, [it.template_id]: true }));
    try {
      await fetch("/api/admin/worklogs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_cleaning",
          item_id: it.template_id, item_name: it.item_name,
          store_id: storeId, employee_id: empId, employee_name: empName,
          completed: !it.completed_this_period,
          frequency: freq, date: today,
        }),
      });
      await Promise.all([loadItems(), loadTimeline(), loadContrib()]);
    } finally {
      setBusy(prev => ({ ...prev, [it.template_id]: false }));
    }
  };

  const myDoneThisMonth = contrib.find(c => c.name === empName)?.total || 0;
  const totalContrib = contrib.reduce((s, c) => s + c.total, 0);
  const myPct = totalContrib > 0 ? Math.round(myDoneThisMonth / totalContrib * 100) : 0;

  const wrap = { maxWidth: 480, margin: "0 auto", padding: 12, fontFamily: "system-ui, 'Noto Sans TC', sans-serif", background: "#f7f5f0", minHeight: "100vh", boxSizing: "border-box" };
  const card = { background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", padding: 12, marginBottom: 10 };

  if (!storeId) return <div style={wrap}><p style={{ textAlign: "center", color: "#888", padding: 60 }}>缺少參數</p></div>;
  if (loading) return <div style={wrap}><p style={{ textAlign: "center", color: "#888", padding: 60 }}>載入中...</p></div>;

  const todoItems = items.filter(i => !i.completed_this_period);
  const doneItems = items.filter(i => i.completed_this_period);
  const periodTxt = periodLabel(refDate, freq, today);
  const rangeTxt = freq === "weekly"
    ? pStart.slice(5).replace("-", "/") + "~" + pEnd.slice(5).replace("-", "/")
    : pStart.slice(0, 7);

  return (
    <div style={wrap}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0e7490, #155e75)", borderRadius: 14, padding: "16px 16px", marginBottom: 12, color: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
        <div style={{ fontSize: 11, opacity: 0.85 }}>🧹 清潔紀錄</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{storeName || "本店"}</div>
        <div style={{ fontSize: 12, marginTop: 3, opacity: 0.9 }}>{empName}　·　查詢/勾選週月清潔</div>
      </div>

      {/* Freq tabs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
        {[
          { id: "weekly", l: "📋 週清潔" },
          { id: "monthly", l: "📆 月清潔" },
        ].map(t => (
          <button key={t.id} onClick={() => { setFreq(t.id); setRefDate(today); }}
            style={{ padding: "10px 4px", borderRadius: 10, border: freq === t.id ? "2px solid #155e75" : "1px solid #ddd", background: freq === t.id ? "#155e75" : "#fff", color: freq === t.id ? "#fff" : "#666", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Period nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: 6 }}>
        <button onClick={() => setRefDate(shiftPeriod(refDate, freq, -1))} style={{ flex: 1, padding: 8, borderRadius: 8, border: "none", background: "transparent", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>◀</button>
        <button onClick={() => setRefDate(today)} style={{ flex: 2, padding: 8, borderRadius: 8, border: isCurrent ? "2px solid #155e75" : "1px solid #ddd", background: isCurrent ? "#e0f7fa" : "#fff", fontSize: 12, fontWeight: 700, color: "#155e75", cursor: "pointer" }}>
          {periodTxt}<div style={{ fontSize: 9, color: "#888", fontWeight: 400 }}>{rangeTxt}</div>
        </button>
        <button onClick={() => setRefDate(shiftPeriod(refDate, freq, 1))} style={{ flex: 1, padding: 8, borderRadius: 8, border: "none", background: "transparent", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>▶</button>
      </div>

      {/* Status banner for past/future */}
      {!isCurrent && (
        <div style={{ background: isFuture ? "#fef9c3" : "#f3f4f6", border: "1px solid " + (isFuture ? "#fde68a" : "#ddd"), borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: isFuture ? "#854d0e" : "#666", textAlign: "center" }}>
          {isFuture ? "📅 預覽下" + (freq === "weekly" ? "週" : "月") + "排程（尚不可勾）" : "🕒 歷史紀錄（唯讀）— 如需補勾請通知主管"}
        </div>
      )}

      {/* 進度 */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#444" }}>{periodTxt}進度</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: doneItems.length === items.length && items.length > 0 ? "#0a7c42" : "#155e75" }}>
            {doneItems.length}/{items.length}
          </span>
        </div>
        <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: items.length > 0 ? Math.round(doneItems.length / items.length * 100) + "%" : "0%", background: doneItems.length === items.length && items.length > 0 ? "#0a7c42" : "#0e7490", borderRadius: 4, transition: "width 0.3s" }} />
        </div>
      </div>

      {/* 待辦清單 */}
      {todoItems.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#b45309", marginBottom: 6, padding: "0 4px" }}>
            ⚠ 待完成（{todoItems.length}）
          </div>
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #fbd9a5" }}>
            {todoItems.map(it => (
              <CleanRow key={it.id} it={it} freq={freq} canToggle={canToggle} busy={busy[it.template_id]} onToggle={() => toggle(it)} />
            ))}
          </div>
        </div>
      )}

      {/* 已完成清單 */}
      {doneItems.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0a7c42", marginBottom: 6, padding: "0 4px" }}>
            ✅ 已完成（{doneItems.length}）
          </div>
          <div style={{ background: "#e6f9f0", borderRadius: 10, border: "1px solid #b6e8c9" }}>
            {doneItems.map(it => (
              <CleanRow key={it.id} it={it} freq={freq} canToggle={false} done busy={busy[it.template_id]} onToggle={() => toggle(it)} />
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div style={{ ...card, textAlign: "center", color: "#aaa", fontSize: 13, padding: 30 }}>
          此{freq === "weekly" ? "週" : "月"}無清潔項目
        </div>
      )}

      {/* 最近 30 天時間線 */}
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 8 }}>📋 最近清潔紀錄（30 天）</div>
        {timeline.length === 0 && <div style={{ fontSize: 12, color: "#aaa", textAlign: "center", padding: 12 }}>無紀錄</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
          {timeline.map(t => {
            const d = t.completed_at ? new Date(t.completed_at) : null;
            const dStr = d ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : t.date.slice(5);
            const isAmend = t.notes && t.notes.startsWith("[補勾");
            return (
              <div key={t.id} style={{ display: "flex", gap: 8, fontSize: 11, padding: "4px 0", borderBottom: "1px solid #f5f3ef" }}>
                <span style={{ minWidth: 78, color: "#888" }}>{dStr}</span>
                <span style={{ minWidth: 50, fontWeight: 600 }}>{t.completed_by_name || "-"}</span>
                <span style={{ flex: 1 }}>{t.item_name}</span>
                <span style={{ color: t.frequency === "weekly" ? "#b45309" : "#4361ee", fontSize: 10 }}>{t.frequency === "weekly" ? "週" : "月"}</span>
                {isAmend && <span style={{ color: "#8b5cf6", fontSize: 9 }}>補</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* 個人 & 同仁貢獻 */}
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 8 }}>🏆 本月清潔貢獻（{today.slice(0, 7)}）</div>
        {empName && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#fef9c3", borderRadius: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>🌟</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "#854d0e" }}>我（{empName}）</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#854d0e" }}>{myDoneThisMonth} 項　·　{myPct}%</div>
            </div>
          </div>
        )}
        {contrib.length === 0 && <div style={{ fontSize: 12, color: "#aaa", textAlign: "center", padding: 12 }}>本月尚無紀錄</div>}
        {contrib.map((c, i) => {
          const isMe = c.name === empName;
          return (
            <div key={c.name + i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 4px", borderBottom: "1px solid #f5f3ef" }}>
              <span style={{ fontSize: 14, width: 22, textAlign: "center" }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: isMe ? 700 : 500, color: isMe ? "#854d0e" : "#333" }}>{c.name}{isMe && " (我)"}</span>
              <span style={{ fontSize: 10, color: "#888" }}>週{c.weekly} · 月{c.monthly}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#155e75", minWidth: 36, textAlign: "right" }}>{c.total}</span>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: "center", fontSize: 10, color: "#aaa", marginTop: 8 }}>
        點完成清單可取消勾選 · 歷史紀錄如有錯誤請通知主管補勾
      </div>
    </div>
  );
}

function CleanRow({ it, freq, canToggle, done, busy, onToggle }) {
  const when = it.last_done_at ? new Date(it.last_done_at) : null;
  const whenStr = when ? `${when.getMonth() + 1}/${when.getDate()} ${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}` : null;
  const isAmend = it.last_notes && it.last_notes.startsWith("[補勾");
  // 排程提示
  let scheduleHint = "";
  if (freq === "weekly" && it.weekday != null) scheduleHint = "週" + DAYS[it.weekday];
  else if (freq === "monthly" && it.month_day != null) scheduleHint = it.month_day + "號";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: "1px solid " + (done ? "#d4ecd6" : "#f0e8d4"), cursor: canToggle && !busy ? "pointer" : "default", opacity: busy ? 0.5 : 1 }}
         onClick={() => canToggle && !busy && onToggle()}>
      <div style={{ width: 26, height: 26, borderRadius: 8, border: done ? "none" : "2px solid " + (canToggle ? "#fbbf24" : "#ddd"), background: done ? "#0a7c42" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {done && <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>✓</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: done ? "#0a7c42" : "#333", textDecoration: done ? "line-through" : "none", fontWeight: done ? 500 : 600 }}>
          {it.item_name}
          {scheduleHint && <span style={{ fontSize: 10, color: "#888", marginLeft: 6, fontWeight: 400 }}>({scheduleHint})</span>}
        </div>
        {done && (
          <div style={{ fontSize: 10, color: "#0a7c42", marginTop: 2 }}>
            ✅ 由 {it.last_done_by || "?"} 完成{whenStr ? " 於 " + whenStr : ""}
            {isAmend && <span style={{ color: "#8b5cf6", marginLeft: 4 }}>· 主管補勾</span>}
          </div>
        )}
      </div>
    </div>
  );
}
