"use client";
import { useState, useEffect } from "react";
import { ap, fmt } from "./utils";

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
  const [templates, setTemplates] = useState([]);

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

  const loadTemplates = (storeId) => {
    ap("/api/admin/worklogs?type=templates&store_id=" + storeId)
      .then(r => setTemplates(r.data || []));
  };

  useEffect(() => {
    if (view === "completion") loadCompletion();
    else if (view === "inventory") loadInventory();
  }, [view, month, sf, invDate]);

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
        {["completion", "detail", "inventory", "templates"].map(v => {
          const labels = { completion: "📊 各店完成度", detail: "📋 每日明細", inventory: "📦 盤點回報", templates: "⚙️ 模板管理" };
          if (v === "templates" && !canEdit) return null;
          return (
            <button key={v} onClick={() => {
              setView(v);
              if (v === "detail" && sf) loadDetail(sf, detailDate);
              if (v === "templates" && sf) loadTemplates(sf);
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
          ) : (
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead><tr style={{ background: "#faf8f5" }}>{["", "項目", "分類", "完成人", "時間", canEdit ? "操作" : ""].filter(Boolean).map(h =>
                  <th key={h} style={{ padding: 5, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>
                )}</tr></thead>
                <tbody>{detailItems.map(item => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f0eeea", background: item.is_abnormal ? "#fef9c3" : "transparent" }}>
                    <td style={{ padding: 5, textAlign: "center", width: 24 }}>
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
                    <td style={{ padding: 5, fontSize: 10 }}><span style={{ background: "#faf8f5", padding: "1px 4px", borderRadius: 3 }}>{item.category || ""}</span></td>
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
                ))}</tbody>
              </table>
            </div>
          )}
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

      {/* 模板管理（admin/manager/store_manager） */}
      {!loading && view === "templates" && canEdit && (
        <div>
          <div style={{ display: "flex", gap: 4, marginBottom: 8, alignItems: "center" }}>
            {!sf && <select value={detailStore || ""} onChange={e => { setDetailStore(e.target.value); if (e.target.value) loadTemplates(e.target.value); }}
              style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid #ddd", fontSize: 11 }}>
              <option value="">選擇門市</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>}
            <button onClick={async () => {
              const sid = sf || detailStore;
              if (!sid) { alert("請先選門市"); return; }
              const cat = prompt("分類（開店/打烊/清潔/盤點）：", "開店");
              const item = prompt("項目名稱：");
              if (!item) return;
              const st = prompt("班別（opening/closing/all）：", "opening");
              await ap("/api/admin/worklogs", { action: "add_template", store_id: sid, category: cat, item, shift_type: st });
              loadTemplates(sid);
            }} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#1a1a1a", color: "#fff", fontSize: 11, cursor: "pointer" }}>
              ＋新增項目
            </button>
          </div>
          {templates.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 8, padding: 30, textAlign: "center", color: "#ccc" }}>
              {(sf || detailStore) ? "尚無模板" : "請先選擇門市"}
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead><tr style={{ background: "#faf8f5" }}>{["分類", "項目", "班別", "頻率", "操作"].map(h =>
                  <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>
                )}</tr></thead>
                <tbody>{templates.map(t => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #f0eeea" }}>
                    <td style={{ padding: 6 }}><span style={{ background: "#faf8f5", padding: "1px 5px", borderRadius: 3, fontSize: 10 }}>{t.category}</span></td>
                    <td style={{ padding: 6, fontWeight: 500 }}>{t.item}</td>
                    <td style={{ padding: 6, fontSize: 10 }}>{t.shift_type === "opening" ? "開店" : t.shift_type === "closing" ? "打烊" : "全天"}</td>
                    <td style={{ padding: 6, fontSize: 10 }}>{t.frequency === "daily" ? "每日" : t.frequency === "weekly" ? "每週" : "每月"}</td>
                    <td style={{ padding: 6 }}>
                      <button onClick={async () => {
                        if (!confirm("刪除「" + t.item + "」？")) return;
                        await ap("/api/admin/worklogs", { action: "delete_template", template_id: t.id });
                        loadTemplates(sf || detailStore);
                      }} style={{ fontSize: 9, color: "#b91c1c", background: "none", border: "none", cursor: "pointer" }}>🗑</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
