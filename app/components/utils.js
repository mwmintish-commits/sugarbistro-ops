"use client";

export function ap(u, b) {
  const req = b
    ? fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })
    : fetch(u);
  return req.then(async r => {
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("json")) { const t = await r.text().catch(() => ""); return { error: t || "伺服器錯誤（非 JSON）" }; }
    const text = await r.text().catch(() => "");
    if (!text || !text.trim()) return { error: "伺服器回傳空白" };
    try { return JSON.parse(text); } catch(e) { return { error: "回傳格式錯誤" }; }
  }).catch(e => ({ error: e.message || "連線失敗" }));
}

// 安全呼叫：失敗時 alert 錯誤
export async function sap(u, b) {
  try {
    const r = await ap(u, b);
    if (!r || r.error) { alert("❌ " + (r?.error || "未知錯誤")); return null; }
    return r;
  } catch (e) { alert("❌ " + (e.message || "連線失敗")); return null; }
}

export const fmt = (n) => "$" + Number(n || 0).toLocaleString();

// 工作日誌分類：依品項名稱關鍵字優先順序歸類（不依賴 DB 的舊 category）
export const WL_CATS = ["🧹 清潔", "⚙️ 設備檢查", "🍰 備料", "💰 財務", "📋 行政交接", "🛒 庫存補貨", "其他"];
export function wlCategory(item, fallbackCategory) {
  // 若 DB 已是新分類，直接回傳
  if (fallbackCategory && WL_CATS.includes(fallbackCategory)) return fallbackCategory;
  const s = String(item || "");
  if (/結帳|收銀|日結|存款|發票|找零|現金|對帳|入帳|押金/.test(s)) return "💰 財務";
  if (/報到|交接|儀容|服裝|簽到|簽退|班表|回報|公告|通知|站位|早會|晚會/.test(s)) return "📋 行政交接";
  if (/盤點|叫貨|進貨|訂貨|庫存|補貨|月結|單據/.test(s)) return "🛒 庫存補貨";
  if (/備料|食材|解凍|裝盤|烘焙|麵糊|糖漿|鮮奶|奶油|麵包|蛋糕|甜點|餅乾|泡芙|冰塊|儲冰/.test(s)) return "🍰 備料";
  if (/清潔|擦拭|擦|清洗|抹布|拖地|洗淨|掃|垃圾|回收|廚餘|清空|消毒|定位/.test(s)) return "🧹 清潔";
  if (/開機|關機|開\/關|機|燈|POS|iPad|電視|音樂|閨蜜|空調|冷氣|溫度|電源|檢查|蒸氣|咖啡機|磨豆|奶泡|氣炸|烤箱|冰箱|冷藏|冷凍|展示櫃/.test(s)) return "⚙️ 設備檢查";
  return "其他";
}

export const ROLES = {
  admin: "👑總部", manager: "🏠管理",
  store_manager: "🏪門店主管", staff: "👤員工"
};

export const LT = {
  advance: { l: "預假", c: "var(--warning)", bg: "var(--warning-bg)" },
  holiday_comp: { l: "國定補假", c: "var(--danger)", bg: "var(--danger-bg)" },
  annual: { l: "特休", c: "var(--brand-strong)", bg: "var(--info-bg)" },
  sick: { l: "病假", c: "var(--warning)", bg: "var(--warning-bg)" },
  personal: { l: "事假", c: "var(--warning)", bg: "var(--warning-bg)" },
  menstrual: { l: "生理假", c: "#993556", bg: "#fbeaf0" },
  off: { l: "⬛ 例假", c: "var(--text)", bg: "#e0e0e0" },
  rest: { l: "🔲 休息日", c: "var(--text-2)", bg: "#e8e8e8" },
  comp_time: { l: "補休", c: "var(--info)", bg: "var(--info-bg)" },
  marriage: { l: "婚假", c: "var(--warning)", bg: "var(--warning-bg)" },
  funeral: { l: "喪假", c: "var(--text-2)", bg: "#e8e8e8" },
  paternity: { l: "陪產假", c: "var(--info)", bg: "var(--info-bg)" },
  maternity: { l: "產假", c: "#993556", bg: "#fbeaf0" },
  family_care: { l: "家庭照顧", c: "var(--warning)", bg: "var(--warning-bg)" },
  official: { l: "公假", c: "var(--text-2)", bg: "#f0f0f0" },
  work_injury: { l: "公傷假", c: "var(--danger)", bg: "var(--danger-bg)" }
};

