"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { ap, fmt } from "./utils";

const WorklogSettings = dynamic(() => import("./SettingsMgr").then(m => ({ default: m.WorklogSettings })), { ssr: false, loading: () => <div style={{ textAlign: "center", padding: 20, color: "#ccc" }}>載入設定中...</div> });

export default function WorklogMgr({ stores, sf, month, auth }) {
  const [view, setView] = useState("completion");
  const [completionData, setCompletionData] = useState([]);
  const [inventoryData, setInventoryData] = useState([]);
  const [invDate, setInvDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [loading, setLoading] = useState(false);
  const [detailStore, setDetailStore] = useState(null);
  const [detailDate, setDetailDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [detailItems, setDetailItems] = useState([]);
  const [detailSummary, setDetailSummary] = useState({});
  const [wasteQueue, setWasteQueue] = useState([]);
  const [wasteStatus, setWasteStatus] = useState("pending");
  const [wasteStats, setWasteStats] = useState(null);
  const [wasteAuditNote, setWasteAuditNote] = useState({});

  const LOC_LABEL = { refrig: "🧊 冷藏", freezer: "❄️ 冷凍", ambient: "🌡 常溫", display: "🪟 展示櫃" };

  const loadWaste = () => {
    setLoading(true);
    Promise.all([
      ap("/api/admin/waste?type=queue&status=" + wasteStatus + (sf ? "&store_id=" + sf : "")),
      ap("/api/admin/waste?type=stats&month=" + month + (sf ? "&store_id=" + sf : "")),
    ]).then(([q, s]) => {
      setWasteQueue(q.data || []);
      setWasteStats(s.data || null);
      setLoading(false);
    });
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

  const loadDetail = (storeId, date) => {
    setDetailStore(storeId);
    setDetailDate(date || new Date().toLocaleDateString("sv-SE"));
    setLoading(true);
    ap("/api/admin/worklogs?type=collab&store_id=" + storeId + "&date=" + (date || detailDate) + "&frequency=daily")
      .then(r => { setDetailItems(r.data || []); setDetailSummary(r.summary || {}); setLoading(false); });
  };

  useEffect(() => {
    if (view === "completion") loadCompletion();
    else if (view === "inventory") loadInventory();
    else if (view === "waste") loadWaste();
  }, [view, month, sf, invDate, wasteStatus]);

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
        {["completion", "detail", "inventory", "waste", ...((auth?.role === "admin" || auth?.role === "store_manager") ? ["settings"] : [])].map(v => {
          const labels = { completion: "📊 各店完成度", detail: "📋 每日明細", inventory: "📦 盤點回報", waste: "🗑 報廢稽核", settings: "⚙️ 日誌設定" };
          return (
            <button key={v} onClick={() => {
              setView(v);
              if (v === "detail" && sf) loadDetail(sf, detailDate);
            }} style={{
              padding: "4px 10px", borderRadius: 5, border: "1px solid #ddd",
              background: view === v ? "#1a1a1a" : "#fff",
              color: view === v ? "#fff" : "#666", fontSize: 11, cursor: "pointer"
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
              <div key={store.store_id} style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 8, cursor: "pointer" }}
                onClick={() => { setView("detail"); loadDetail(store.store_id, todayStr); }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{"🏠 " + store.store_name}</div>
                  {pct === 100 ? <span style={{ background: "#e6f9f0", color: "#0a7c42", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>✅ 完成</span>
                    : total > 0 ? <span style={{ background: "#fff8e6", color: "#8a6d00", padding: "2px 8px", borderRadius: 4, fontSize: 10 }}>{pct + "%"}</span>
                    : <span style={{ color: "#ccc", fontSize: 10 }}>尚未開始</span>}
                </div>
                {total > 0 && <div style={{ height: 6, background: "#f0f0f0", borderRadius: 3, marginBottom: 4 }}>
                  <div style={{ height: "100%", width: Math.min(100, pct) + "%", background: pct === 100 ? "#0a7c42" : "#fbbf24", borderRadius: 3 }} />
                </div>}
                <div style={{ fontSize: 10, color: "#888" }}>
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
          <div style={{ display: "flex", gap: 4, marginBottom: 8, alignItems: "center" }}>
            {!sf && <select value={detailStore || ""} onChange={e => { setDetailStore(e.target.value); loadDetail(e.target.value, detailDate); }}
              style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid #ddd", fontSize: 11 }}>
              <option value="">選擇門市</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>}
            <input type="date" value={detailDate} onChange={e => { setDetailDate(e.target.value); if (detailStore) loadDetail(detailStore, e.target.value); }}
              style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid #ddd", fontSize: 11 }} />
            <span style={{ fontSize: 11, color: "#888" }}>
              {detailSummary.done || 0}/{detailSummary.total || 0} 項 ({detailSummary.percent || 0}%)
            </span>
          </div>
          {!detailStore ? (
            <div style={{ background: "#fff", borderRadius: 8, padding: 30, textAlign: "center", color: "#ccc" }}>請選擇門市</div>
          ) : detailItems.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 8, padding: 30, textAlign: "center", color: "#ccc" }}>當日無日誌項目</div>
          ) : (() => {
            const SHIFT_LABEL = {
              morning_start: { l: "早上", c: "#f59e0b", bg: "#fef3c7" },
              morning_end:   { l: "早下", c: "#ea580c", bg: "#ffedd5" },
              evening_start: { l: "晚上", c: "#4f46e5", bg: "#e0e7ff" },
              evening_end:   { l: "晚下", c: "#7c3aed", bg: "#ede9fe" },
              opening:       { l: "開店", c: "#0a7c42", bg: "#e6f9f0" },
              during:        { l: "營業中", c: "#185fa5", bg: "#e6f1fb" },
              closing:       { l: "閉店", c: "#b91c1c", bg: "#fde8e8" },
            };
            const CAT_ORDER = ["開店前準備", "營業中交接", "閉店後清潔"];
            const CAT_ICON = { "開店前準備": "🌅", "營業中交接": "☀️", "閉店後清潔": "🌙" };
            const grouped = {};
            for (const it of detailItems) {
              const k = it.category || "其他";
              if (!grouped[k]) grouped[k] = [];
              grouped[k].push(it);
            }
            const orderedCats = [...CAT_ORDER.filter(c => grouped[c]), ...Object.keys(grouped).filter(c => !CAT_ORDER.includes(c))];

            return orderedCats.map(cat => {
              const items = grouped[cat];
              const done = items.filter(i => i.completed).length;
              return (
                <div key={cat} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#faf8f5", borderRadius: "8px 8px 0 0", border: "1px solid #e8e6e1", borderBottom: "none" }}>
                    <span style={{ fontSize: 14 }}>{CAT_ICON[cat] || "📋"}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{cat}</span>
                    <span style={{ fontSize: 10, color: "#888", marginLeft: "auto" }}>{done}/{items.length}</span>
                  </div>
                  <div style={{ background: "#fff", border: "1px solid #e8e6e1", borderRadius: "0 0 8px 8px", overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead><tr style={{ background: "#fcfbf9" }}>
                        <th style={{ padding: 5, width: 30 }}></th>
                        <th style={{ padding: 5, textAlign: "left", fontWeight: 500, color: "#666" }}>項目</th>
                        <th style={{ padding: 5, textAlign: "left", fontWeight: 500, color: "#666", width: 70 }}>時段</th>
                        <th style={{ padding: 5, textAlign: "left", fontWeight: 500, color: "#666" }}>完成人</th>
                        <th style={{ padding: 5, textAlign: "left", fontWeight: 500, color: "#666", width: 50 }}>時間</th>
                        {canEdit && <th style={{ padding: 5, textAlign: "left", fontWeight: 500, color: "#666", width: 40 }}>操作</th>}
                      </tr></thead>
                      <tbody>{items.map(item => {
                        const sh = SHIFT_LABEL[item.shift_type] || { l: item.shift_type || "-", c: "#888", bg: "#f0f0f0" };
                        return (
                          <tr key={item.id} style={{ borderTop: "1px solid #f0eeea", background: item.is_abnormal ? "#fef9c3" : "transparent" }}>
                            <td style={{ padding: 5, textAlign: "center" }}>
                              {canEdit ? (
                                <input type="checkbox" checked={!!item.completed} onChange={async () => {
                                  await ap("/api/admin/worklogs", {
                                    action: "toggle_item", item_id: item.id,
                                    completed: !item.completed,
                                    employee_id: auth?.id, employee_name: auth?.name,
                                  });
                                  loadDetail(detailStore, detailDate);
                                }} style={{ width: 16, height: 16, cursor: "pointer" }} />
                              ) : (
                                <span>{item.completed ? "✅" : "⬜"}</span>
                              )}
                            </td>
                            <td style={{ padding: 5, fontWeight: 500, textDecoration: item.completed ? "line-through" : "none", color: item.completed ? "#aaa" : "#333" }}>{item.item_name}</td>
                            <td style={{ padding: 5 }}>
                              <span style={{ background: sh.bg, color: sh.c, padding: "1px 6px", borderRadius: 10, fontSize: 9, fontWeight: 600 }}>{sh.l}</span>
                            </td>
                            <td style={{ padding: 5, fontSize: 10 }}>{item.completed_by_name || "-"}</td>
                            <td style={{ padding: 5, fontSize: 9, color: "#888" }}>{item.completed_at ? new Date(item.completed_at).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                            {canEdit && (
                              <td style={{ padding: 5 }}>
                                <button onClick={async () => {
                                  const note = prompt("備註：", item.notes || "");
                                  if (note === null) return;
                                  await ap("/api/admin/worklogs", { action: "add_note", item_id: item.id, notes: note });
                                  loadDetail(detailStore, detailDate);
                                }} style={{ fontSize: 9, color: "#4361ee", background: "none", border: "none", cursor: "pointer" }}>
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
              style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid #ddd", fontSize: 11 }} />
            <button onClick={loadInventory}
              style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid #ddd", background: "#fff", fontSize: 11, cursor: "pointer" }}>🔄</button>
          </div>
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead><tr style={{ background: "#faf8f5" }}>
                {["日期", "門市", "分類", "品項", "數量", "填報人"].map(h =>
                  <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>
                )}
              </tr></thead>
              <tbody>
                {inventoryData.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "#ccc" }}>無盤點紀錄</td></tr>
                ) : inventoryData.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #f0eeea" }}>
                    <td style={{ padding: 6 }}>{item.date}</td>
                    <td style={{ padding: 6 }}>{item.store_name || ""}</td>
                    <td style={{ padding: 6 }}><span style={{ padding: "1px 5px", borderRadius: 3, fontSize: 9, background: "#e6f1fb", color: "#185fa5" }}>{item.category}</span></td>
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

      {/* 報廢稽核 */}
      {!loading && view === "waste" && (
        <div>
          {/* 統計卡 */}
          {wasteStats && <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
            <div style={{ background: "#fff", borderRadius: 8, padding: 10, border: "1px solid #eee" }}>
              <div style={{ fontSize: 10, color: "#888" }}>本月報廢成本</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#b91c1c" }}>{fmt ? fmt(Math.round(wasteStats.totalCost)) : "$" + Math.round(wasteStats.totalCost).toLocaleString()}</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 8, padding: 10, border: "1px solid #eee" }}>
              <div style={{ fontSize: 10, color: "#888" }}>筆數</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{wasteStats.count}</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 8, padding: 10, border: "1px solid #eee" }}>
              <div style={{ fontSize: 10, color: "#888" }}>主要位置</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{Object.entries(wasteStats.byLoc || {}).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,v])=>(LOC_LABEL[k]||k)+" "+Math.round(v)).join(" / ") || "—"}</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 8, padding: 10, border: "1px solid #eee" }}>
              <div style={{ fontSize: 10, color: "#888" }}>主要原因</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{Object.entries(wasteStats.byReason || {}).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,v])=>k+" "+Math.round(v)).join(" / ") || "—"}</div>
            </div>
          </div>}

          {/* 狀態切換 */}
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {[["pending","🟡 待稽核"],["approved","✅ 已核准"],["rejected","❌ 已退回"],["observe","👁 觀察中"]].map(([k,l])=>(
              <button key={k} onClick={()=>setWasteStatus(k)} style={{ padding:"4px 10px", borderRadius:5, border:"1px solid #ddd", background: wasteStatus===k?"#1a1a1a":"#fff", color: wasteStatus===k?"#fff":"#666", fontSize:11, cursor:"pointer" }}>{l}</button>
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
                <div style={{ fontSize:11, color:"#666", marginTop:2 }}>
                  {(w.stores?.name || "") + " · " + (w.submitted_by_name || "—") + " · " + new Date(w.created_at).toLocaleString("zh-TW",{ timeZone:"Asia/Taipei" })}
                </div>
                {w.type === "waste" && <div style={{ fontSize:11, color:"#b91c1c", marginTop:2 }}>原因: {w.waste_reason || "—"}{w.note ? " · "+w.note : ""}</div>}
                {w.audit_note && <div style={{ fontSize:10, color:"#888", marginTop:2 }}>稽核備註: {w.audit_note} ({w.audit_by})</div>}
                {canEdit && wasteStatus === "pending" && w.type === "waste" && (
                  <div style={{ marginTop:6, display:"flex", gap:4, flexWrap:"wrap" }}>
                    <input type="text" placeholder="備註（退回必填）" value={wasteAuditNote[w.id]||""} onChange={e=>setWasteAuditNote({...wasteAuditNote,[w.id]:e.target.value})} style={{ flex:1, minWidth:120, padding:"4px 6px", borderRadius:4, border:"1px solid #ddd", fontSize:11 }} />
                    <button onClick={()=>auditWaste(w.id,"approved")} style={{ padding:"4px 10px", borderRadius:4, border:"none", background:"#0a7c42", color:"#fff", fontSize:11, cursor:"pointer" }}>核准</button>
                    <button onClick={()=>auditWaste(w.id,"observe")} style={{ padding:"4px 10px", borderRadius:4, border:"none", background:"#b45309", color:"#fff", fontSize:11, cursor:"pointer" }}>觀察</button>
                    <button onClick={()=>auditWaste(w.id,"rejected")} style={{ padding:"4px 10px", borderRadius:4, border:"none", background:"#b91c1c", color:"#fff", fontSize:11, cursor:"pointer" }}>退回</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 日誌設定（admin 或 store_manager） */}
      {view === "settings" && (auth?.role === "admin" || auth?.role === "store_manager") && <WorklogSettings stores={stores} />}

    </div>
  );
}
