"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { ap, fmt, wlCategory } from "./utils";

const WorklogSettings = dynamic(() => import("./SettingsMgr").then(m => ({ default: m.WorklogSettings })), { ssr: false, loading: () => <div style={{ textAlign: "center", padding: 20, color: "#ccc" }}>載入設定中...</div> });

export default function WorklogMgr({ stores, sf, month, auth }) {
  const [view, setView] = useState("completion");
  const [completionData, setCompletionData] = useState([]);
  const [inventoryData, setInventoryData] = useState([]);
  const [invDate, setInvDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [loading, setLoading] = useState(false);
  const [detailStore, setDetailStore] = useState(null);
  const [detailDate, setDetailDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [detailFreq, setDetailFreq] = useState("daily"); // daily | weekly | monthly
  const [detailItems, setDetailItems] = useState([]);
  const [detailSummary, setDetailSummary] = useState({});
  const [cleaningContribStore, setCleaningContribStore] = useState(null);
  const [cleaningContribMonth, setCleaningContribMonth] = useState(new Date().toLocaleDateString("sv-SE").slice(0, 7));
  const [cleaningContrib, setCleaningContrib] = useState([]);
  const [wasteQueue, setWasteQueue] = useState([]);
  const [wasteStatus, setWasteStatus] = useState("pending");
  const [wasteStats, setWasteStats] = useState(null);
  const [wasteAuditNote, setWasteAuditNote] = useState({});
  const [wasteSubview, setWasteSubview] = useState("audit"); // audit / collection / trends
  const [collectionData, setCollectionData] = useState([]);
  const [collectionTotals, setCollectionTotals] = useState({ totalItems: 0, totalCost: 0 });
  const [collectionPicked, setCollectionPicked] = useState({}); // {movement_id: true}
  const [trendData, setTrendData] = useState({ itemAlerts: [], empAlerts: [] });

  const LOC_LABEL = { refrig: "🧊 冷藏", freezer: "❄️ 冷凍", ambient: "🌡 常溫", display: "🪟 展示櫃" };

  const loadWaste = () => {
    setLoading(true);
    if (wasteSubview === "collection") {
      ap("/api/admin/waste?type=collection_queue" + (sf ? "&store_id=" + sf : ""))
        .then(r => {
          setCollectionData(r.data || []);
          setCollectionTotals({ totalItems: r.totalItems || 0, totalCost: r.totalCost || 0 });
          setLoading(false);
        });
      return;
    }
    if (wasteSubview === "trends") {
      ap("/api/admin/waste?type=trends&month=" + month)
        .then(r => { setTrendData(r.data || { itemAlerts: [], empAlerts: [] }); setLoading(false); });
      return;
    }
    Promise.all([
      ap("/api/admin/waste?type=queue&status=" + wasteStatus + (sf ? "&store_id=" + sf : "")),
      ap("/api/admin/waste?type=stats&month=" + month + (sf ? "&store_id=" + sf : "")),
    ]).then(([q, s]) => {
      setWasteQueue(q.data || []);
      setWasteStats(s.data || null);
      setLoading(false);
    });
  };

  const markCollected = async (movement_ids, status = "collected") => {
    if (!movement_ids || movement_ids.length === 0) return;
    const r = await fetch("/api/admin/waste", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_collected", movement_ids, collection_status: status, collected_by: auth?.id, collected_by_name: auth?.name }),
    }).then(r => r.json());
    if (r.error) { alert("❌ " + r.error); return; }
    alert("✅ 已標記 " + r.updated + " 筆為「" + (status === "collected" ? "已回收" : status === "disposed" ? "店家自行銷毀" : "待回收") + "」");
    setCollectionPicked({});
    loadWaste();
  };

  const exportCollectionCSV = () => {
    const rows = [["門市", "地址", "品項", "數量", "單位", "位置", "原因", "成本", "登記人", "核准日"]];
    for (const grp of collectionData) {
      for (const it of grp.items) {
        rows.push([
          grp.store_name, grp.address, it.item_name, it.quantity, it.unit,
          LOC_LABEL[it.patrol_location] || it.patrol_location || "",
          it.waste_reason || "", it.cost, it.submitted_by || "",
          it.audit_at ? new Date(it.audit_at).toLocaleDateString("zh-TW") : "",
        ]);
      }
    }
    const csv = "﻿" + rows.map(r => r.map(c => '"' + String(c || "").replace(/"/g, '""') + '"').join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "回收清單_" + new Date().toLocaleDateString("sv-SE") + ".csv";
    a.click();
  };

  const auditWaste = async (id, decision) => {
    const note = wasteAuditNote[id] || "";
    if (decision === "rejected" && !note) { alert("退回必須填寫原因"); return; }
    await fetch("/api/admin/waste", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      action: "audit", movement_id: id, decision, audit_note: note, audit_by: auth?.name || auth?.id,
    }) });
    setWasteAuditNote({ ...wasteAuditNote, [id]: "" });
    loadWaste();
  };

  const canEdit = auth?.role === "admin" || auth?.role === "manager" || auth?.role === "store_manager";
  const displayStores = sf ? stores.filter(s => s.id === sf) : stores;

  const loadCompletion = () => {
    setLoading(true);
    Promise.all(
      displayStores.map(s =>
        ap("/api/admin/worklogs?month=" + month + "&store_id=" + s.id)
          .then(r => ({ store_id: s.id, store_name: s.name, logs: r.data || [] }))
      )
    ).then(results => { setCompletionData(results); setLoading(false); });
  };

  const loadInventory = () => {
    setLoading(true);
    ap("/api/admin/worklogs?type=inventory&date=" + invDate + (sf ? "&store_id=" + sf : ""))
      .then(r => { setInventoryData(r.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const loadDetail = (storeId, date, freq) => {
    setDetailStore(storeId);
    setDetailDate(date || new Date().toLocaleDateString("sv-SE"));
    const f = freq || detailFreq;
    setLoading(true);
    ap("/api/admin/worklogs?type=collab&store_id=" + storeId + "&date=" + (date || detailDate) + "&frequency=" + f)
      .then(r => { setDetailItems(r.data || []); setDetailSummary(r.summary || {}); setLoading(false); });
  };

  const loadCleaningContrib = (storeId, m) => {
    const s = storeId || cleaningContribStore || sf;
    if (!s) { setCleaningContrib([]); return; }
    setLoading(true);
    ap("/api/admin/worklogs?type=monthly_contrib&store_id=" + s + "&month=" + (m || cleaningContribMonth))
      .then(r => { setCleaningContrib(r.data || []); setLoading(false); });
  };

  useEffect(() => {
    if (view === "completion") loadCompletion();
    else if (view === "inventory") loadInventory();
    else if (view === "waste") loadWaste();
    else if (view === "cleaning") loadCleaningContrib(cleaningContribStore || sf, cleaningContribMonth);
  }, [view, month, sf, invDate, wasteStatus, wasteSubview, cleaningContribStore, cleaningContribMonth]);

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
        {["completion", "detail", "cleaning", "inventory", "waste", ...((auth?.role === "admin" || auth?.role === "store_manager") ? ["settings"] : [])].map(v => {
          const labels = { completion: "📊 各店完成度", detail: "📋 每日明細", cleaning: "🧹 清潔貢獻", inventory: "📦 盤點回報", waste: "🗑 報廢稽核", settings: "⚙️ 日誌設定" };
          return (
            <button key={v} onClick={() => {
              setView(v);
              if (v === "detail" && sf) loadDetail(sf, detailDate);
              if (v === "cleaning" && sf) { setCleaningContribStore(sf); loadCleaningContrib(sf, cleaningContribMonth); }
            }} style={{
              padding: "4px 10px", borderRadius: 5, border: "1px solid var(--border)",
              background: view === v ? "var(--ink)" : "#fff",
              color: view === v ? "#fff" : "var(--text-2)", fontSize: 11, cursor: "pointer"
            }}>{labels[v]}</button>
          );
        })}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 20, color: "#ccc" }}>載入中...</div>}

      {/* 各店完成度 */}
      {!loading && view === "completion" && (
        <div>
          {completionData.length === 0 && (
            <div style={{ background: "#fff", borderRadius: 8, padding: 30, textAlign: "center", color: "#ccc" }}>無日誌紀錄</div>
          )}
          {completionData.map(store => {
            const todayStr = new Date().toLocaleDateString("sv-SE");
            const todayLog = store.logs.find(l => l.date === todayStr);
            const pct = todayLog ? todayLog.percent || 0 : 0;
            const done = todayLog ? todayLog.done || 0 : 0;
            const total = todayLog ? todayLog.total || 0 : 0;
            const people = todayLog ? (todayLog.people || []).join("、") : "";
            const completeDays = store.logs.filter(l => l.percent === 100).length;
            return (
              <div key={store.store_id} style={{ background: "#fff", borderRadius: 8, border: "1px solid var(--border)", padding: 12, marginBottom: 8, cursor: "pointer" }}
                onClick={() => { setView("detail"); loadDetail(store.store_id, todayStr); }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{"🏠 " + store.store_name}</div>
                  {pct === 100 ? <span style={{ background: "var(--success-bg)", color: "var(--success)", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>✅ 完成</span>
                    : total > 0 ? <span style={{ background: "var(--warning-bg)", color: "var(--warning)", padding: "2px 8px", borderRadius: 4, fontSize: 10 }}>{pct + "%"}</span>
                    : <span style={{ color: "#ccc", fontSize: 10 }}>尚未開始</span>}
                </div>
                {total > 0 && <div style={{ height: 6, background: "#f0f0f0", borderRadius: 3, marginBottom: 4 }}>
                  <div style={{ height: "100%", width: Math.min(100, pct) + "%", background: pct === 100 ? "var(--success)" : "#fbbf24", borderRadius: 3 }} />
                </div>}
                <div style={{ fontSize: 10, color: "var(--text-3)" }}>
                  {total > 0 && done + "/" + total + " 項"}{people && " · 👥 " + people}
                  {" · 本月 " + completeDays + "/" + store.logs.length + " 天全完成"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 每日明細（可編輯） */}
      {!loading && view === "detail" && (
        <div>
          <div style={{ display: "flex", gap: 4, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
            {!sf && <select value={detailStore || ""} onChange={e => { setDetailStore(e.target.value); loadDetail(e.target.value, detailDate); }}
              style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid var(--border)", fontSize: 11 }}>
              <option value="">選擇門市</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>}
            <input type="date" value={detailDate} onChange={e => { setDetailDate(e.target.value); if (detailStore) loadDetail(detailStore, e.target.value, detailFreq); }}
              style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid var(--border)", fontSize: 11 }} />
            <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", borderRadius: 5, overflow: "hidden" }}>
              {[["daily", "日"], ["weekly", "週"], ["monthly", "月"]].map(([k, l]) => (
                <button key={k} onClick={() => { setDetailFreq(k); if (detailStore) loadDetail(detailStore, detailDate, k); }}
                  style={{ padding: "4px 10px", border: "none", background: detailFreq === k ? "#155e75" : "#fff", color: detailFreq === k ? "#fff" : "var(--text-2)", fontSize: 11, cursor: "pointer", fontWeight: detailFreq === k ? 600 : 400 }}>{l}</button>
              ))}
            </div>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>
              {detailSummary.done || 0}/{detailSummary.total || 0} 項 ({detailSummary.percent || 0}%)
            </span>
          </div>
          {!detailStore ? (
            <div style={{ background: "#fff", borderRadius: 8, padding: 30, textAlign: "center", color: "#ccc" }}>請選擇門市</div>
          ) : detailItems.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 8, padding: 30, textAlign: "center", color: "#ccc" }}>當日無日誌項目</div>
          ) : (() => {
            const SHIFT_LABEL = {
              morning_start: { l: "早上", c: "#f59e0b", bg: "var(--warning-bg)" },
              morning_end:   { l: "早下", c: "#ea580c", bg: "#ffedd5" },
              evening_start: { l: "晚上", c: "#4f46e5", bg: "#e0e7ff" },
              evening_end:   { l: "晚下", c: "#7c3aed", bg: "#ede9fe" },
              opening:       { l: "開店", c: "var(--success)", bg: "var(--success-bg)" },
              during:        { l: "營業中", c: "var(--info)", bg: "var(--info-bg)" },
              closing:       { l: "閉店", c: "var(--danger)", bg: "var(--danger-bg)" },
            };
            const CAT_ORDER = ["🧹 清潔", "⚙️ 設備檢查", "🍰 備料", "💰 財務", "📋 行政交接", "🛒 庫存補貨", "其他"];
            const CAT_ICON = { "🧹 清潔": "🧹", "⚙️ 設備檢查": "⚙️", "🍰 備料": "🍰", "💰 財務": "💰", "📋 行政交接": "📋", "🛒 庫存補貨": "🛒", "其他": "📌" };
            const grouped = {};
            for (const it of detailItems) {
              const k = wlCategory(it.item_name || it.item, it.category);
              if (!grouped[k]) grouped[k] = [];
              grouped[k].push(it);
            }
            const orderedCats = [...CAT_ORDER.filter(c => grouped[c]), ...Object.keys(grouped).filter(c => !CAT_ORDER.includes(c))];

            return orderedCats.map(cat => {
              const items = grouped[cat];
              const done = items.filter(i => i.completed).length;
              return (
                <div key={cat} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--surface-warm)", borderRadius: "8px 8px 0 0", border: "1px solid var(--border)", borderBottom: "none" }}>
                    <span style={{ fontSize: 14 }}>{CAT_ICON[cat] || "📋"}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{cat}</span>
                    <span style={{ fontSize: 10, color: "var(--text-3)", marginLeft: "auto" }}>{done}/{items.length}</span>
                  </div>
                  <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "0 0 8px 8px", overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead><tr style={{ background: "#fcfbf9" }}>
                        <th style={{ padding: 5, width: 30 }}></th>
                        <th style={{ padding: 5, textAlign: "left", fontWeight: 500, color: "var(--text-2)" }}>項目</th>
                        <th style={{ padding: 5, textAlign: "left", fontWeight: 500, color: "var(--text-2)", width: 70 }}>時段</th>
                        <th style={{ padding: 5, textAlign: "left", fontWeight: 500, color: "var(--text-2)" }}>完成人</th>
                        <th style={{ padding: 5, textAlign: "left", fontWeight: 500, color: "var(--text-2)", width: 50 }}>時間</th>
                        {canEdit && <th style={{ padding: 5, textAlign: "left", fontWeight: 500, color: "var(--text-2)", width: 40 }}>操作</th>}
                      </tr></thead>
                      <tbody>{items.map(item => {
                        const sh = SHIFT_LABEL[item.shift_type] || { l: item.shift_type || "-", c: "var(--text-3)", bg: "#f0f0f0" };
                        return (
                          <tr key={item.id} style={{ borderTop: "1px solid var(--divider)", background: item.is_abnormal ? "var(--warning-bg)" : "transparent" }}>
                            <td style={{ padding: 5, textAlign: "center" }}>
                              {canEdit ? (
                                <input type="checkbox" checked={!!item.completed} onChange={async () => {
                                  const isBackfill = !item.completed && detailDate < new Date().toLocaleDateString("sv-SE");
                                  if (isBackfill && !confirm("補勾歷史日期項目？備註會自動標記「補勾 by " + (auth?.name || "主管") + "」")) return;
                                  await ap("/api/admin/worklogs", {
                                    action: "toggle_item", item_id: item.id,
                                    completed: !item.completed,
                                    employee_id: auth?.id, employee_name: auth?.name,
                                    edited_by_admin: isBackfill,
                                    admin_name: auth?.name,
                                  });
                                  loadDetail(detailStore, detailDate, detailFreq);
                                }} style={{ width: 16, height: 16, cursor: "pointer" }} />
                              ) : (
                                <span>{item.completed ? "✅" : "⬜"}</span>
                              )}
                            </td>
                            <td style={{ padding: 5, fontWeight: 500, textDecoration: item.completed ? "line-through" : "none", color: item.completed ? "var(--text-hint)" : "var(--text)" }}>{item.item_name}</td>
                            <td style={{ padding: 5 }}>
                              <span style={{ background: sh.bg, color: sh.c, padding: "1px 6px", borderRadius: 10, fontSize: 9, fontWeight: 600 }}>{sh.l}</span>
                            </td>
                            <td style={{ padding: 5, fontSize: 10 }}>{item.completed_by_name || "-"}</td>
                            <td style={{ padding: 5, fontSize: 9, color: "var(--text-3)" }}>{item.completed_at ? new Date(item.completed_at).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                            {canEdit && (
                              <td style={{ padding: 5 }}>
                                <button onClick={async () => {
                                  const note = prompt("備註：", item.notes || "");
                                  if (note === null) return;
                                  await ap("/api/admin/worklogs", { action: "add_note", item_id: item.id, notes: note });
                                  loadDetail(detailStore, detailDate, detailFreq);
                                }} style={{ fontSize: 9, color: "var(--brand-strong)", background: "none", border: "none", cursor: "pointer" }}>
                                  {item.notes ? "📝" : "✏️"}
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}</tbody>
                    </table>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* 盤點回報 */}
      {!loading && view === "inventory" && (
        <div>
          <div style={{ display: "flex", gap: 4, marginBottom: 8, alignItems: "center" }}>
            <input type="date" value={invDate} onChange={e => setInvDate(e.target.value)}
              style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid var(--border)", fontSize: 11 }} />
            <button onClick={loadInventory}
              style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid var(--border)", background: "#fff", fontSize: 11, cursor: "pointer" }}>🔄</button>
          </div>
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid var(--border)", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead><tr style={{ background: "var(--surface-warm)" }}>
                {["日期", "門市", "分類", "品項", "數量", "填報人"].map(h =>
                  <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "var(--text-2)" }}>{h}</th>
                )}
              </tr></thead>
              <tbody>
                {inventoryData.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "#ccc" }}>無盤點紀錄</td></tr>
                ) : inventoryData.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid var(--divider)" }}>
                    <td style={{ padding: 6 }}>{item.date}</td>
                    <td style={{ padding: 6 }}>{item.store_name || ""}</td>
                    <td style={{ padding: 6 }}><span style={{ padding: "1px 5px", borderRadius: 3, fontSize: 9, background: "var(--info-bg)", color: "var(--info)" }}>{item.category}</span></td>
                    <td style={{ padding: 6, fontWeight: 500 }}>{item.item}</td>
                    <td style={{ padding: 6, fontWeight: 700, fontSize: 13 }}>{item.value}</td>
                    <td style={{ padding: 6, fontSize: 10 }}>{item.employee_name || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 清潔貢獻：本月每位員工的週/月清潔完成數排行 */}
      {!loading && view === "cleaning" && (
        <div>
          <div style={{ display: "flex", gap: 4, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
            {!sf && <select value={cleaningContribStore || ""} onChange={e => { setCleaningContribStore(e.target.value); loadCleaningContrib(e.target.value, cleaningContribMonth); }}
              style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid var(--border)", fontSize: 11 }}>
              <option value="">選擇門市</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>}
            <input type="month" value={cleaningContribMonth} onChange={e => { setCleaningContribMonth(e.target.value); loadCleaningContrib(cleaningContribStore || sf, e.target.value); }}
              style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid var(--border)", fontSize: 11 }} />
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>共 {cleaningContrib.reduce((s, c) => s + c.total, 0)} 筆完成</span>
          </div>
          {(!cleaningContribStore && !sf) ? (
            <div style={{ background: "#fff", borderRadius: 8, padding: 30, textAlign: "center", color: "#ccc" }}>請選擇門市</div>
          ) : cleaningContrib.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 8, padding: 30, textAlign: "center", color: "#ccc" }}>{cleaningContribMonth} 無紀錄</div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid var(--border)", overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ background: "var(--surface-warm)" }}>
                  <th style={{ padding: 8, width: 40, textAlign: "center", fontWeight: 500, color: "var(--text-2)" }}>名次</th>
                  <th style={{ padding: 8, textAlign: "left", fontWeight: 500, color: "var(--text-2)" }}>員工</th>
                  <th style={{ padding: 8, textAlign: "right", fontWeight: 500, color: "var(--text-2)", width: 70 }}>週清潔</th>
                  <th style={{ padding: 8, textAlign: "right", fontWeight: 500, color: "var(--text-2)", width: 70 }}>月清潔</th>
                  <th style={{ padding: 8, textAlign: "right", fontWeight: 500, color: "var(--text-2)", width: 70 }}>合計</th>
                  <th style={{ padding: 8, textAlign: "right", fontWeight: 500, color: "var(--text-2)", width: 80 }}>佔比</th>
                </tr></thead>
                <tbody>{(() => {
                  const total = cleaningContrib.reduce((s, c) => s + c.total, 0);
                  return cleaningContrib.map((c, i) => (
                    <tr key={c.name + i} style={{ borderTop: "1px solid var(--divider)" }}>
                      <td style={{ padding: 8, textAlign: "center", fontSize: 14 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                      <td style={{ padding: 8, fontWeight: 500 }}>{c.name}</td>
                      <td style={{ padding: 8, textAlign: "right", color: "var(--warning)" }}>{c.weekly}</td>
                      <td style={{ padding: 8, textAlign: "right", color: "var(--brand-strong)" }}>{c.monthly}</td>
                      <td style={{ padding: 8, textAlign: "right", fontWeight: 700, color: "#155e75" }}>{c.total}</td>
                      <td style={{ padding: 8, textAlign: "right", fontSize: 11, color: "var(--text-3)" }}>{total > 0 ? Math.round(c.total / total * 100) + "%" : "—"}</td>
                    </tr>
                  ));
                })()}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 報廢稽核 */}
      {!loading && view === "waste" && (
        <div>
          {/* 子分頁：稽核 / 待回收 / 趨勢 */}
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {[["audit","📋 稽核"],["collection","📦 待回收"],["trends","📊 趨勢警示"]].map(([k,l]) => (
              <button key={k} onClick={()=>setWasteSubview(k)} style={{ padding:"4px 10px", borderRadius:5, border:"1px solid var(--border)", background: wasteSubview===k?"var(--danger)":"#fff", color: wasteSubview===k?"#fff":"var(--text-2)", fontSize:11, cursor:"pointer", fontWeight:600 }}>{l}</button>
            ))}
          </div>

          {/* === 子分頁：待回收 === */}
          {wasteSubview === "collection" && (
            <div>
              <div style={{ background:"var(--warning-bg)", border:"1px solid #f0e6c8", borderRadius:8, padding:"8px 12px", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"var(--warning)" }}>
                  📦 待回收清單共 {collectionTotals.totalItems} 筆，估計成本 ${collectionTotals.totalCost.toLocaleString()}
                </div>
                <button onClick={exportCollectionCSV} disabled={collectionData.length===0} style={{ padding:"4px 12px", borderRadius:5, border:"1px solid var(--warning)", background:"#fff", color:"var(--warning)", fontSize:11, cursor:"pointer", fontWeight:600 }}>📥 匯出 CSV</button>
              </div>
              {collectionData.length === 0 && <div style={{ background:"#fff", borderRadius:8, padding:30, textAlign:"center", color:"var(--text-hint)" }}>沒有待回收項目（所有核准的報廢都已處理）</div>}
              {collectionData.map(grp => {
                const allIds = grp.items.map(i=>i.id);
                const allChecked = allIds.every(id => collectionPicked[id]);
                return (
                <div key={grp.store_name} style={{ background:"#fff", borderRadius:8, border:"1px solid var(--border)", marginBottom:10, overflow:"hidden" }}>
                  <div style={{ background:"var(--surface-warm)", padding:"8px 12px", display:"flex", alignItems:"center", gap:8 }}>
                    <input type="checkbox" checked={allChecked} onChange={e=>{
                      const next = { ...collectionPicked };
                      for (const id of allIds) next[id] = e.target.checked;
                      setCollectionPicked(next);
                    }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>🏠 {grp.store_name} <span style={{ fontSize:10, color:"var(--text-3)", fontWeight:400, marginLeft:4 }}>{grp.items.length} 筆</span></div>
                      {grp.address && <div style={{ fontSize:10, color:"var(--text-2)" }}>📍 {grp.address}</div>}
                    </div>
                    <button onClick={()=>markCollected(allIds, "collected")} style={{ padding:"3px 10px", borderRadius:4, border:"none", background:"var(--success)", color:"#fff", fontSize:11, fontWeight:600, cursor:"pointer" }}>✅ 整店已收</button>
                  </div>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                    <tbody>{grp.items.map(it => (
                      <tr key={it.id} style={{ borderTop:"1px solid var(--divider)" }}>
                        <td style={{ padding:"6px 12px", width:30 }}>
                          <input type="checkbox" checked={!!collectionPicked[it.id]} onChange={e=>setCollectionPicked({ ...collectionPicked, [it.id]: e.target.checked })} />
                        </td>
                        <td style={{ padding:6 }}>
                          {it.photo && <a href={it.photo} target="_blank" rel="noreferrer"><img src={it.photo} alt="" style={{ width:44, height:44, objectFit:"cover", borderRadius:4, verticalAlign:"middle" }} /></a>}
                        </td>
                        <td style={{ padding:6 }}>
                          <div style={{ fontWeight:500 }}>{(LOC_LABEL[it.patrol_location] || "")} {it.item_name}</div>
                          <div style={{ fontSize:9, color:"var(--text-3)" }}>{it.waste_reason} · {it.submitted_by || "—"}</div>
                        </td>
                        <td style={{ padding:6, textAlign:"right", fontWeight:600 }}>{it.quantity}{it.unit}</td>
                        <td style={{ padding:6, textAlign:"right", color:"var(--danger)" }}>${it.cost.toLocaleString()}</td>
                        <td style={{ padding:6, whiteSpace:"nowrap" }}>
                          <button onClick={()=>markCollected([it.id], "collected")} style={{ padding:"2px 6px", borderRadius:3, border:"1px solid var(--success)", background:"#fff", color:"var(--success)", fontSize:9, cursor:"pointer" }}>已收</button>
                          <button onClick={()=>markCollected([it.id], "disposed")} style={{ marginLeft:3, padding:"2px 6px", borderRadius:3, border:"1px solid var(--warning)", background:"#fff", color:"var(--warning)", fontSize:9, cursor:"pointer" }}>店家自處</button>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>);
              })}
              {Object.values(collectionPicked).some(v=>v) && (
                <div style={{ position:"sticky", bottom:0, background:"#fff", padding:10, borderTop:"2px solid var(--success)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:12, fontWeight:600 }}>已勾選 {Object.values(collectionPicked).filter(v=>v).length} 筆</span>
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={()=>markCollected(Object.keys(collectionPicked).filter(k=>collectionPicked[k]), "collected")} style={{ padding:"6px 14px", borderRadius:5, border:"none", background:"var(--success)", color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer" }}>✅ 標記為已回收</button>
                    <button onClick={()=>setCollectionPicked({})} style={{ padding:"6px 14px", borderRadius:5, border:"1px solid var(--border)", background:"#fff", fontSize:12, cursor:"pointer" }}>取消</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === 子分頁：趨勢警示 === */}
          {wasteSubview === "trends" && (
            <div>
              <div style={{ fontSize:11, color:"var(--text-2)", marginBottom:10 }}>📅 {month}　偵測本月異常：同品項同店 ≥ 3 次、單一員工總成本 ≥ $5,000</div>

              <div style={{ background:"#fff", borderRadius:8, border:"1px solid #eee", padding:10, marginBottom:10 }}>
                <h4 style={{ fontSize:12, fontWeight:600, marginBottom:6 }}>🔁 高頻品項報廢（同店 ≥ 3 次）</h4>
                {trendData.itemAlerts.length === 0 && <div style={{ fontSize:11, color:"var(--text-hint)", padding:10, textAlign:"center" }}>本月無異常</div>}
                {trendData.itemAlerts.map((a,i)=>(
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom: i<trendData.itemAlerts.length-1?"1px solid var(--divider)":"none", fontSize:11 }}>
                    <span>{a.store_name} · {a.item_name}</span>
                    <span><b style={{ color:"var(--danger)" }}>{a.count} 次</b> · ${Math.round(a.total_cost).toLocaleString()}</span>
                  </div>
                ))}
                {trendData.itemAlerts.length > 0 && <div style={{ fontSize:10, color:"var(--text-2)", marginTop:6, padding:6, background:"#fffbeb", borderRadius:4 }}>💡 建議檢討訂貨量或品質供應商</div>}
              </div>

              <div style={{ background:"#fff", borderRadius:8, border:"1px solid #eee", padding:10 }}>
                <h4 style={{ fontSize:12, fontWeight:600, marginBottom:6 }}>👤 個人報廢成本警示（≥ $5,000）</h4>
                {trendData.empAlerts.length === 0 && <div style={{ fontSize:11, color:"var(--text-hint)", padding:10, textAlign:"center" }}>本月無異常</div>}
                {trendData.empAlerts.map((a,i)=>(
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom: i<trendData.empAlerts.length-1?"1px solid var(--divider)":"none", fontSize:11 }}>
                    <span>{a.name}</span>
                    <span>{a.count} 筆 · <b style={{ color:"var(--danger)" }}>${Math.round(a.total_cost).toLocaleString()}</b></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* === 子分頁：稽核（原邏輯） === */}
          {wasteSubview === "audit" && <>
          {/* 統計卡 */}
          {wasteStats && <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
            <div style={{ background: "#fff", borderRadius: 8, padding: 10, border: "1px solid #eee" }}>
              <div style={{ fontSize: 10, color: "var(--text-3)" }}>本月報廢成本</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--danger)" }}>{fmt ? fmt(Math.round(wasteStats.totalCost)) : "$" + Math.round(wasteStats.totalCost).toLocaleString()}</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 8, padding: 10, border: "1px solid #eee" }}>
              <div style={{ fontSize: 10, color: "var(--text-3)" }}>筆數</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{wasteStats.count}</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 8, padding: 10, border: "1px solid #eee" }}>
              <div style={{ fontSize: 10, color: "var(--text-3)" }}>主要位置</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{Object.entries(wasteStats.byLoc || {}).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,v])=>(LOC_LABEL[k]||k)+" "+Math.round(v)).join(" / ") || "—"}</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 8, padding: 10, border: "1px solid #eee" }}>
              <div style={{ fontSize: 10, color: "var(--text-3)" }}>主要原因</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{Object.entries(wasteStats.byReason || {}).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,v])=>k+" "+Math.round(v)).join(" / ") || "—"}</div>
            </div>
          </div>}

          {/* 狀態切換 */}
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {[["pending","🟡 待稽核"],["approved","✅ 已核准"],["rejected","❌ 已退回"],["observe","👁 觀察中"]].map(([k,l])=>(
              <button key={k} onClick={()=>setWasteStatus(k)} style={{ padding:"4px 10px", borderRadius:5, border:"1px solid var(--border)", background: wasteStatus===k?"var(--ink)":"#fff", color: wasteStatus===k?"#fff":"var(--text-2)", fontSize:11, cursor:"pointer" }}>{l}</button>
            ))}
          </div>

          {/* 佇列 */}
          {wasteQueue.length === 0 && <div style={{ background:"#fff", borderRadius:8, padding:30, textAlign:"center", color:"#ccc" }}>無紀錄</div>}
          {wasteQueue.map(w => (
            <div key={w.id} style={{ background:"#fff", borderRadius:8, padding:10, marginBottom:6, border:"1px solid #eee", display:"flex", gap:10 }}>
              {w.waste_photo_url && <a href={w.waste_photo_url} target="_blank" rel="noreferrer"><img src={w.waste_photo_url} alt="" style={{ width:80, height:80, objectFit:"cover", borderRadius:6 }} /></a>}
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:600 }}>
                  {w.type === "no_waste" ? "✅ 本日無報廢" : (LOC_LABEL[w.patrol_location] || w.patrol_location || "?") + " · " + (w.inventory_items?.name || "?") + " " + Math.abs(w.quantity) + (w.inventory_items?.unit || "")}
                </div>
                <div style={{ fontSize:11, color:"var(--text-2)", marginTop:2 }}>
                  {(w.stores?.name || "") + " · " + (w.submitted_by_name || "—") + " · " + new Date(w.created_at).toLocaleString("zh-TW",{ timeZone:"Asia/Taipei" })}
                </div>
                {w.type === "waste" && <div style={{ fontSize:11, color:"var(--danger)", marginTop:2 }}>原因: {w.waste_reason || "—"}{w.note ? " · "+w.note : ""}</div>}
                {w.audit_note && <div style={{ fontSize:10, color:"var(--text-3)", marginTop:2 }}>稽核備註: {w.audit_note} ({w.audit_by})</div>}
                {canEdit && wasteStatus === "pending" && w.type === "waste" && (
                  <div style={{ marginTop:6, display:"flex", gap:4, flexWrap:"wrap" }}>
                    <input type="text" placeholder="備註（退回必填）" value={wasteAuditNote[w.id]||""} onChange={e=>setWasteAuditNote({...wasteAuditNote,[w.id]:e.target.value})} style={{ flex:1, minWidth:120, padding:"4px 6px", borderRadius:4, border:"1px solid var(--border)", fontSize:11 }} />
                    <button onClick={()=>auditWaste(w.id,"approved")} style={{ padding:"4px 10px", borderRadius:4, border:"none", background:"var(--success)", color:"#fff", fontSize:11, cursor:"pointer" }}>核准</button>
                    <button onClick={()=>auditWaste(w.id,"observe")} style={{ padding:"4px 10px", borderRadius:4, border:"none", background:"var(--warning)", color:"#fff", fontSize:11, cursor:"pointer" }}>觀察</button>
                    <button onClick={()=>auditWaste(w.id,"rejected")} style={{ padding:"4px 10px", borderRadius:4, border:"none", background:"var(--danger)", color:"#fff", fontSize:11, cursor:"pointer" }}>退回</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          </>}
        </div>
      )}

      {/* 日誌設定（admin / manager / store_manager 皆可編輯） */}
      {view === "settings" && (auth?.role === "admin" || auth?.role === "manager" || auth?.role === "store_manager") && <WorklogSettings stores={stores} />}

    </div>
  );
}
