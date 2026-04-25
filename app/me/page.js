"use client";
import { useEffect, useState } from "react";

const webUrl = (path, eid) => `${path}?eid=${eid}`;

const uploadUrl = (expenseType, emp, eid) => {
  const params = new URLSearchParams({
    type: "expense",
    expense_type: expenseType,
    store_id: emp?.store_id || "",
    store_name: emp?.stores?.name || "",
    employee_id: eid || "",
    employee_name: emp?.name || "",
  });
  return `/upload?${params.toString()}`;
};

const worklogUrl = (emp, eid) => {
  const params = new URLSearchParams({
    eid: eid || "",
    sid: emp?.store_id || "",
    name: emp?.name || "",
  });
  return `/worklog?${params.toString()}`;
};

const ITEMS = (eid, emp) => {
  const isManager = ["admin", "manager", "store_manager"].includes(emp?.role);
  const base = [
    { icon: "🟢", label: "上班打卡", desc: "GPS 定位", action: "clockin", type: "clock_in", bg: "#e6f9f0", color: "#0a7c42" },
    { icon: "🔴", label: "下班打卡", desc: "GPS 定位", action: "clockin", type: "clock_out", bg: "#fde8e8", color: "#b91c1c" },
    { icon: "🕐", label: "補打卡",   desc: "申請補登",    href: webUrl("/amendment", eid),      bg: "#fff8e6", color: "#8a6d00" },
    { icon: "🏖", label: "我要請假", desc: "事假/特休...", href: webUrl("/leave-apply", eid),    bg: "#e6f1fb", color: "#185fa5" },
    { icon: "📋", label: "預排假",   desc: "不可出勤回報", href: webUrl("/pre-leave", eid),      bg: "#e8eaf6", color: "#1a237e" },
    { icon: "📅", label: "我的班表", desc: "近期排班",    href: webUrl("/my-schedule", eid),    bg: "#f3e8ff", color: "#6b21a8" },
    { icon: "📊", label: "我的假勤", desc: "出勤統計",    href: webUrl("/my-attendance", eid),  bg: "#fef3c7", color: "#92400e" },
    { icon: "💰", label: "我的薪資", desc: "薪資明細",    href: webUrl("/my-salary", eid),      bg: "#fef3c7", color: "#a16207" },
    { icon: "📝", label: "我的考核", desc: "績效分數",    href: webUrl("/my-review", eid),      bg: "#e8f5e9", color: "#1b5e20" },
    { icon: "📋", label: "工作日誌", desc: "每日任務回報", href: worklogUrl(emp, eid),          bg: "#e0f2fe", color: "#075985" },
    { icon: "📖", label: "員工手冊", desc: "守則 + 獎金福利",    href: webUrl("/employee-handbook", eid), bg: "#fce4ec", color: "#880e4f" },
  ];
  if (isManager) {
    base.push(
      { icon: "📦", label: "月結單據", desc: "廠商單據上傳", href: uploadUrl("vendor", emp, eid),      bg: "#dbeafe", color: "#1d4ed8" },
      { icon: "🪙", label: "零用金",   desc: "費用收據上傳", href: uploadUrl("petty_cash", emp, eid),  bg: "#fef9c3", color: "#854d0e" },
      { icon: "🖥", label: "後台",     desc: "管理系統",     href: "/",                                bg: "#f3e8ff", color: "#6b21a8" },
    );
  }
  return base;
};

export default function MePanel() {
  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [clockinLoading, setClockinLoading] = useState("");

  const eid = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("eid") : null;

  useEffect(() => {
    if (!eid) { setErr("缺少員工識別碼"); setLoading(false); return; }
    fetch("/api/admin/employees?id=" + eid)
      .then(r => r.json())
      .then(r => {
        if (r.error || !r.data) { setErr("找不到員工資料"); setLoading(false); return; }
        setEmp(r.data); setLoading(false);
      })
      .catch(() => { setErr("載入失敗"); setLoading(false); });
  }, []);

  const handleClockin = async (type) => {
    setClockinLoading(type);
    try {
      const r = await fetch("/api/clockin/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: eid, type }),
      }).then(r => r.json());
      if (r.error) { alert("❌ " + r.error); setClockinLoading(""); return; }
      window.location.href = r.url;
    } catch (e) {
      alert("❌ 連線失敗"); setClockinLoading("");
    }
  };

  const wrap = { maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "system-ui, 'Noto Sans TC', sans-serif", background: "#f7f5f0", minHeight: "100vh" };

  if (loading) return <div style={wrap}><p style={{ textAlign: "center", color: "#888", padding: 60 }}>載入中...</p></div>;
  if (err)     return <div style={wrap}><p style={{ textAlign: "center", color: "#b91c1c", padding: 60 }}>{err}</p></div>;

  const items = ITEMS(eid || "", emp);
  const roleLabel = { admin: "總部管理員", manager: "區經理", store_manager: "店長", staff: "員工" }[emp?.role] || emp?.role;
  const now = new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Taipei" });

  return (
    <div style={wrap}>
      <div style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)", borderRadius: 16, padding: "20px 18px", marginBottom: 14, color: "#fff", boxShadow: "0 2px 8px rgba(245,158,11,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>🍯 小食糖員工面板</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{emp?.name}</div>
            <div style={{ fontSize: 12, marginTop: 4, opacity: 0.92 }}>{roleLabel}　·　{emp?.stores?.name || "🏢 總部"}</div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, opacity: 0.9 }}>{now}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {items.map((it, i) => {
          const isClockAction = it.action === "clockin";
          const isLoading = clockinLoading === it.type;
          return (
            <button key={i}
              onClick={() => isClockAction ? handleClockin(it.type) : (window.location.href = it.href)}
              disabled={isLoading}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                background: "#fff", borderRadius: 14, padding: "16px 6px",
                border: "1px solid #e8e6e1", boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                minHeight: 96, cursor: isLoading ? "wait" : "pointer", opacity: isLoading ? 0.6 : 1,
              }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: it.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 6 }}>
                {isLoading ? "⏳" : it.icon}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#222" }}>{isLoading ? "處理中..." : it.label}</div>
              <div style={{ fontSize: 9, color: "#888", marginTop: 2 }}>{it.desc}</div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 18, textAlign: "center", fontSize: 11, color: "#888" }}>
        打卡/補打卡/請假/班表/薪資 在網頁內完成，不消耗 LINE 訊息
      </div>
    </div>
  );
}
