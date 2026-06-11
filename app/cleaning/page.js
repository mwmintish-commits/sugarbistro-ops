"use client";
import { useState, useEffect, useCallback } from "react";
import { PageShell, PageHeader, LoadingSkeleton, ErrorState } from "../components/ui";
import { fetchJSON } from "@/lib/fetch-json";

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
      fetchJSON("/api/admin/stores", { swrKey: "stores", swrTtl: 300 }).then(r => {
        const st = (r.data || []).find(s => s.id === p.get("sid"));
        if (st) setStoreName(st.name || "");
      }).catch(() => {});
    }
  }, []);

  const loadItems = useCallback(() => {
    if (!storeId) return;
    fetchJSON(`/api/admin/worklogs?type=cleaning_status&store_id=${storeId}&date=${refDate}&frequency=${freq}`)
      .then(r => setItems(r.data || [])).catch(() => {});
  }, [storeId, refDate, freq]);

  const loadTimeline = useCallback(() => {
    if (!storeId) return;
    fetchJSON(`/api/admin/worklogs?type=recent_cleanings&store_id=${storeId}&days=30`)
      .then(r => setTimeline(r.data || [])).catch(() => {});
  }, [storeId]);

  const loadContrib = useCallback(() => {
    if (!storeId) return;
    const month = today.slice(0, 7);
    fetchJSON(`/api/admin/worklogs?type=monthly_contrib&store_id=${storeId}&month=${month}`)
      .then(r => setContrib(r.data || [])).catch(() => {});
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

  const card = { background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", padding: 12, marginBottom: 10 };

  if (!storeId) return <PageShell style={{ padding: 12 }}><ErrorState message="缺少參數" /></PageShell>;
  if (loading) return <PageShell style={{ padding: 12 }}><LoadingSkeleton kind="list" rows={5} /></PageShell>;

  const todoItems = items.filter(i => !i.completed_this_period);
  const doneItems = items.filter(i => i.completed_this_period);
  const periodTxt = periodLabel(refDate, freq, today);
  const rangeTxt = freq === "weekly"
    ? pStart.slice(5).replace("-", "/") + "~" + pEnd.slice(5).replace("-", "/")
    : pStart.slice(0, 7);

  return (
    <PageShell style={{ padding: 12 }}>
      <PageHeader emoji="🧹" title="清潔紀錄" subtitle={`${storeName || "本店"}　·　${empName}　·　查詢/勾選週月清潔`} />

      {/* Freq tabs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
        {[
          { id: "weekly", l: "📋 週清潔" },
          { id: "monthly", l: "📆 月清潔" },
        ].map(t => (
          <button key={t.id} onClick={() => { setFreq(t.id); setRefDate(today); }}
            style={{ minHeight: "var(--tap-min)", padding: "10px 4px", borderRadius: 10, border: freq === t.id ? "2px solid var(--brand-strong)" : "1px solid var(--border)", background: freq === t.id ? "var(--brand-strong)" : "var(--surface)", color: freq === t.id ? "#fff" : "var(--text-2)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Period nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, background: "var(--surface)", borderRadius: 10, border: "1px solid var(--border)", padding: 6 }}>
        <button onClick={() => setRefDate(shiftPeriod(refDate, freq, -1))} style={{ flex: 1, minHeight: "var(--tap-min)", borderRadius: 8, border: "none", background: "transparent", color: "var(--text-2)", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>◀</button>
        <button onClick={() => setRefDate(today)} style={{ flex: 2, minHeight: "var(--tap-min)", borderRadius: 8, border: isCurrent ? "2px solid var(--brand)" : "1px solid var(--border)", background: isCurrent ? "var(--sugar-50)" : "var(--surface)", fontSize: 12, fontWeight: 700, color: "var(--brand-strong)", cursor: "pointer" }}>
          {periodTxt}<div style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 400 }}>{rangeTxt}</div>
        </button>
        <button onClick={() => setRefDate(shiftPeriod(refDate, freq, 1))} style={{ flex: 1, minHeight: "var(--tap-min)", borderRadius: 8, border: "none", background: "transparent", color: "var(--text-2)", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>▶</button>
      </div>

      {/* Status banner for past/future */}
      {!isCurrent && (
        <div style={{ background: isFuture ? "var(--warning-bg)" : "var(--surface-warm)", border: "1px solid " + (isFuture ? "var(--sugar-300)" : "var(--border)"), borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: isFuture ? "var(--warning)" : "var(--text-2)", textAlign: "center" }}>
          {isFuture ? "📅 預覽下" + (freq === "weekly" ? "週" : "月") + "排程（尚不可勾）" : "🕒 歷史紀錄（唯讀）— 如需補勾請通知主管"}
        </div>
      )}

      {/* 進度 */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>{periodTxt}進度</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: doneItems.length === items.length && items.length > 0 ? "var(--success)" : "var(--brand-strong)" }}>
            {doneItems.length}/{items.length}
          </span>
        </div>
        <div style={{ height: 8, background: "var(--paper)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: items.length > 0 ? Math.round(doneItems.length / items.length * 100) + "%" : "0%", background: doneItems.length === items.length && items.length > 0 ? "var(--success)" : "var(--brand)", borderRadius: 4, transition: "width 0.3s" }} />
        </div>
      </div>

      {/* 待辦清單 */}
      {todoItems.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--warning)", marginBottom: 6, padding: "0 4px" }}>
            ⚠ 待完成（{todoItems.length}）
          </div>
          <div style={{ background: "var(--surface)", borderRadius: 10, border: "1px solid var(--sugar-300)" }}>
            {todoItems.map(it => (
              <CleanRow key={it.id} it={it} freq={freq} canToggle={canToggle} busy={busy[it.template_id]} onToggle={() => toggle(it)} />
            ))}
          </div>
        </div>
      )}

      {/* 已完成清單 */}
      {doneItems.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", marginBottom: 6, padding: "0 4px" }}>
            ✅ 已完成（{doneItems.length}）
          </div>
          <div style={{ background: "var(--success-bg)", borderRadius: 10, border: "1px solid var(--matcha-500)" }}>
            {doneItems.map(it => (
              <CleanRow key={it.id} it={it} freq={freq} canToggle={false} done busy={busy[it.template_id]} onToggle={() => toggle(it)} />
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div style={{ ...card, textAlign: "center", color: "var(--text-hint)", fontSize: 13, padding: 30 }}>
          此{freq === "weekly" ? "週" : "月"}無清潔項目
        </div>
      )}

      {/* 最近 30 天時間線 */}
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 8 }}>📋 最近清潔紀錄（30 天）</div>
        {timeline.length === 0 && <div style={{ fontSize: 12, color: "var(--text-hint)", textAlign: "center", padding: 12 }}>無紀錄</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
          {timeline.map(t => {
            const d = t.completed_at ? new Date(t.completed_at) : null;
            const dStr = d ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : t.date.slice(5);
            const isAmend = t.notes && t.notes.startsWith("[補勾");
            return (
              <div key={t.id} style={{ display: "flex", gap: 8, fontSize: 11, padding: "4px 0", borderBottom: "1px solid var(--divider)" }}>
                <span style={{ minWidth: 78, color: "var(--text-3)" }}>{dStr}</span>
                <span style={{ minWidth: 50, fontWeight: 600 }}>{t.completed_by_name || "-"}</span>
                <span style={{ flex: 1 }}>{t.item_name}</span>
                <span style={{ color: t.frequency === "weekly" ? "var(--warning)" : "var(--info)", fontSize: 10 }}>{t.frequency === "weekly" ? "週" : "月"}</span>
                {isAmend && <span style={{ color: "var(--earth-500)", fontSize: 9 }}>補</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* 個人 & 同仁貢獻 */}
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 8 }}>🏆 本月清潔貢獻（{today.slice(0, 7)}）</div>
        {empName && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--warning-bg)", borderRadius: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>🌟</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "var(--warning)" }}>我（{empName}）</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--warning)" }}>{myDoneThisMonth} 項　·　{myPct}%</div>
            </div>
          </div>
        )}
        {contrib.length === 0 && <div style={{ fontSize: 12, color: "var(--text-hint)", textAlign: "center", padding: 12 }}>本月尚無紀錄</div>}
        {contrib.map((c, i) => {
          const isMe = c.name === empName;
          return (
            <div key={c.name + i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 4px", borderBottom: "1px solid var(--divider)" }}>
              <span style={{ fontSize: 14, width: 22, textAlign: "center" }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: isMe ? 700 : 500, color: isMe ? "var(--warning)" : "var(--text)" }}>{c.name}{isMe && " (我)"}</span>
              <span style={{ fontSize: 10, color: "var(--text-3)" }}>週{c.weekly} · 月{c.monthly}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-strong)", minWidth: 36, textAlign: "right" }}>{c.total}</span>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: "center", fontSize: 10, color: "var(--text-hint)", marginTop: 8 }}>
        點完成清單可取消勾選 · 歷史紀錄如有錯誤請通知主管補勾
      </div>
    </PageShell>
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
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: "1px solid " + (done ? "var(--success-bg)" : "var(--divider)"), cursor: canToggle && !busy ? "pointer" : "default", opacity: busy ? 0.5 : 1 }}
         onClick={() => canToggle && !busy && onToggle()}>
      <div style={{ width: 26, height: 26, borderRadius: 8, border: done ? "none" : "2px solid " + (canToggle ? "var(--brand)" : "var(--border)"), background: done ? "var(--success)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {done && <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>✓</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: done ? "var(--success)" : "var(--text)", textDecoration: done ? "line-through" : "none", fontWeight: done ? 500 : 600 }}>
          {it.item_name}
          {scheduleHint && <span style={{ fontSize: 10, color: "var(--text-3)", marginLeft: 6, fontWeight: 400 }}>({scheduleHint})</span>}
        </div>
        {done && (
          <div style={{ fontSize: 10, color: "var(--success)", marginTop: 2 }}>
            ✅ 由 {it.last_done_by || "?"} 完成{whenStr ? " 於 " + whenStr : ""}
            {isAmend && <span style={{ color: "var(--earth-500)", marginLeft: 4 }}>· 主管補勾</span>}
          </div>
        )}
      </div>
    </div>
  );
}
