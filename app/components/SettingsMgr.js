"use client";
import React, { useState, useEffect } from "react";
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
  const [roleTabs, setRoleTabs] = useState(null);
  const [backups, setBackups] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);

  const ALL_TABS = [
    { key:"dashboard", label:"🏠總覽", group:"總覽" },
    { key:"employees", label:"👥員工", group:"人資" },
    { key:"schedules", label:"📅排班", group:"人資" },
    { key:"leaves", label:"🙋請假", group:"人資" },
    { key:"attendance", label:"📍出勤", group:"人資" },
    { key:"overtime", label:"🏖休假表", group:"人資" },
    { key:"payroll", label:"💰薪資", group:"人資" },
    { key:"reviews", label:"📝考核", group:"人資" },
    { key:"bonus", label:"🏆獎金", group:"人資" },
    { key:"settlements", label:"💰日結", group:"財務" },
    { key:"deposits", label:"🏦存款", group:"財務" },
    { key:"expenses", label:"📦費用", group:"財務" },
    { key:"payments", label:"💳撥款", group:"財務" },
    { key:"pnl", label:"📊損益", group:"財務" },
    { key:"recipes", label:"📋配方", group:"生產" },
    { key:"production", label:"🏭生產", group:"生產" },
    { key:"inventory", label:"📊庫存", group:"生產" },
    { key:"products", label:"🏷️產品", group:"業務" },
    { key:"clients", label:"👥客戶", group:"業務" },
    { key:"orders", label:"📝訂單", group:"業務" },
    { key:"shifts", label:"⏰崗位", group:"管理" },
    { key:"worklogs", label:"📋日誌", group:"管理" },
    { key:"announcements", label:"📢公告", group:"管理" },
    { key:"audit", label:"📋操作日誌", group:"管理" },
    { key:"settings", label:"⚙️設定", group:"管理" },
  ];
  const ROLE_NAMES = { manager:"🏠管理員", store_manager:"🏪門市主管" };

  useEffect(() => {
    ap("/api/admin/system?key=company_name").then(r => { if (r.data?.value) setCompanyName(r.data.value); }).catch(() => {});
    ap("/api/admin/system?key=handbook").then(r => { setHb(r.data?.value || DEFAULT_HB); setHbLoading(false); }).catch(() => { setHb(DEFAULT_HB); setHbLoading(false); });
    ap("/api/admin/system?key=contract").then(r => { if (r.data?.value) setContractText(r.data.value); }).catch(() => {});
    ap("/api/admin/holidays?year=" + new Date().getFullYear()).then(r => setHols(r.data || [])).catch(() => {});
    ap("/api/admin/attendance?type=settings").then(r => { if (r.data) setClockSettings(r.data); }).catch(() => {});
    ap("/api/admin/system?key=role_tabs").then(r => { if (r.data?.value) setRoleTabs(r.data.value); else setRoleTabs({ manager:["employees","schedules","leaves","attendance","overtime","payroll","reviews","settlements","deposits","expenses","payments","pnl","recipes","production","inventory","clients","orders","products","shifts","worklogs"], store_manager:["schedules","leaves","store_staff","shifts","worklogs","inventory","announcements","settlements","deposits","expenses"] }); }).catch(() => {});
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

      {/* 門市管理（含定位、目標、預算） */}
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>🏠 門市管理</h4>
        {stores.map(s => (
          <div key={s.id} style={{ padding: 10, marginBottom: 8, borderRadius: 8, border: "1px solid #e8e6e1", background: "#faf8f5" }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
              <div style={{ flex: 1 }}><label style={{ fontSize: 9, color: "#888" }}>名稱</label><input id={"sn-"+s.id} defaultValue={s.name} style={{ width: "100%", padding: "5px 8px", border: "1px solid #eee", borderRadius: 6, fontSize: 12, fontWeight: 600 }} /></div>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}><label style={{ fontSize: 9, color: "#888" }}>地址</label><input id={"sa-"+s.id} defaultValue={s.address||""} placeholder="輸入完整地址" style={{ width: "100%", padding: "5px 8px", border: "1px solid #eee", borderRadius: 6, fontSize: 11 }} /></div>
            </div>
            {/* 定位方式 */}
            <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
              <button onClick={() => {
                const addr = document.getElementById("sa-"+s.id).value || s.name;
                window.open("https://www.google.com/maps/search/" + encodeURIComponent(addr), "_blank");
                alert("請在 Google Maps 找到門市位置後：\n\n1. 右鍵點擊門市位置\n2. 點擊座標數字（會自動複製）\n3. 回來貼到下方「緯度, 經度」欄位\n\n格式範例：25.033964, 121.564468");
              }} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #4361ee", background: "#fff", color: "#4361ee", fontSize: 11, cursor: "pointer" }}>🗺️ Google Maps 查詢</button>
              <button onClick={() => {
                if (!navigator.geolocation) { alert("不支援定位"); return; }
                const btn = document.getElementById("loc-btn-"+s.id);
                if (btn) btn.textContent = "⏳ 定位中...";
                navigator.geolocation.getCurrentPosition(pos => {
                  document.getElementById("lat-"+s.id).value = pos.coords.latitude.toFixed(6);
                  document.getElementById("lng-"+s.id).value = pos.coords.longitude.toFixed(6);
                  const iframe = document.getElementById("map-"+s.id);
                  if (iframe) iframe.src = "https://www.openstreetmap.org/export/embed.html?bbox=" + (pos.coords.longitude-0.003) + "," + (pos.coords.latitude-0.002) + "," + (pos.coords.longitude+0.003) + "," + (pos.coords.latitude+0.002) + "&layer=mapnik&marker=" + pos.coords.latitude + "," + pos.coords.longitude;
                  document.getElementById("map-wrap-"+s.id).style.display = "block";
                  if (btn) btn.textContent = "✅ 精度" + Math.round(pos.coords.accuracy) + "m";
                }, err => { if (btn) btn.textContent = "❌"; alert("定位失敗：" + err.message + "\n\n請用 Google Maps 查詢方式"); }, { enableHighAccuracy: true, timeout: 15000 });
              }} id={"loc-btn-"+s.id} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#0a7c42", color: "#fff", fontSize: 11, cursor: "pointer" }}>📍 到現場定位</button>
            </div>
            {/* 座標輸入（從 Google Maps 複製貼上） */}
            <div style={{ display: "flex", gap: 4, marginBottom: 6, alignItems: "flex-end" }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: 9, color: "#888" }}>緯度, 經度（從 Google Maps 複製）</label>
                <input id={"coords-"+s.id} defaultValue={s.latitude && s.longitude ? s.latitude + ", " + s.longitude : ""} placeholder="25.033964, 121.564468"
                  onChange={e => {
                    const parts = e.target.value.split(",").map(x => x.trim());
                    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                      document.getElementById("lat-"+s.id).value = parts[0];
                      document.getElementById("lng-"+s.id).value = parts[1];
                      const iframe = document.getElementById("map-"+s.id);
                      if (iframe) iframe.src = "https://www.openstreetmap.org/export/embed.html?bbox=" + (Number(parts[1])-0.003) + "," + (Number(parts[0])-0.002) + "," + (Number(parts[1])+0.003) + "," + (Number(parts[0])+0.002) + "&layer=mapnik&marker=" + parts[0] + "," + parts[1];
                      document.getElementById("map-wrap-"+s.id).style.display = "block";
                    }
                  }}
                  style={{ width: "100%", padding: "5px 8px", border: "1px solid #ddd", borderRadius: 6, fontSize: 11 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 9, color: "#888" }}>打卡範圍</label>
                <select id={"rad-"+s.id} defaultValue={s.radius_m||200} style={{ width: "100%", padding: "5px", borderRadius: 6, border: "1px solid #ddd", fontSize: 11 }}><option value="50">50m</option><option value="100">100m</option><option value="150">150m</option><option value="200">200m</option><option value="300">300m</option><option value="500">500m</option></select>
              </div>
            </div>
            {/* 地圖預覽 */}
            <div id={"map-wrap-"+s.id} style={{ display: s.latitude && s.longitude ? "block" : "none", borderRadius: 6, overflow: "hidden", border: "1px solid #eee", marginBottom: 6 }}>
              <iframe id={"map-"+s.id} src={s.latitude && s.longitude ? `https://www.openstreetmap.org/export/embed.html?bbox=${s.longitude-0.003},${s.latitude-0.002},${s.longitude+0.003},${s.latitude+0.002}&layer=mapnik&marker=${s.latitude},${s.longitude}` : ""} style={{ width: "100%", height: 120, border: "none" }} loading="lazy" />
            </div>
            <input type="hidden" id={"lat-"+s.id} defaultValue={s.latitude||""} />
            <input type="hidden" id={"lng-"+s.id} defaultValue={s.longitude||""} />
            {/* 目標 + 預算 */}
            <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}><label style={{ fontSize: 9, color: "#888" }}>日營收目標</label><input type="number" id={"dt-"+s.id} defaultValue={s.daily_target||0} style={{ width: "100%", padding: "4px 6px", borderRadius: 6, border: "1px solid #ddd", fontSize: 11 }} /></div>
              <div style={{ flex: 1 }}><label style={{ fontSize: 9, color: "#888" }}>月費用預算</label><input type="number" id={"eb-"+s.id} defaultValue={s.monthly_expense_budget||0} style={{ width: "100%", padding: "4px 6px", borderRadius: 6, border: "1px solid #ddd", fontSize: 11 }} /></div>
            </div>
            <button onClick={async () => {
              try {
                const lat = document.getElementById("lat-"+s.id)?.value;
                const lng = document.getElementById("lng-"+s.id)?.value;
                const rad = document.getElementById("rad-"+s.id)?.value;
                const dt = document.getElementById("dt-"+s.id)?.value;
                const eb = document.getElementById("eb-"+s.id)?.value;
                const name = document.getElementById("sn-"+s.id)?.value;
                const addr = document.getElementById("sa-"+s.id)?.value;
                if (!name) { alert("請輸入門市名稱"); return; }
                const r = await ap("/api/admin/stores", { action: "update_targets", store_id: s.id, name, address: addr || "", latitude: lat ? Number(lat) : null, longitude: lng ? Number(lng) : null, radius_m: Number(rad) || 200, daily_target: Number(dt) || 0, monthly_expense_budget: Number(eb) || 0 });
                if (r.error) { alert("❌ 儲存失敗：" + r.error); return; }
                alert("✅ " + name + " 已儲存");
                load();
              } catch (e) { alert("❌ " + (e.message || "儲存失敗")); }
            }} style={{ width: "100%", padding: "7px", borderRadius: 6, border: "none", background: "#0a7c42", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>💾 儲存 {s.name}</button>
          </div>
        ))}
        {/* 新增門市 */}
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <input value={newStore.name} onChange={e=>setNewStore({...newStore,name:e.target.value})} placeholder="新門市名稱" style={{ flex: 1, padding: "5px 8px", border: "1px dashed #ccc", borderRadius: 6, fontSize: 11 }} />
          <input value={newStore.address} onChange={e=>setNewStore({...newStore,address:e.target.value})} placeholder="地址" style={{ flex: 2, padding: "5px 8px", border: "1px dashed #ccc", borderRadius: 6, fontSize: 11 }} />
          <button onClick={()=>{if(!newStore.name)return;ap("/api/admin/stores",{action:"create",name:newStore.name,address:newStore.address}).then(()=>{setNewStore({name:"",address:""});load();});}} style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "#1a1a1a", color: "#fff", fontSize: 11, cursor: "pointer" }}>＋新增</button>
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

      {/* 權限管理 */}
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>🔐 角色權限管理</h4>
        <div style={{ fontSize: 10, color: "#888", marginBottom: 8 }}>👑總部管理員 擁有所有權限（不可修改）。以下設定其他角色的可見功能：</div>
        {roleTabs && (
          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead><tr style={{ background: "#faf8f5" }}>
                <th style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666" }}>功能</th>
                {Object.keys(ROLE_NAMES).map(r => <th key={r} style={{ padding: 6, textAlign: "center", fontWeight: 500, color: "#666", minWidth: 70 }}>{ROLE_NAMES[r]}</th>)}
              </tr></thead>
              <tbody>
                {["總覽","人資","財務","生產","業務","管理"].map(group => {
                  const tabs = ALL_TABS.filter(t => t.group === group);
                  return [
                    <tr key={"g-"+group}><td colSpan={3} style={{ padding: "6px 6px 2px", fontWeight: 600, fontSize: 10, color: "#888", background: "#faf8f5" }}>{group}</td></tr>,
                    ...tabs.map(t => (
                      <tr key={t.key} style={{ borderBottom: "1px solid #f5f3f0" }}>
                        <td style={{ padding: "4px 6px", fontSize: 11 }}>{t.label}</td>
                        {Object.keys(ROLE_NAMES).map(role => {
                          const on = (roleTabs[role] || []).includes(t.key);
                          return <td key={role} style={{ padding: "4px 6px", textAlign: "center" }}>
                            <button onClick={() => { const nr = { ...roleTabs }; if (on) nr[role] = (nr[role] || []).filter(x => x !== t.key); else nr[role] = [...(nr[role] || []), t.key]; setRoleTabs(nr); }}
                              style={{ width: 36, height: 22, borderRadius: 11, border: "none", background: on ? "#0a7c42" : "#ddd", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: on ? 17 : 3, transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} />
                            </button>
                          </td>;
                        })}
                      </tr>
                    ))
                  ];
                })}
              </tbody>
            </table>
            <button onClick={async () => { await ap("/api/admin/system", { key: "role_tabs", value: roleTabs }); alert("✅ 權限已儲存，重新登入後生效"); }}
              style={{ marginTop: 8, width: "100%", padding: 8, borderRadius: 6, border: "none", background: "#0a7c42", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              💾 儲存權限設定
            </button>
          </div>
        )}
      </div>

      {/* 備份管理 */}
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>💾 資料備份</h4>
        <div style={{ fontSize: 10, color: "#888", marginBottom: 8 }}>每日凌晨 Cron 自動備份到 Storage，保留 30 天。也可手動備份或下載。</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
          <button onClick={async () => {
            setBackupLoading(true);
            const r = await ap("/api/admin/backup", { action: "backup" });
            setBackupLoading(false);
            if (r.success) alert("✅ 備份完成\n\n" + r.total_records + " 筆資料 / " + r.size_kb + " KB\n存放：Storage/backups/" + r.date + ".json");
            else alert("❌ " + (r.error || "備份失敗"));
          }} disabled={backupLoading}
            style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: backupLoading ? "#ccc" : "#0a7c42", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            {backupLoading ? "⏳ 備份中..." : "💾 立即備份"}
          </button>
          <a href="/api/admin/backup?action=download" target="_blank" rel="noopener"
            style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #4361ee", background: "#fff", color: "#4361ee", fontSize: 11, fontWeight: 600, cursor: "pointer", textDecoration: "none" }}>
            📥 下載完整 JSON
          </a>
          <button onClick={async () => {
            const r = await ap("/api/admin/backup?action=list");
            setBackups(r.data || []);
          }} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", fontSize: 11, cursor: "pointer" }}>
            📋 查看備份紀錄
          </button>
        </div>
        {backups.length > 0 && (
          <div style={{ maxHeight: 200, overflow: "auto", border: "1px solid #f0eeea", borderRadius: 6 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
              <thead><tr style={{ background: "#faf8f5" }}>
                <th style={{ padding: 4, textAlign: "left", color: "#666" }}>日期</th>
                <th style={{ padding: 4, textAlign: "right", color: "#666" }}>大小</th>
              </tr></thead>
              <tbody>{backups.map((b, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f0eeea" }}>
                  <td style={{ padding: 4 }}>{b.name?.replace(".json", "")}</td>
                  <td style={{ padding: 4, textAlign: "right", color: "#888" }}>{b.metadata?.size ? Math.round(b.metadata.size / 1024) + " KB" : "-"}</td>
                </tr>
              ))}</tbody>
            </table>
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

export function BonusFormulaEditor() {
  const [bf, setBf] = useState(null);
  const [saving, setSaving] = useState(false);
  const defaults = {
    min_rate: 85, full_rate: 100, super_rate: 120, super_multiplier: 1.2,
    review_full: 80, review_half: 70,
    manager_weight: 1.2, staff_weight: 1.0,
    att_score: 30, perf_score: 30, svc_score: 20, viol_score: 20,
    late_deduct: 3, absent_deduct: 10, complaint_deduct: 5,
    comp_convert_rate: 1.34,
  };
  useEffect(() => {
    ap("/api/admin/system?key=bonus_formula").then(r => setBf(r.data || defaults)).catch(() => setBf(defaults));
  }, []);
  if (!bf) return null;
  const upd = (k, v) => setBf({ ...bf, [k]: Number(v) });
  const save = async () => {
    setSaving(true);
    await ap("/api/admin/system", { key: "bonus_formula", value: bf });
    setSaving(false); alert("獎金公式已儲存");
  };
  const R = ({ label, k, unit }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #f5f5f5" }}>
      <span style={{ fontSize: 11 }}>{label}</span>
      <div>
        <input type="number" value={bf[k]} onChange={e => upd(k, e.target.value)}
          style={{ width: 60, padding: 2, borderRadius: 4, border: "1px solid #ddd", fontSize: 11, textAlign: "right" }} />
        <span style={{ fontSize: 10, color: "#888", marginLeft: 4 }}>{unit || ""}</span>
      </div>
    </div>
  );
  return (
    <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 12 }}>
      <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>🏆 獎金計算公式設定</h4>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 4 }}>📊 達標率門檻</div>
        <R label="最低發放門檻" k="min_rate" unit="%" />
        <R label="全額發放門檻" k="full_rate" unit="%" />
        <R label="加成發放門檻" k="super_rate" unit="%" />
        <R label="加成倍率" k="super_multiplier" unit="×" />
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 4 }}>📝 考核分數門檻</div>
        <R label="全額發放門檻" k="review_full" unit="分" />
        <R label="半額發放門檻" k="review_half" unit="分" />
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 4 }}>⚖️ 職務加權</div>
        <R label="主管加權" k="manager_weight" unit="×" />
        <R label="一般員工" k="staff_weight" unit="×" />
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 4 }}>📋 考核配分</div>
        <R label="出勤紀律" k="att_score" unit="分" />
        <R label="工作完成度" k="perf_score" unit="分" />
        <R label="服務態度" k="svc_score" unit="分" />
        <R label="違規紀錄" k="viol_score" unit="分" />
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 4 }}>🔢 扣分標準</div>
        <R label="遲到每次扣" k="late_deduct" unit="分" />
        <R label="曠職每次扣" k="absent_deduct" unit="分" />
        <R label="客訴每筆扣" k="complaint_deduct" unit="分" />
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 4 }}>💰 補休轉現金</div>
        <R label="加班費倍率" k="comp_convert_rate" unit="×時薪" />
      </div>
      <button onClick={save} disabled={saving}
        style={{ width: "100%", padding: "8px", borderRadius: 6, border: "none", background: saving ? "#ccc" : "#0a7c42", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
        {saving ? "儲存中..." : "💾 儲存公式設定"}
      </button>
    </div>
  );
}