export function Badge({ status }) {
  const m = {
    draft: { bg: "#f3f4f6", c: "#6b7280" },
    matched: { bg: "var(--success-bg)", c: "var(--success)" },
    pending: { bg: "var(--warning-bg)", c: "var(--warning)" },
    approved: { bg: "var(--success-bg)", c: "var(--success)" },
    rejected: { bg: "var(--danger-bg)", c: "var(--danger)" },
    anomaly: { bg: "var(--danger-bg)", c: "var(--danger)" },
    planned: { bg: "var(--info-bg)", c: "var(--info)" },
    in_progress: { bg: "var(--warning-bg)", c: "var(--warning)" },
    completed: { bg: "var(--success-bg)", c: "var(--success)" },
    confirmed: { bg: "var(--info-bg)", c: "var(--info)" },
    shipped: { bg: "var(--warning-bg)", c: "var(--warning)" },
    delivered: { bg: "var(--success-bg)", c: "var(--success)" },
    paid: { bg: "var(--success-bg)", c: "var(--success)" },
    unpaid: { bg: "var(--danger-bg)", c: "var(--danger)" },
  };
  const s = m[status] || { bg: "#f0f0f0", c: "var(--text-2)" };
  return (
    <span style={{
      padding: "2px 6px", borderRadius: 8,
      fontSize: 10, background: s.bg, color: s.c
    }}>
      {status}
    </span>
  );
}

export function RB({ role }) {
  const c = {
    admin: { bg: "var(--danger-bg)", c: "var(--danger)" },
    manager: { bg: "var(--info-bg)", c: "var(--info)" },
    store_manager: { bg: "var(--warning-bg)", c: "var(--warning)" },
    staff: { bg: "var(--success-bg)", c: "var(--success)" }
  };
  const s = c[role] || c.staff;
  return (
    <span style={{
      padding: "1px 5px", borderRadius: 5,
      fontSize: 9, background: s.bg, color: s.c
    }}>
      {ROLES[role] || role}
    </span>
  );
}

export function Row({ l, v }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      alignItems: "center", padding: "4px 0", fontSize: 12
    }}>
      <span style={{ color: "var(--text-3)" }}>{l}</span>
      <span>{v || "-"}</span>
    </div>
  );
}

export const TIERS_R = [
  [1,"29,500"],[2,"29,501~30,300"],[3,"30,301~31,800"],
  [4,"31,801~33,300"],[5,"33,301~34,800"],[6,"34,801~36,300"],
  [7,"36,301~38,200"],[8,"38,201~40,100"],[9,"40,101~42,000"],
  [10,"42,001~43,900"],[11,"43,901~45,800"],
  [12,"45,801~48,200"],[13,"48,201~50,600"],[14,"50,601~53,000"],
  [15,"53,001~55,400"],[16,"55,401~57,800"],[17,"57,801~60,800"],
  [18,"60,801~63,800"],[19,"63,801~66,800"],[20,"66,801~69,800"]
];

export const TIERS_P = [
  [1,"~11,100"],[2,"11,101~12,540"],[3,"12,541~13,500"],
  [4,"13,501~15,840"],[5,"15,841~16,500"],[6,"16,501~17,280"],
  [7,"17,281~17,880"],[8,"17,881~19,047"],[9,"19,048~20,008"],
  [10,"20,009~21,009"],[11,"21,010~22,000"],[12,"22,001~23,100"],
  [13,"23,101~24,000"],[14,"24,001~25,250"],[15,"25,251~26,400"],
  [16,"26,401~27,600"],[17,"27,601~28,590"],[18,"28,591~29,500"],
  [19,"29,501~30,300"],[20,"30,301~31,800"]
];

