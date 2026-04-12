"use client";

export function ap(u, b) {
  return b
    ? fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json())
    : fetch(u).then(r => r.json());
}

export const fmt = (n) => "$" + Number(n || 0).toLocaleString();

export const ROLES = {
  admin: "👑總部", manager: "🏠管理",
  store_manager: "🏪門店主管", staff: "👤員工"
};

export const LT = {
  annual: { l: "特休", c: "#4361ee", bg: "#e6f1fb" },
  sick: { l: "病假", c: "#b45309", bg: "#fff8e6" },
  personal: { l: "事假", c: "#8a6d00", bg: "#fef9c3" },
  menstrual: { l: "生理假", c: "#993556", bg: "#fbeaf0" },
  off: { l: "例假", c: "#666", bg: "#f0f0f0" },
  rest: { l: "休息日", c: "#888", bg: "#f5f5f5" },
  comp_time: { l: "補休", c: "#185fa5", bg: "#e6f1fb" },
  marriage: { l: "婚假", c: "#b45309", bg: "#fff8e6" },
  funeral: { l: "喪假", c: "#555", bg: "#e8e8e8" },
  paternity: { l: "陪產假", c: "#185fa5", bg: "#e6f1fb" },
  maternity: { l: "產假", c: "#993556", bg: "#fbeaf0" },
  family_care: { l: "家庭照顧", c: "#8a6d00", bg: "#fef9c3" },
  official: { l: "公假", c: "#666", bg: "#f0f0f0" },
  work_injury: { l: "公傷假", c: "#b91c1c", bg: "#fde8e8" }
};

export function Badge({ status }) {
  const m = {
    matched: { bg: "#e6f9f0", c: "#0a7c42" },
    pending: { bg: "#fff8e6", c: "#8a6d00" },
    approved: { bg: "#e6f9f0", c: "#0a7c42" },
    rejected: { bg: "#fde8e8", c: "#b91c1c" },
    anomaly: { bg: "#fde8e8", c: "#b91c1c" },
    planned: { bg: "#e6f1fb", c: "#185fa5" },
    in_progress: { bg: "#fff8e6", c: "#8a6d00" },
    completed: { bg: "#e6f9f0", c: "#0a7c42" },
    confirmed: { bg: "#e6f1fb", c: "#185fa5" },
    shipped: { bg: "#fff8e6", c: "#8a6d00" },
    delivered: { bg: "#e6f9f0", c: "#0a7c42" },
    paid: { bg: "#e6f9f0", c: "#0a7c42" },
    unpaid: { bg: "#fde8e8", c: "#b91c1c" },
  };
  const s = m[status] || { bg: "#f0f0f0", c: "#666" };
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
    admin: { bg: "#fde8e8", c: "#b91c1c" },
    manager: { bg: "#e6f1fb", c: "#185fa5" },
    store_manager: { bg: "#fef9c3", c: "#8a6d00" },
    staff: { bg: "#e6f9f0", c: "#0a7c42" }
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
      <span style={{ color: "#888" }}>{l}</span>
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
  [13,"23,101~24,000"],[14,"24,001~25,200"],[15,"25,201~26,400"],
  [16,"26,401~27,600"],[17,"27,601~28,800"],[18,"28,801~30,300"],
  [19,"30,301~31,800"],[20,"31,801~33,300"]
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
