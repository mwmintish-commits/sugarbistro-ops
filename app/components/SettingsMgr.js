"use client";
import { useState, useEffect } from "react";
import { ap, fmt } from "./utils";

const DEFAULT_HB = [
  { title: "一、出勤、排班與請假", items: ["準時上班：應提前5分鐘到崗，完成更衣、儀容確認後方可開始工作。","依公司系統（QR Code）進行上下班打卡，不得代打、協助他人代打。","不得無故曠職：曠職視為嚴重違規，第一次書面警告，第二次以上得依規定解僱。","事假、病假至少提前4小時以書面（LINE群組）通知直屬主管。","病假超過3日須檢附醫院證明，否則視為事假計算。","換班須提前告知主管並經書面同意，當事雙方負連帶責任。"] },
  { title: "二、儀容與服裝規定", items: ["穿著公司制服，保持整潔無汙損。","操作食物時全程佩戴圍裙。","穿著防滑、包趾鞋，禁止穿拖鞋、涼鞋、高跟鞋。","長髮必須紮起，接觸食品時須全程配戴廚師帽或髮網。","指甲保持短、乾淨，不得塗指甲油、貼假指甲。","工作時禁止噴灑濃烈香水，上班前不得飲酒。"] },
  { title: "三、食品衛生安全規範【最高優先】", items: ["接觸食品前、如廁後、觸碰非食品物品後，務必以肥皂洗手至少20秒。","手套破損立即更換，更換工作項目前須更換新手套。","身體不適（嘔吐、腹瀉、發燒）須立即告知主管，不得接觸食品。","冷藏食材維持7°C以下，冷凍維持-18°C以下，超出範圍須立即通報。","食材須標示開封日期及效期，超過效期禁止使用。","生熟食分開保存、分開器具，嚴禁交叉污染。","不得私自使用或帶走門市食材，須經主管批准。","工作檯面、器具、設備於使用前後均須確實清潔消毒。"] },
  { title: "四、服務態度與顧客應對", items: ["面對顧客保持主動、親切、有禮之態度，微笑服務。","對顧客稱謂一律使用「您」，禁止使用粗俗語言。","接待顧客時禁止滑手機、嬉鬧、大聲喧嘩。","遇顧客投訴保持冷靜，積極傾聽，不得與顧客爭辯。","超出處理能力之情況，立即通知主管接手。","任何顧客衝突事件均須於當日以書面（日誌）記錄。"] },
  { title: "五、金錢與財務誠信【零容忍】", items: ["收款必須依POS系統操作，禁止私自調整金額或繞過系統。","任何折扣、免單、退款需取得主管當下授權。","班次結束前須完成收銀對帳，差額超過容許範圍須書面說明。","公司財物不得私自挪用或帶離門市。","竊盜、舞弊、偽造紀錄一律直接解僱並保留法律追訴權。"] },
  { title: "六、手機與社群媒體", items: ["工作期間禁止於服務區、備料區使用私人手機。","禁止在個人社群媒體發布門市內部照片、影片。","禁止發布任何對公司、同事、顧客的負面評論。","接受媒體採訪或公開代表公司發言前，須事先獲得總部書面授權。"] },
  { title: "七、職場環境與保密", items: ["禁止任何形式的霸凌、歧視、性騷擾。","禁止對外洩露公司機密（配方、成本、供應商、營業數據、客戶資料）。","離職後保密義務仍持續有效。","操作設備前須確認熟悉使用方式，設備異常立即停止使用並通報。"] },
  { title: "八、違規等級與懲處", items: ["▲ 輕微違規：口頭警告並紀錄存檔（遲到5分鐘內首次、服裝輕微不符等）","■ 中度違規：書面警告＋季考核扣分（習慣性遲到、拒絕配合主管指示等）","● 嚴重違規：停職調查或解僱＋取消季獎金（無預警曠職、嚴重食安疏失、霸凌等）","◆ 零容忍：立即解僱＋取消所有獎金＋保留法律追訴（竊盜、詐欺、舞弊、蓄意破壞等）","書面警告累積3次以上得依勞基法辦理解僱。","同一季內書面警告2次以上，當季績效獎金取消。"] },
  { title: "九、申訴與舉報", items: ["可向直屬主管提出書面申訴，主管須於5個工作日內回覆。","涉及主管本身之違規，可直接向總部提出，舉報者身分受保密保護。","公司禁止任何形式的報復行為。"] },
];