export function tierLabel(i, r) {
  return "第" + i + "級（$" + r + "）";
}

// 勞健保投保級距（2026年/民國115年，含本人自付額）
// 級距：[投保薪資, 勞保自付, 健保自付(本人)]
export const INSURANCE_TIERS = [
  [29500, 738, 458],  // 1 健保最低級距
  [30300, 758, 470],  // 2
  [31800, 795, 493],  // 3
  [33300, 833, 516],  // 4
  [34800, 870, 540],  // 5
  [36300, 908, 563],  // 6
  [38200, 955, 592],  // 7
  [40100, 1002, 622], // 8
  [42000, 1050, 651], // 9
  [43900, 1098, 681], // 10
  [45800, 1145, 710], // 11 勞保最高級距
  [48200, 1145, 748], // 12
  [50600, 1145, 785], // 13
  [53000, 1145, 822], // 14
  [55400, 1145, 859], // 15
  [57800, 1145, 896], // 16
  [60800, 1145, 943], // 17
  [63800, 1145, 990], // 18
  [66800, 1145, 1036],// 19
  [69800, 1145, 1083],// 20
];
export const LABOR_SELF = INSURANCE_TIERS.map(t => t[1]);
export const HEALTH_SELF = INSURANCE_TIERS.map(t => t[2]);

// 兼職（部分工時）勞保投保級距（2026年/民國115年）
// ⚠️ 健保不在此表 — 台灣健保最低 = 基本工資（約 28,590），兼職若由本公司加保也用正職最低級起算；
//    若兼職員工另有加保（配偶/家屬/他司），本公司不替其加保健保。
export const INSURANCE_TIERS_PT = [
  [11100, 278],   // 1
  [12540, 314],   // 2
  [13500, 338],   // 3
  [15840, 397],   // 4
  [16500, 414],   // 5
  [17280, 433],   // 6
  [17880, 448],   // 7
  [19047, 478],   // 8
  [20008, 502],   // 9
  [21009, 527],   // 10
  [22000, 552],   // 11
  [23100, 579],   // 12
  [24000, 602],   // 13
  [25250, 633],   // 14
  [26400, 662],   // 15
  [27600, 692],   // 16
  [28590, 717],   // 17 基本工資邊界
  [29500, 738],   // 18 接上正職最低級距
  [30300, 758],   // 19
  [31800, 795],   // 20
];
export const LABOR_SELF_PT = INSURANCE_TIERS_PT.map(t => t[1]);

// 統一介面：依員工狀態挑出真實自付額
// 1. 若員工有 labor_self_override / health_self_override 手動覆寫 → 直接用該值（事務所核定為準）
// 2. 勞保：兼職用 PT 表，正職用正職表
// 3. 健保：一律用正職表（健保無兼職低級距）；若 employment_type=parttime AND health_insured_here=false → 自付 0
export function pickLaborSelf(emp) {
  if (!emp) return 0;
  const o = emp.labor_self_override;
  if (o != null && o !== "" && !isNaN(Number(o))) return Number(o);
  const tier = emp.labor_tier;
  if (!tier) return 0;
  const isPT = emp.employment_type === "parttime";
  return (isPT ? LABOR_SELF_PT : LABOR_SELF)[tier - 1] || 0;
}
export function pickHealthSelf(emp) {
  if (!emp) return 0;
  const o = emp.health_self_override;
  if (o != null && o !== "" && !isNaN(Number(o))) return Number(o);
  if (emp.employment_type === "parttime" && emp.health_insured_here === false) return 0;
  const tier = emp.health_tier;
  if (!tier) return 0;
  return HEALTH_SELF[tier - 1] || 0;
}
