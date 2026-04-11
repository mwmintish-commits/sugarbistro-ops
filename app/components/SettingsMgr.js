"use client";
import { useState, useEffect } from "react";
import { ap, fmt } from "./utils";

const DEFAULT_HB = [
  { title: "第一章 基本規範", items: ["準時上下班", "穿著整潔制服", "保持工作區清潔"] },
  { title: "第二章 服務守則", items: ["親切招呼客人", "正確操作收銀機", "確實執行食安流程"] },
];

export default function SettingsMgr({ stores, load }) {
  const [companyName, setCompanyName] = useState("小食糖 Sugar Bistro");
  const [hols, setHols] = useState([]);
  const [hb, setHb] = useState(null);
  const [hbLoading, setHbLoading] = useState(true);
  const [hbSaving, setHbSaving] = useState(false);
  const [editCh, setEditCh] = useState(null);
  const [newStore, setNewStore] = useState({ name: "", address: "" });
  const [clockSettings, setClockSettings] = useState({ late_grace_minutes: 5, overtime_min_minutes: 30 });

  useEffect(() => {
    ap("/api/admin/system?key=company_name").then(r => { if (r.data) setCompanyName(r.data); }).catch(() => {});
    ap("/api/admin/system?key=handbook").then(r => { setHb(r.data || DEFAULT_HB); setHbLoading(false); }).catch(() => { setHb(DEFAULT_HB); setHbLoading(false); });
    ap("/api/admin/holidays?year=" + new Date().getFullYear()).then(r => setHols(r.data || [])).catch(() => {});
    ap("/api/admin/attendance?type=settings").then(r => { if (r.data) setClockSettings(r.data); }).catch(() => {});
  }, []);

  const saveHb = async () => {
    setHbSaving(true);
    await ap("/api/admin/system", { key: "handbook", value: hb });
    setHbSaving(false);
    setEditCh(null);
    alert("✅ 守則已儲存");
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>⚙️ 系統設定</h3>

      {/* 公司名稱 */}
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>🏢 公司設定</h4>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input value={companyName} onChange={e => setCompanyName(e.target.value)}
            style={{ flex: 1, padding: "5px 8px", borderRadius: 4, border: "1px solid #ddd", fontSize: 12 }} />
          <button onClick={() => ap("/api/admin/system", { key: "company_name", value: companyName }).then(() => alert("已儲存"))}
            style={{ padding: "5px 12px", borderRadius: 4, border: "none", background: "#0a7c42", color: "#fff", fontSize: 11, cursor: "pointer" }}>💾</button>
        </div>
      </div>

      {/* 門市管理 */}
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>🏠 門市管理</h4>
        {stores.map(s => (
          <div key={s.id} style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 0", borderBottom: "1px solid #f0eeea", fontSize: 11 }}>
            <span style={{ fontWeight: 500, flex: 1 }}>{s.name}</span>
            <span style={{ color: "#888", flex: 1 }}>{s.address || "未設定地址"}</span>
            <button onClick={() => {
              const n = prompt("修改門市名稱：", s.name);
              if (n) ap("/api/admin/stores", { action: "update_targets", store_id: s.id, name: n }).then(() => { alert("已更新"); load(); });
            }} style={{ padding: "1px 6px", borderRadius: 3, border: "1px solid #ddd", background: "transparent", fontSize: 9, cursor: "pointer" }}>✏️</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
          <input value={newStore.name} onChange={e => setNewStore({ ...newStore, name: e.target.value })}
            placeholder="新門市名稱" style={{ flex: 1, padding: "4px 6px", borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }} />
          <input value={newStore.address} onChange={e => setNewStore({ ...newStore, address: e.target.value })}
            placeholder="地址" style={{ flex: 2, padding: "4px 6px", borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }} />
          <button onClick={() => {
            if (!newStore.name) return;
            ap("/api/admin/stores", { action: "create", name: newStore.name, address: newStore.address })
              .then(() => { setNewStore({ name: "", address: "" }); alert("已新增"); load(); });
          }} style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: newStore.name ? "#0a7c42" : "#ccc", color: "#fff", fontSize: 11, cursor: "pointer" }}>＋</button>
        </div>
      </div>

      {/* 打卡設定 */}
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>⚙️ 打卡設定</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <label style={{ fontSize: 10, color: "#888" }}>遲到寬限（分鐘）</label>
            <input type="number" value={clockSettings.late_grace_minutes}
              onChange={e => setClockSettings({ ...clockSettings, late_grace_minutes: Number(e.target.value) })}
              style={{ width: "100%", padding: "5px 8px", borderRadius: 4, border: "1px solid #ddd", fontSize: 12 }} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: "#888" }}>加班起算（分鐘）</label>
            <input type="number" value={clockSettings.overtime_min_minutes}
              onChange={e => setClockSettings({ ...clockSettings, overtime_min_minutes: Number(e.target.value) })}
              style={{ width: "100%", padding: "5px 8px", borderRadius: 4, border: "1px solid #ddd", fontSize: 12 }} />
          </div>
        </div>
        <button onClick={() => ap("/api/admin/attendance", { action: "update_settings", late_grace_minutes: clockSettings.late_grace_minutes, overtime_min_minutes: clockSettings.overtime_min_minutes }).then(() => alert("已儲存"))}
          style={{ marginTop: 6, padding: "4px 14px", borderRadius: 4, border: "none", background: "#0a7c42", color: "#fff", fontSize: 11, cursor: "pointer" }}>💾 儲存打卡設定</button>
      </div>

      {/* 營業目標 */}
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>🏢 營業目標 & 費用預算</h4>
        {stores.map(s => {
          const dim = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
          return (
            <div key={s.id} style={{ display: "flex", gap: 6, alignItems: "center", padding: "5px 0", borderBottom: "1px solid #f0eeea" }}>
              <span style={{ fontSize: 12, fontWeight: 500, width: 80 }}>{s.name}</span>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 9, color: "#888" }}>日營業目標</label>
                <input type="number" defaultValue={s.daily_target || ""} onBlur={e => {
                  ap("/api/admin/stores", { action: "update_targets", store_id: s.id, daily_target: Number(e.target.value || 0), monthly_target: Number(e.target.value || 0) * dim });
                }} style={{ width: "100%", padding: 3, borderRadius: 4, border: "1px solid #ddd", fontSize: 11, textAlign: "center" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 9, color: "#888" }}>{"月目標（×" + dim + "天）"}</label>
                <div style={{ padding: "4px 0", fontSize: 12, fontWeight: 600, textAlign: "center" }}>{"$" + ((s.daily_target || 0) * dim).toLocaleString()}</div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 9, color: "#888" }}>月費用預算</label>
                <input type="number" defaultValue={s.monthly_expense_budget || ""} onBlur={e => {
                  ap("/api/admin/stores", { action: "update_targets", store_id: s.id, monthly_expense_budget: Number(e.target.value || 0) });
                }} style={{ width: "100%", padding: 3, borderRadius: 4, border: "1px solid #ddd", fontSize: 11, textAlign: "center" }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* GPS 打卡範圍 */}
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>📍 門市GPS打卡範圍</h4>
        <p style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>設定門市座標和打卡範圍，員工超出範圍將無法打卡。</p>
        {stores.map(s => (
          <div key={s.id} style={{ padding: "6px 0", borderBottom: "1px solid #f0eeea" }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{s.name}</div>
            <div style={{ display: "flex", gap: 4 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 9, color: "#888" }}>緯度</label>
                <input type="number" step="0.0001" id={"lat-" + s.id} defaultValue={s.latitude || ""} placeholder="22.6273"
                  style={{ width: "100%", padding: 3, borderRadius: 4, border: "1px solid #ddd", fontSize: 10 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 9, color: "#888" }}>經度</label>
                <input type="number" step="0.0001" id={"lng-" + s.id} defaultValue={s.longitude || ""} placeholder="120.3014"
                  style={{ width: "100%", padding: 3, borderRadius: 4, border: "1px solid #ddd", fontSize: 10 }} />
              </div>
              <div style={{ width: 60 }}>
                <label style={{ fontSize: 9, color: "#888" }}>範圍m</label>
                <input type="number" id={"rad-" + s.id} defaultValue={s.radius_m || 200}
                  style={{ width: "100%", padding: 3, borderRadius: 4, border: "1px solid #ddd", fontSize: 10, textAlign: "center" }} />
              </div>
              <button onClick={() => {
                const lat = document.getElementById("lat-" + s.id).value;
                const lng = document.getElementById("lng-" + s.id).value;
                const rad = document.getElementById("rad-" + s.id).value;
                ap("/api/admin/stores", {
                  action: "update_targets", store_id: s.id,
                  latitude: lat ? Number(lat) : null,
                  longitude: lng ? Number(lng) : null,
                  radius_m: rad ? Number(rad) : 200
                }).then(() => alert(s.name + " GPS已儲存"));
              }} style={{ padding: "3px 8px", borderRadius: 4, border: "none", background: "#0a7c42", color: "#fff", fontSize: 9, cursor: "pointer", alignSelf: "flex-end" }}>💾</button>
            </div>
          </div>
        ))}
      </div>

      {/* 國定假日 */}
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
          {"🗓 " + new Date().getFullYear() + " 國定假日（" + hols.filter(h => h.is_active !== false).length + "/" + hols.length + "天啟用）"}
        </h4>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {hols.map(h => (
            <button key={h.id} onClick={() => {
              const next = h.is_active === false ? true : false;
              ap("/api/admin/holidays", { action: "toggle", holiday_id: h.id, is_active: next }).catch(() => {});
              setHols(hols.map(x => x.id === h.id ? { ...x, is_active: next } : x));
            }} style={{
              padding: "3px 8px", borderRadius: 4, cursor: "pointer",
              background: h.is_active === false ? "#f0f0f0" : "#fde8e8",
              color: h.is_active === false ? "#ccc" : "#b91c1c",
              fontSize: 10, border: "1px solid " + (h.is_active === false ? "#ddd" : "#f5c6c6"),
              textDecoration: h.is_active === false ? "line-through" : "none"
            }}>
              {h.date.slice(5) + " " + h.name}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 10, color: "#888", marginTop: 6 }}>點擊可啟用/停用，停用的假日不標紅、不計雙倍薪</p>
      </div>

      {/* 工作日誌權限 */}
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>📋 工作日誌權限</h4>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12 }}>允許門店主管修改日誌模板</div>
            <div style={{ fontSize: 10, color: "#888" }}>開啟後主管可新增/刪除本店工作項目</div>
          </div>
          <button id="wl-perm-btn" data-on="true" onClick={() => {
            const btn = document.getElementById("wl-perm-btn");
            const curr = btn.dataset.on === "true";
            const next = !curr;
            ap("/api/admin/system", { key: "worklog_manager_edit", value: next }).then(() => {
              btn.dataset.on = String(next);
              btn.style.background = next ? "#0a7c42" : "#ccc";
              btn.textContent = next ? "ON" : "OFF";
            });
          }} style={{ padding: "4px 12px", borderRadius: 12, border: "none", background: "#0a7c42", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", minWidth: 44 }}>ON</button>
        </div>
      </div>

      {/* 員工守則 */}
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>📋 員工守則編輯器</h4>
        {hbLoading ? <p style={{ color: "#aaa" }}>載入中...</p> : (
          <div>
            {(hb || []).map((ch, ci) => (
              <div key={ci} style={{ marginBottom: 8, padding: 8, background: "#faf8f5", borderRadius: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <input value={ch.title} onChange={e => { const nb = [...hb]; nb[ci] = { ...nb[ci], title: e.target.value }; setHb(nb); }}
                    style={{ fontWeight: 600, fontSize: 12, border: "none", background: "transparent", flex: 1 }} />
                  <button onClick={() => { const nb = hb.filter((_, i) => i !== ci); setHb(nb); }}
                    style={{ fontSize: 10, color: "#b91c1c", background: "none", border: "none", cursor: "pointer" }}>刪除章節</button>
                </div>
                {ch.items.map((item, ii) => (
                  <div key={ii} style={{ display: "flex", gap: 4, marginBottom: 2 }}>
                    <span style={{ color: "#888", fontSize: 10, width: 16 }}>{ii + 1}.</span>
                    <input value={item} onChange={e => { const nb = [...hb]; nb[ci].items[ii] = e.target.value; setHb(nb); }}
                      style={{ flex: 1, padding: 2, border: "1px solid #e8e6e1", borderRadius: 3, fontSize: 11 }} />
                    <button onClick={() => { const nb = [...hb]; nb[ci].items.splice(ii, 1); setHb(nb); }}
                      style={{ fontSize: 9, color: "#b91c1c", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                  </div>
                ))}
                <button onClick={() => { const nb = [...hb]; nb[ci].items.push(""); setHb(nb); }}
                  style={{ fontSize: 10, color: "#4361ee", background: "none", border: "none", cursor: "pointer", marginTop: 2 }}>＋新增項目</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button onClick={() => setHb([...(hb || []), { title: "新章節", items: [""] }])}
                style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #ddd", background: "transparent", fontSize: 11, cursor: "pointer" }}>＋新增章節</button>
              <button onClick={saveHb} disabled={hbSaving}
                style={{ padding: "4px 14px", borderRadius: 4, border: "none", background: "#0a7c42", color: "#fff", fontSize: 11, cursor: "pointer" }}>
                {hbSaving ? "儲存中..." : "💾 儲存守則"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* LINE 選單 */}
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>📱 LINE 選單設定</h4>
        <p style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>員工在 LINE 輸入「選單」時，依據角色顯示不同功能按鈕。</p>
        <div style={{ fontSize: 11, lineHeight: 2 }}>
          <div><b>👤 員工：</b>打卡、班表、請假、假勤、日結、存款</div>
          <div><b>🏪 門店主管：</b>以上 + 月結、零用金、🔗後台</div>
          <div><b>🏠 管理：</b>以上 + 總部代付、營收、🔗後台</div>
          <div><b>👑 總部：</b>🔗管理後台、營收、費用（不顯示打卡）</div>
        </div>
      </div>

      {/* 資料維護 */}
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>🧹 資料維護</h4>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <button onClick={async () => {
            const r = await ap("/api/admin/expenses", { action: "cleanup_rejected", days: 30 });
            alert("已清除 " + (r.deleted || 0) + " 筆駁回超過30天的費用");
            load();
          }} style={{ padding: "5px 10px", borderRadius: 4, border: "1px solid #b45309", background: "transparent", color: "#b45309", fontSize: 11, cursor: "pointer" }}>
            清除過期駁回單據（30天）
          </button>
          <button onClick={async () => {
            if (!confirm("⚠️ 確定清除所有費用和撥款紀錄？")) return;
            if (!confirm("再次確認：刪除全部費用+撥款，確定？")) return;
            await ap("/api/admin/expenses", { action: "delete_all" });
            alert("已清除");
            load();
          }} style={{ padding: "5px 10px", borderRadius: 4, border: "1px solid #b91c1c", background: "transparent", color: "#b91c1c", fontSize: 11, cursor: "pointer" }}>
            ⚠️ 清除全部費用（測試用）
          </button>
        </div>
      </div>
    </div>
  );
}