const DEFAULT_CONTRACT = "一、乙方同意遵守甲方之員工行為規範與工作守則，並了解違反規定之懲處標準。\n二、乙方了解並同意季績效獎金制度之計算方式與發放條件，獎金屬恩惠性給與。\n三、乙方之薪資、工時、休假依勞動基準法及甲方規定辦理。\n四、乙方同意甲方依法代扣勞工保險、全民健康保險及所得稅。\n五、乙方應對甲方之營業秘密、配方、成本、客戶資料等負保密義務，離職後仍有效。\n六、任一方得依勞動基準法規定終止本合約，乙方離職應依規定辦理交接。\n七、本合約自到職日起生效，未盡事宜依勞動基準法及相關法令辦理。\n八、本合約一式兩份，甲乙雙方各執一份為憑。";

export default function SettingsMgr({ stores, load, month }) {
  const [companyName, setCompanyName] = useState("小食糖 Sugar Bistro");
  const [hols, setHols] = useState([]);
  const [hb, setHb] = useState(null);
  const [hbLoading, setHbLoading] = useState(true);
  const [hbSaving, setHbSaving] = useState(false);
  const [editCh, setEditCh] = useState(null);
  const [contractText, setContractText] = useState(DEFAULT_CONTRACT);
  const [newStore, setNewStore] = useState({ name: "", address: "" });
  const [clockSettings, setClockSettings] = useState({ late_grace_minutes: 5, overtime_min_minutes: 30 });
  const [wlStore, setWlStore] = useState("");
  const [wlTemplates, setWlTemplates] = useState([]);
  const [wlNew, setWlNew] = useState({
    category: "開店準備", item: "", role: "all", shift_type: "opening",
    frequency: "daily", weekday: "", requires_value: false, value_label: "", value_min: "", value_max: ""
  });
  const [wlCopyTarget, setWlCopyTarget] = useState("");
  const [invNew, setInvNew] = useState({ category: "庫存盤點", item: "" });

  useEffect(() => {
    ap("/api/admin/system?key=company_name").then(r => { if (r.data) setCompanyName(r.data); }).catch(() => {});
    ap("/api/admin/system?key=handbook").then(r => { setHb(r.data || DEFAULT_HB); setHbLoading(false); }).catch(() => { setHb(DEFAULT_HB); setHbLoading(false); });
    ap("/api/admin/system?key=contract").then(r => { if (r.data) setContractText(r.data); }).catch(() => {});
    ap("/api/admin/holidays?year=" + new Date().getFullYear()).then(r => setHols(r.data || [])).catch(() => {});
    ap("/api/admin/attendance?type=settings").then(r => { if (r.data) setClockSettings(r.data); }).catch(() => {});
  }, []);

  const loadWlTemplates = () => {
    if (!wlStore) return;
    ap("/api/admin/worklogs?type=templates&store_id=" + wlStore).then(r => setWlTemplates(r.data || []));
  };
  useEffect(() => { loadWlTemplates(); }, [wlStore]);

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
          const [y, m] = (month || new Date().toISOString().slice(0, 7)).split("-").map(Number);
          const dim = new Date(y, m, 0).getDate();
          return (
            <div key={s.id} style={{ padding: "8px 0", borderBottom: "1px solid #f0eeea" }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</span>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-end", marginTop: 4 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 9, color: "#888" }}>日營業目標</label>
                  <input type="number" id={"dt-" + s.id} defaultValue={s.daily_target || ""}
                    style={{ width: "100%", padding: 3, borderRadius: 4, border: "1px solid #ddd", fontSize: 11, textAlign: "center" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 9, color: "#888" }}>{"月目標（" + month + "，" + dim + "天）"}</label>
                  <div style={{ padding: "4px 0", fontSize: 12, fontWeight: 600, textAlign: "center" }}>
                    {"$" + ((s.daily_target || 0) * dim).toLocaleString()}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 9, color: "#888" }}>月費用預算</label>
                  <input type="number" id={"eb-" + s.id} defaultValue={s.monthly_expense_budget || ""}
                    style={{ width: "100%", padding: 3, borderRadius: 4, border: "1px solid #ddd", fontSize: 11, textAlign: "center" }} />
                </div>
                <button onClick={async () => {
                  const dt = Number(document.getElementById("dt-" + s.id)?.value || 0);
                  const eb = Number(document.getElementById("eb-" + s.id)?.value || 0);
                  await ap("/api/admin/stores", {
                    action: "update_targets", store_id: s.id,
                    daily_target: dt, monthly_target: dt * dim,
                    monthly_expense_budget: eb
                  });
                  alert("✅ " + s.name + " 已儲存");
                  load();
                }} style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: "#0a7c42", color: "#fff", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
                  💾
                </button>
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

      {/* 工作合約編輯器 */}
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>📝 工作合約編輯器</h4>
        <p style={{ fontSize: 10, color: "#888", marginBottom: 6 }}>新人報到簽署的合約內容，每行一個條款（自動加上編號）</p>
        <textarea value={contractText} onChange={e => setContractText(e.target.value)}
          style={{ width: "100%", minHeight: 200, padding: 8, borderRadius: 6, border: "1px solid #ddd", fontSize: 12, lineHeight: 1.8, fontFamily: "system-ui" }} />
        <button onClick={async () => {
          await ap("/api/admin/system", { key: "contract", value: contractText });
          alert("合約已儲存");
        }} style={{ marginTop: 6, padding: "5px 16px", borderRadius: 6, border: "none", background: "#0a7c42", color: "#fff", fontSize: 11, cursor: "pointer" }}>💾 儲存合約</button>
      </div>

      {/* 工作日誌模板管理 */}
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>📋 工作日誌模板管理</h4>
        <select value={wlStore} onChange={e => setWlStore(e.target.value)}
          style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 11, marginBottom: 8, width: "100%" }}>
          <option value="">選擇門市</option>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {wlStore && (
          <div>
            {/* 現有模板列表 */}
            {(() => {
              const grouped = {};
              wlTemplates.forEach(t => { const c = t.category || "其他"; if (!grouped[c]) grouped[c] = []; grouped[c].push(t); });
              return Object.entries(grouped).length > 0 ? Object.entries(grouped).map(([cat, items]) => (
                <div key={cat} style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 2 }}>{cat + "（" + items.length + "）"}</div>
                  {items.map(t => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderBottom: "1px solid #f0eeea", fontSize: 11 }}>
                      <span style={{ flex: 1 }}>
                        {t.item}
                        {t.role !== "all" && <span style={{ fontSize: 8, background: "#fef9c3", color: "#8a6d00", padding: "0 3px", borderRadius: 2, marginLeft: 3 }}>{t.role}</span>}
                        {t.frequency === "weekly" && <span style={{ fontSize: 8, background: "#e6f1fb", color: "#185fa5", padding: "0 3px", borderRadius: 2, marginLeft: 3 }}>{"週"}</span>}
                        {t.frequency === "monthly" && <span style={{ fontSize: 8, background: "#fde8e8", color: "#b91c1c", padding: "0 3px", borderRadius: 2, marginLeft: 3 }}>月</span>}
                        {t.requires_value && <span style={{ fontSize: 8, background: "#e6f9f0", color: "#0a7c42", padding: "0 3px", borderRadius: 2, marginLeft: 3 }}>{"📊" + (t.value_label || "數值")}</span>}
                      </span>
                      <button onClick={async () => { if (!confirm("刪除？")) return; await ap("/api/admin/worklogs", { action: "delete_template", template_id: t.id }); loadWlTemplates(); }}
                        style={{ fontSize: 10, color: "#b91c1c", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                    </div>
                  ))}
                </div>
              )) : (
                <div style={{ padding: 16, textAlign: "center", color: "#ccc", fontSize: 11 }}>此門市尚無模板</div>
              );
            })()}

            {/* 新增模板表單 */}
            <div style={{ background: "#faf8f5", borderRadius: 6, padding: 8, marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 4 }}>＋ 新增工作項目</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
                <select value={wlNew.frequency} onChange={e => setWlNew({ ...wlNew, frequency: e.target.value })}
                  style={{ padding: 3, borderRadius: 4, border: "1px solid #ddd", fontSize: 10 }}>
                  <option value="daily">每日</option><option value="weekly">週清</option><option value="monthly">月清</option>
                </select>
                {wlNew.frequency === "weekly" && (
                  <select value={wlNew.weekday} onChange={e => setWlNew({ ...wlNew, weekday: e.target.value })}
                    style={{ padding: 3, borderRadius: 4, border: "1px solid #ddd", fontSize: 10 }}>
                    <option value="">星期</option>
                    {["日", "一", "二", "三", "四", "五", "六"].map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                )}
                <select value={wlNew.category} onChange={e => {
                  const v = e.target.value;
                  const isInv = v.includes("盤點");
                  setWlNew({ ...wlNew, category: v, requires_value: isInv || wlNew.requires_value, value_label: isInv ? "數量" : wlNew.value_label });
                }}
                  style={{ padding: 3, borderRadius: 4, border: "1px solid #ddd", fontSize: 10 }}>
                  {["開店準備", "營業中", "打烊作業", "清潔消毒", "食材管理", "溫度記錄", "設備維護", "週清潔", "月清潔"].map(c =>
                    <option key={c} value={c}>{c}</option>
                  )}
                </select>
                <select value={wlNew.role} onChange={e => setWlNew({ ...wlNew, role: e.target.value })}
                  style={{ padding: 3, borderRadius: 4, border: "1px solid #ddd", fontSize: 10 }}>
                  <option value="all">全員</option><option value="外場">外場</option><option value="內場">內場</option><option value="吧台">吧台</option><option value="烘焙">烘焙</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                <input value={wlNew.item} onChange={e => setWlNew({ ...wlNew, item: e.target.value })}
                  placeholder="工作項目名稱" onKeyDown={e => { if (e.key === "Enter" && wlNew.item) { ap("/api/admin/worklogs", { action: "add_template", store_id: wlStore, ...wlNew }); setWlNew({ ...wlNew, item: "" }); setTimeout(loadWlTemplates, 300); } }}
                  style={{ flex: 1, padding: "4px 6px", borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }} />
                <button onClick={async () => {
                  if (!wlNew.item) return;
                  await ap("/api/admin/worklogs", { action: "add_template", store_id: wlStore, ...wlNew });
                  setWlNew({ ...wlNew, item: "" });
                  loadWlTemplates();
                }} disabled={!wlNew.item}
                  style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: wlNew.item ? "#0a7c42" : "#ccc", color: "#fff", fontSize: 11, cursor: "pointer" }}>
                  新增
                </button>
              </div>
              <div style={{ display: "flex", gap: 3, alignItems: "center", fontSize: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 2, cursor: "pointer" }}>
                  <input type="checkbox" checked={wlNew.requires_value}
                    onChange={e => setWlNew({ ...wlNew, requires_value: e.target.checked })} />
                  需輸入數值
                </label>
                {wlNew.requires_value && (
                  <>
                    <input value={wlNew.value_label} onChange={e => setWlNew({ ...wlNew, value_label: e.target.value })}
                      placeholder="單位" style={{ width: 40, padding: 2, borderRadius: 3, border: "1px solid #ddd", fontSize: 10 }} />
                    <input type="number" value={wlNew.value_min} onChange={e => setWlNew({ ...wlNew, value_min: e.target.value })}
                      placeholder="最小" style={{ width: 35, padding: 2, borderRadius: 3, border: "1px solid #ddd", fontSize: 10 }} />
                    <span>~</span>
                    <input type="number" value={wlNew.value_max} onChange={e => setWlNew({ ...wlNew, value_max: e.target.value })}
                      placeholder="最大" style={{ width: 35, padding: 2, borderRadius: 3, border: "1px solid #ddd", fontSize: 10 }} />
                  </>
                )}
              </div>
            </div>

            {/* 複製到其他門市 */}
            {wlTemplates.length > 0 && (
              <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                <select value={wlCopyTarget} onChange={e => setWlCopyTarget(e.target.value)}
                  style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }}>
                  <option value="">複製到門市...</option>
                  {stores.filter(s => s.id !== wlStore).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button onClick={async () => {
                  if (!wlCopyTarget) return;
                  await ap("/api/admin/worklogs", { action: "copy_to_store", from_store_id: wlStore, to_store_id: wlCopyTarget });
                  alert("已複製");
                }} disabled={!wlCopyTarget}
                  style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: wlCopyTarget ? "#4361ee" : "#ccc", color: "#fff", fontSize: 11, cursor: "pointer" }}>
                  📋 複製
                </button>
              </div>
            )}

            {/* 📦 盤點項目設定 */}
            <div style={{ background: "#e6f1fb", borderRadius: 8, padding: 10, marginTop: 10 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: "#185fa5", marginBottom: 6 }}>📦 盤點項目設定</h4>
              <p style={{ fontSize: 9, color: "#888", marginBottom: 6 }}>設定每日需盤點的品項，員工在日誌中填寫數量，後台即時顯示。</p>

              {/* 現有盤點項目 */}
              {(() => {
                const invItems = wlTemplates.filter(t => (t.category || "").includes("盤點"));
                const invGrouped = {};
                invItems.forEach(t => { const c = t.category; if (!invGrouped[c]) invGrouped[c] = []; invGrouped[c].push(t); });
                return Object.entries(invGrouped).length > 0 ? Object.entries(invGrouped).map(([cat, items]) => (
                  <div key={cat} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: cat === "庫存盤點" ? "#185fa5" : cat === "冷藏盤點" ? "#0a7c42" : "#8a6d00", marginBottom: 2 }}>
                      {(cat === "庫存盤點" ? "📦 " : "🧊 ") + cat + "（" + items.length + "項）"}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {items.map(t => (
                        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 2, background: "#fff", borderRadius: 4, padding: "2px 6px", fontSize: 10, border: "1px solid #ddd" }}>
                          <span>{t.item}</span>
                          {t.value_label && <span style={{ color: "#888" }}>{"(" + t.value_label + ")"}</span>}
                          <button onClick={async () => { await ap("/api/admin/worklogs", { action: "delete_template", template_id: t.id }); loadWlTemplates(); }}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#b91c1c", padding: 0 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )) : (
                  <div style={{ fontSize: 10, color: "#aaa", marginBottom: 6 }}>尚無盤點項目</div>
                );
              })()}

              {/* 新增盤點項目 */}
              <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 6 }}>
                <select value={invNew.category} onChange={e => setInvNew({ ...invNew, category: e.target.value })}
                  style={{ padding: 3, borderRadius: 4, border: "1px solid #ddd", fontSize: 10 }}>
                  <option value="庫存盤點">📦 庫存盤點</option>
                  <option value="冷藏盤點">🧊 冷藏盤點</option>
                  <option value="冷凍盤點">🧊 冷凍盤點</option>
                </select>
                <input value={invNew.item} onChange={e => setInvNew({ ...invNew, item: e.target.value })}
                  placeholder="品項名稱（如：全脂牛奶）"
                  onKeyDown={e => {
                    if (e.key === "Enter" && invNew.item) {
                      ap("/api/admin/worklogs", {
                        action: "add_template", store_id: wlStore,
                        category: invNew.category, item: invNew.item, role: "all",
                        shift_type: "closing", frequency: "daily",
                        requires_value: true, value_label: "數量"
                      });
                      setInvNew({ ...invNew, item: "" });
                      setTimeout(loadWlTemplates, 300);
                    }
                  }}
                  style={{ flex: 1, padding: "3px 6px", borderRadius: 4, border: "1px solid #ddd", fontSize: 11 }} />
                <button onClick={async () => {
                  if (!invNew.item) return;
                  await ap("/api/admin/worklogs", {
                    action: "add_template", store_id: wlStore,
                    category: invNew.category, item: invNew.item, role: "all",
                    shift_type: "closing", frequency: "daily",
                    requires_value: true, value_label: "數量"
                  });
                  setInvNew({ ...invNew, item: "" });
                  loadWlTemplates();
                }} disabled={!invNew.item}
                  style={{ padding: "3px 10px", borderRadius: 4, border: "none", background: invNew.item ? "#185fa5" : "#ccc", color: "#fff", fontSize: 11, cursor: "pointer" }}>
                  ＋
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 資料維護 */}
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>🧹 資料維護</h4>
        <p style={{ fontSize: 10, color: "#b91c1c", marginBottom: 8 }}>⚠️ 刪除後無法復原，請謹慎操作</p>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
          <button onClick={async () => {
            const r = await ap("/api/admin/expenses", { action: "cleanup_rejected", days: 30 });
            alert("已清除 " + (r.deleted || 0) + " 筆駁回超過30天的費用");
            load();
          }} style={{ padding: "5px 10px", borderRadius: 4, border: "1px solid #b45309", background: "transparent", color: "#b45309", fontSize: 11, cursor: "pointer" }}>
            清除過期駁回單據
          </button>
        </div>
        <div style={{ fontSize: 11, fontWeight: 500, color: "#666", marginBottom: 4 }}>🗑 一鍵清除（二次確認）</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[
            ["schedules", "📅 排班"],
            ["worklogs", "📋 日誌"],
            ["expenses", "📦 費用+撥款"],
            ["settlements", "💰 日結"],
            ["deposits", "🏦 存款"],
            ["attendance", "📍 出勤"],
            ["overtime", "⏱ 加班"],
          ].map(([key, label]) => (
            <button key={key} onClick={async () => {
              if (!confirm("確定清除全部「" + label + "」資料？")) return;
              if (!confirm("再次確認：刪除全部" + label + "，無法復原！")) return;
              const r = await ap("/api/admin/system", { action: "cleanup", target: key });
              alert("已清除 " + (r.deleted || 0) + " 筆");
              load();
            }} style={{ padding: "5px 10px", borderRadius: 4, border: "1px solid #b91c1c", background: "transparent", color: "#b91c1c", fontSize: 11, cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
