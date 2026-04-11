"use client";
import { useState, useEffect } from "react";
import { ap } from "./utils";

export default function WorklogMgr({ stores, sf, month, load, role, lockedStore }) {
  const [wlStore, setWlStore] = useState(lockedStore || sf || "");
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [wlLd, setWlLd] = useState(false);
  const [newItem, setNewItem] = useState({
    category: "開店準備", item: "", role: "all", shift_type: "opening",
    frequency: "daily", weekday: "", requires_value: false, value_label: "", value_min: "", value_max: ""
  });
  const [copyTarget, setCopyTarget] = useState("");
  const [canEdit, setCanEdit] = useState(role === "admin" || role === "manager");

  const loadWl = () => {
    if (!wlStore) return;
    setWlLd(true);
    Promise.all([
      ap("/api/admin/worklogs?type=templates&store_id=" + wlStore),
      ap("/api/admin/worklogs?month=" + month + "&store_id=" + wlStore),
      ap("/api/admin/system?key=worklog_manager_edit").catch(() => ({ data: true })),
    ]).then(([t, l, perm]) => {
      setTemplates(t.data || []);
      setLogs(l.data || []);
      const permOn = perm.data === true || perm.data === "true";
      setCanEdit(role === "admin" || role === "manager" || (role === "store_manager" && permOn));
      setWlLd(false);
    });
  };

  useEffect(() => { loadWl(); }, [wlStore, month]);

  const addTemplate = async () => {
    if (!newItem.item) return;
    await ap("/api/admin/worklogs", { action: "add_template", store_id: wlStore, ...newItem });
    setNewItem({ ...newItem, item: "" });
    loadWl();
  };

  const delTemplate = async (id) => {
    if (!confirm("確定刪除？")) return;
    await ap("/api/admin/worklogs", { action: "delete_template", template_id: id });
    loadWl();
  };

  const copyTemplates = async () => {
    if (!copyTarget || !wlStore) return;
    await ap("/api/admin/worklogs", { action: "copy_to_store", from_store_id: wlStore, to_store_id: copyTarget });
    alert("已複製");
  };

  const grouped = {};
  for (const t of templates) {
    const cat = t.category || "其他";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(t);
  }

  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>📋 工作日誌管理</h3>

      {!lockedStore && (
        <select value={wlStore} onChange={e => setWlStore(e.target.value)}
          style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 11, marginBottom: 10 }}>
          <option value="">選擇門市</option>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}

      {wlStore && !wlLd && (
        <div>
          {/* 模板列表 */}
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 4 }}>{cat}</div>
              <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1" }}>
                {items.map(t => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderBottom: "1px solid #f0eeea" }}>
                    <span style={{ fontSize: 11, flex: 1 }}>
                      <span style={{ fontWeight: 500 }}>{t.item}</span>
                      {t.role !== "all" && <span style={{ fontSize: 9, background: "#fef9c3", color: "#8a6d00", padding: "1px 4px", borderRadius: 3, marginLeft: 4 }}>{t.role}</span>}
                      {t.frequency === "weekly" && <span style={{ fontSize: 9, background: "#e6f1fb", color: "#185fa5", padding: "1px 4px", borderRadius: 3, marginLeft: 4 }}>{"週" + (t.weekday != null ? ["日","一","二","三","四","五","六"][t.weekday] : "")}</span>}
                      {t.frequency === "monthly" && <span style={{ fontSize: 9, background: "#fde8e8", color: "#b91c1c", padding: "1px 4px", borderRadius: 3, marginLeft: 4 }}>月</span>}
                      {t.requires_value && <span style={{ fontSize: 9, background: "#e6f9f0", color: "#0a7c42", padding: "1px 4px", borderRadius: 3, marginLeft: 4 }}>{"📊" + (t.value_label || "")}</span>}
                    </span>
                    {canEdit && (
                      <button onClick={() => delTemplate(t.id)}
                        style={{ fontSize: 10, color: "#b91c1c", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {templates.length === 0 && (
            <div style={{ background: "#fff", borderRadius: 8, padding: 20, textAlign: "center", color: "#ccc", marginBottom: 8 }}>
              此門市尚無工作項目模板
            </div>
          )}

          {/* 新增模板 */}
          {canEdit && (
            <div style={{ background: "#fff", borderRadius: 8, border: "2px dashed #ddd", padding: 10, marginTop: 10 }}>
              <h4 style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>＋ 新增工作項目</h4>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                <select value={newItem.frequency} onChange={e => setNewItem({ ...newItem, frequency: e.target.value })}
                  style={{ padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}>
                  <option value="daily">每日</option><option value="weekly">週清</option><option value="monthly">月清</option>
                </select>
                {newItem.frequency === "weekly" && (
                  <select value={newItem.weekday} onChange={e => setNewItem({ ...newItem, weekday: e.target.value })}
                    style={{ padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}>
                    <option value="">星期</option>
                    {["日","一","二","三","四","五","六"].map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                )}
                <select value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                  style={{ padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}>
                  {["開店準備","營業中","打烊作業","清潔消毒","食材管理","溫度記錄","盤點","設備維護","週清潔","月清潔"].map(c =>
                    <option key={c}>{c}</option>
                  )}
                </select>
                <select value={newItem.shift_type} onChange={e => setNewItem({ ...newItem, shift_type: e.target.value })}
                  style={{ padding: 4, borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}>
                  <option value="opening">開店</option><option value="during">營業中</option><option value="closing">打烊</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                <input value={newItem.item} onChange={e => setNewItem({ ...newItem, item: e.target.value })}
                  placeholder="工作項目名稱" onKeyDown={e => e.key === "Enter" && addTemplate()}
                  style={{ flex: 1, padding: "5px 8px", borderRadius: 4, border: "1px solid #ddd", fontSize: 12 }} />
                <button onClick={addTemplate} disabled={!newItem.item}
                  style={{ padding: "5px 14px", borderRadius: 4, border: "none", background: newItem.item ? "#0a7c42" : "#ccc", color: "#fff", fontSize: 11, cursor: "pointer" }}>
                  新增
                </button>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 2, cursor: "pointer" }}>
                  <input type="checkbox" checked={newItem.requires_value}
                    onChange={e => setNewItem({ ...newItem, requires_value: e.target.checked })} />
                  需輸入數值
                </label>
                {newItem.requires_value && (
                  <>
                    <input value={newItem.value_label} onChange={e => setNewItem({ ...newItem, value_label: e.target.value })}
                      placeholder="單位(°C)" style={{ width: 50, padding: 2, borderRadius: 3, border: "1px solid #ddd", fontSize: 10 }} />
                    <input type="number" value={newItem.value_min} onChange={e => setNewItem({ ...newItem, value_min: e.target.value })}
                      placeholder="最小" style={{ width: 40, padding: 2, borderRadius: 3, border: "1px solid #ddd", fontSize: 10 }} />
                    <span>~</span>
                    <input type="number" value={newItem.value_max} onChange={e => setNewItem({ ...newItem, value_max: e.target.value })}
                      placeholder="最大" style={{ width: 40, padding: 2, borderRadius: 3, border: "1px solid #ddd", fontSize: 10 }} />
                  </>
                )}
              </div>
            </div>
          )}

          {/* 複製模板 */}
          {(role === "admin" || role === "manager") && templates.length > 0 && (
            <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
              <select value={copyTarget} onChange={e => setCopyTarget(e.target.value)}
                style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}>
                <option value="">複製到門市...</option>
                {stores.filter(s => s.id !== wlStore).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button onClick={copyTemplates} disabled={!copyTarget}
                style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: copyTarget ? "#4361ee" : "#ccc", color: "#fff", fontSize: 11, cursor: "pointer" }}>
                📋 複製
              </button>
            </div>
          )}

          {/* 每日完成度 */}
          <h4 style={{ fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 6 }}>📝 每日完成度</h4>
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: "#faf8f5" }}>
                  {["日期", "完成度", "協作者"].map(h =>
                    <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={3} style={{ padding: 16, textAlign: "center", color: "#ccc" }}>本月無紀錄</td></tr>
                ) : logs.map(l => (
                  <tr key={(l.date || "") + (l.store_id || "")} style={{ borderBottom: "1px solid #f0eeea" }}>
                    <td style={{ padding: 6 }}>{l.date}</td>
                    <td style={{ padding: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 60, height: 6, background: "#f0f0f0", borderRadius: 3 }}>
                          <div style={{ height: "100%", width: (l.percent || 0) + "%", background: l.percent === 100 ? "#0a7c42" : "#fbbf24", borderRadius: 3 }} />
                        </div>
                        <span style={{ fontWeight: 600, color: l.percent === 100 ? "#0a7c42" : "#b45309" }}>{(l.percent || 0) + "%"}</span>
                        <span style={{ color: "#888" }}>{"(" + (l.done || 0) + "/" + (l.total || 0) + ")"}</span>
                      </div>
                    </td>
                    <td style={{ padding: 6, fontSize: 10 }}>{(l.people || []).join("、") || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