export function WorklogSettings({ stores }) {
  const [wlStore, setWlStore] = useState("");
  const [wlTemplates, setWlTemplates] = useState([]);
  const [wlCopyTarget, setWlCopyTarget] = useState("");
  const [wlNew, setWlNew] = useState({ category: "清潔", item: "", role: "all", checkpoints: [], frequency: "daily", weekday: "", requires_value: false, value_label: "" });
  const loadT = () => { if (!wlStore) return; ap("/api/admin/worklogs?type=templates&store_id=" + wlStore).then(r => setWlTemplates(r.data || [])); };
  useEffect(() => { loadT(); }, [wlStore]);

  const WL_CATS = ["清潔", "食材管理", "溫度記錄", "設備維護", "服務品質", "結算", "回報", "其他"];
  const store = stores.find(s => s.id === wlStore);
  const isDouble = store?.shift_mode === "double";
  const CPS = isDouble
    ? [{ id: "morning_start", l: "🌅早上" }, { id: "morning_end", l: "🌤早下" }, { id: "evening_start", l: "🌇晚上" }, { id: "evening_end", l: "🌙晚下" }]
    : [{ id: "opening", l: "☀️開店" }, { id: "during", l: "🔥營業" }, { id: "closing", l: "🌙閉店" }];

  const getCps = (t) => (Array.isArray(t.checkpoints) && t.checkpoints.length > 0) ? t.checkpoints : (t.shift_type ? [t.shift_type] : []);
  const toggleTplCp = async (t, cp) => {
    const cur = new Set(getCps(t));
    if (cur.has(cp)) cur.delete(cp); else cur.add(cp);
    const arr = [...cur];
    await ap("/api/admin/worklogs", { action: "update_template", template_id: t.id, checkpoints: arr });
    loadT();
  };
  const addNew = async () => {
    if (!wlNew.item) return;
    const payload = { action: "add_template", store_id: wlStore, ...wlNew };
    if (wlNew.frequency !== "daily") payload.checkpoints = null;
    else if (wlNew.checkpoints.length === 0) { alert("請至少勾選一個時段"); return; }
    const r = await ap("/api/admin/worklogs", payload);
    if (r.error) { alert("新增失敗：" + r.error); return; }
    setWlNew({ ...wlNew, item: "", requires_value: false, value_label: "" });
    loadT();
  };

  const dailyTpls = wlTemplates.filter(t => t.frequency === "daily").sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const deepTpls = wlTemplates.filter(t => t.frequency === "weekly" || t.frequency === "monthly");
  const byCat = {};
  for (const t of dailyTpls) { const c = t.category || "其他"; (byCat[c] ||= []).push(t); }

  return (
    <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginTop: 12 }}>
      <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>📋 工作日誌模板設定（矩陣編輯器）</h4>
      <select value={wlStore} onChange={e => setWlStore(e.target.value)} style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12, marginBottom: 10, width: "100%" }}>
        <option value="">選擇門市</option>
        {stores.map(s => <option key={s.id} value={s.id}>{s.name + (s.shift_mode === "double" ? "（雙班）" : "")}</option>)}
      </select>
      {wlStore && <div>
        <div style={{ fontSize: 10, color: "#888", marginBottom: 6 }}>
          {isDouble ? "雙班模式：早班/晚班各自打勾，矩陣中打勾的時段該班需做" : "單班模式：勾選該項目出現在開店/營業/閉店哪個時段"}
        </div>

        {/* 矩陣表格 */}
        <div style={{ overflowX: "auto", marginBottom: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "#faf8f5" }}>
                <th style={{ padding: "6px 4px", textAlign: "left", borderBottom: "2px solid #e8e6e1", minWidth: 180 }}>工作項目</th>
                {CPS.map(c => <th key={c.id} style={{ padding: "6px 4px", textAlign: "center", borderBottom: "2px solid #e8e6e1", minWidth: 56 }}>{c.l}</th>)}
                <th style={{ padding: "6px 4px", borderBottom: "2px solid #e8e6e1", width: 30 }}></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byCat).map(([cat, list]) => (
                <React.Fragment key={cat}>
                  <tr><td colSpan={CPS.length + 2} style={{ padding: "6px 4px", fontSize: 10, fontWeight: 600, color: "#888", background: "#f5f1eb" }}>{cat}</td></tr>
                  {list.map(t => {
                    const cps = new Set(getCps(t));
                    return (<tr key={t.id} style={{ borderBottom: "1px solid #f0eeea" }}>
                      <td style={{ padding: "4px" }}>
                        <div style={{ fontSize: 12 }}>{t.item}</div>
                        {t.requires_value && <span style={{ fontSize: 8, background: "#e6f9f0", color: "#0a7c42", padding: "0 4px", borderRadius: 3, marginRight: 4 }}>{"📊" + (t.value_label || "")}</span>}
                        {t.role !== "all" && <span style={{ fontSize: 8, background: "#fef9c3", color: "#8a6d00", padding: "0 4px", borderRadius: 3 }}>{t.role}</span>}
                      </td>
                      {CPS.map(c => (
                        <td key={c.id} style={{ padding: "4px", textAlign: "center" }}>
                          <button onClick={() => toggleTplCp(t, c.id)} style={{ width: 26, height: 26, borderRadius: 6, border: cps.has(c.id) ? "none" : "1px solid #ddd", background: cps.has(c.id) ? "#0a7c42" : "#fff", color: cps.has(c.id) ? "#fff" : "#ccc", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>{cps.has(c.id) ? "✓" : ""}</button>
                        </td>
                      ))}
                      <td style={{ textAlign: "center" }}><button onClick={async () => { if (!confirm("刪除？")) return; await ap("/api/admin/worklogs", { action: "delete_template", template_id: t.id }); loadT(); }} style={{ fontSize: 12, color: "#b91c1c", background: "none", border: "none", cursor: "pointer" }}>✕</button></td>
                    </tr>);
                  })}
                </React.Fragment>
              ))}
              {dailyTpls.length === 0 && <tr><td colSpan={CPS.length + 2} style={{ padding: 16, textAlign: "center", color: "#ccc" }}>尚無工作項目</td></tr>}
            </tbody>
          </table>
        </div>

        {/* 細部清潔（週/月） */}
        {deepTpls.length > 0 && <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#444", marginBottom: 4 }}>{"🧹 細部清潔（" + deepTpls.length + "）"}</div>
          <div style={{ background: "#faf8f5", borderRadius: 6 }}>
            {deepTpls.map(t => <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 8px", borderBottom: "1px solid #f0eeea", fontSize: 11 }}>
              <span style={{ fontSize: 9, padding: "0 4px", borderRadius: 3, background: t.frequency === "weekly" ? "#e6f1fb" : "#fde8e8", color: t.frequency === "weekly" ? "#185fa5" : "#b91c1c" }}>{t.frequency === "weekly" ? "週" : "月"}</span>
              <span style={{ flex: 1, fontWeight: 500 }}>{t.item}</span>
              <span style={{ fontSize: 9, color: "#888" }}>{t.category}</span>
              <button onClick={async () => { if (!confirm("刪除？")) return; await ap("/api/admin/worklogs", { action: "delete_template", template_id: t.id }); loadT(); }} style={{ fontSize: 12, color: "#b91c1c", background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>)}
          </div>
        </div>}

        {/* 新增區塊 */}
        <div style={{ background: "#faf8f5", borderRadius: 8, padding: 10, marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>＋ 新增工作項目</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
            <select value={wlNew.frequency} onChange={e => setWlNew({ ...wlNew, frequency: e.target.value, checkpoints: [] })} style={{ padding: 4, borderRadius: 6, border: "1px solid #ddd", fontSize: 11 }}>
              <option value="daily">每日</option><option value="weekly">每週（細部）</option><option value="monthly">每月（細部）</option>
            </select>
            {wlNew.frequency === "weekly" && <select value={wlNew.weekday} onChange={e => setWlNew({ ...wlNew, weekday: e.target.value })} style={{ padding: 4, borderRadius: 6, border: "1px solid #ddd", fontSize: 11 }}><option value="">不指定週幾</option>{["日","一","二","三","四","五","六"].map((d,i) => <option key={i} value={i}>{"週" + d}</option>)}</select>}
            <select value={wlNew.category} onChange={e => setWlNew({ ...wlNew, category: e.target.value })} style={{ padding: 4, borderRadius: 6, border: "1px solid #ddd", fontSize: 11 }}>
              {WL_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={wlNew.role} onChange={e => setWlNew({ ...wlNew, role: e.target.value })} style={{ padding: 4, borderRadius: 6, border: "1px solid #ddd", fontSize: 11 }}><option value="all">全員</option><option value="外場">外場</option><option value="內場">內場</option><option value="吧台">吧台</option><option value="烘焙">烘焙</option></select>
          </div>
          {wlNew.frequency === "daily" && <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "#666", alignSelf: "center", marginRight: 4 }}>時段：</span>
            {CPS.map(c => {
              const on = wlNew.checkpoints.includes(c.id);
              return <button key={c.id} onClick={() => setWlNew({ ...wlNew, checkpoints: on ? wlNew.checkpoints.filter(x => x !== c.id) : [...wlNew.checkpoints, c.id] })}
                style={{ padding: "3px 8px", borderRadius: 6, border: on ? "none" : "1px solid #ddd", background: on ? "#0a7c42" : "#fff", color: on ? "#fff" : "#666", fontSize: 11, cursor: "pointer" }}>{c.l}</button>;
            })}
          </div>}
          <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
            <input value={wlNew.item} onChange={e => setWlNew({ ...wlNew, item: e.target.value })} placeholder="工作項目名稱" onKeyDown={e => { if (e.key === "Enter") addNew(); }} style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12 }} />
            <button onClick={addNew} disabled={!wlNew.item} style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: wlNew.item ? "#0a7c42" : "#ccc", color: "#fff", fontSize: 12, cursor: "pointer" }}>新增</button>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={wlNew.requires_value} onChange={e => setWlNew({ ...wlNew, requires_value: e.target.checked })} />需輸入數值
            {wlNew.requires_value && <input value={wlNew.value_label} onChange={e => setWlNew({ ...wlNew, value_label: e.target.value })} placeholder="單位" style={{ width: 60, padding: 2, borderRadius: 3, border: "1px solid #ddd", fontSize: 10, marginLeft: 4 }} />}
          </label>
        </div>
        {wlTemplates.length > 0 && <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
          <select value={wlCopyTarget} onChange={e => setWlCopyTarget(e.target.value)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 11 }}><option value="">複製到門市...</option>{stores.filter(s => s.id !== wlStore).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <button onClick={async () => { if (!wlCopyTarget) return; await ap("/api/admin/worklogs", { action: "copy_to_store", from_store_id: wlStore, to_store_id: wlCopyTarget }); alert("已複製"); }} disabled={!wlCopyTarget} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: wlCopyTarget ? "#4361ee" : "#ccc", color: "#fff", fontSize: 11, cursor: "pointer" }}>📋 複製</button>
        </div>}
      </div>}
    </div>
  );
}
