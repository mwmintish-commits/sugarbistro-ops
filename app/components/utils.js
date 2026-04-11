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
  rest: { l: "休息日", c: "#888", bg: "#f5f5f5" }
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
  [1,"27,470"],[2,"27,471~28,800"],[3,"28,801~30,300"],
  [4,"30,301~31,800"],[5,"31,801~33,300"],[6,"33,301~34,800"],
  [7,"34,801~36,300"],[8,"36,301~38,200"],[9,"38,201~40,100"],
  [10,"40,101~42,000"],[11,"42,001~43,900"],[12,"43,901~45,800"]
];

export const TIERS_P = [
  [1,"~11,100"],[2,"11,101~12,540"],[3,"12,541~13,500"],
  [4,"13,501~15,840"],[5,"15,841~16,500"],[6,"16,501~17,280"],
  [7,"17,281~17,880"],[8,"17,881~19,047"],[9,"19,048~20,008"],
  [10,"20,009~21,009"],[11,"21,010~22,000"],[12,"22,001~23,100"]
];

export function tierLabel(i, r) {
  return "第" + i + "級（$" + r + "）";
}

export const LABOR_SELF = [690,723,761,799,836,874,912,959,1007,1055,1103,1150];
export const HEALTH_SELF = [438,459,483,507,531,555,579,609,640,670,700,730];
