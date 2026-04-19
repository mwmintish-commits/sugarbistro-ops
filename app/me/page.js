"use client";
import { useEffect, useState } from "react";

const LINE_ID = "@766urtjk";
const oaUrl = (text) => `https://line.me/R/oaMessage/${LINE_ID}/?${encodeURIComponent(text)}`;

// eid 動態帶入各頁面 URL
const webUrl = (path, eid) => `${path}?eid=${eid}`;

const ITEMS = (eid) => [
  { icon: "🟢", label: "上班打卡", desc: "GPS 定位", href: oaUrl("上班打卡"), bg: "#e6f9f0", color: "#0a7c42" },
  { icon: "🔴", label: "下班打卡", desc: "GPS 定位", href: oaUrl("下班打卡"), bg: "#fde8e8", color: "#b91c1c" },
  { icon: "🕐", label: "補打卡", desc: "申請補登", href: webUrl("/amendment", eid), bg: "#fff8e6", color: "#8a6d00" },
  { icon: "🏖", label: "我要請假", desc: "事假/特休...", href: webUrl("/leave-apply", eid), bg: "#e6f1fb", color: "#185fa5" },
  { icon: "📅", label: "我的班表", desc: "近期排班", href: webUrl("/my-schedule", eid), bg: "#f3e8ff", color: "#6b21a8" },
  { icon: "📊", label: "我的假勤", desc: "出勤統計", href: webUrl("/my-attendance", eid), bg: "#fef3c7", color: "#92400e" },
  { icon: "💰", label: "我的薪資", desc: "薪資明細", href: webUrl("/my-salary", eid), bg: "#fef3c7", color: "#a16207" },
  { icon: "📦", label: "月結單據", desc: "拍照上傳", href: oaUrl("月結單據"), bg: "#dbeafe", color: "#1d4ed8" },
  { icon: "🏢", label: "總部代付", desc: "拍照上傳", href: oaUrl("總部代付"), bg: "#fce7f3", color: "#be185d" },
];

export default function MePanel() {
  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const eid = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("eid") : null;
  const items = ITEMS(eid || "");

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

  const wrap = { maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "system-ui, 'Noto Sans TC', sans-serif", background: "#f7f5f0", minHeight: "100vh" };

  if (loading) return <div style={wrap}><p style={{ textAlign: "center", color: "#888", padding: 60 }}>載入中...</p></div>;
  if (err) return <div style={wrap}><p style={{ textAlign: "center", color: "#b91c1c", padding: 60 }}>{err}</p></div>;

  const roleLabel = { admin: "總部管理員", manager: "區經理", store_manager: "店長", staff: "員工" }[emp?.role] || emp?.role;

  return (
    <div style={wrap}>
      <div style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)", borderRadius: 16, padding: "20px 18px", marginBottom: 14, color: "#fff", boxShadow: "0 2px 8px rgba(245,158,11,0.25)" }}>
        <div style={{ fontSize: 11, opacity: 0.9 }}>🍯 小食糖員工面板</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{emp?.name}</div>
        <div style={{ fontSize: 12, marginTop: 4, opacity: 0.92 }}>
          {roleLabel}　·　{emp?.stores?.name || "🏢 總部"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {items.map((it, i) => (
          <a key={i} href={it.href} style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "#fff", borderRadius: 14, padding: "16px 6px", textDecoration: "none",
            border: "1px solid #e8e6e1", boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            minHeight: 96,
          }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: it.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 6 }}>
              {it.icon}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#222" }}>{it.label}</div>
            <div style={{ fontSize: 9, color: "#888", marginTop: 2 }}>{it.desc}</div>
          </a>
        ))}
      </div>

      <div style={{ marginTop: 18, textAlign: "center", fontSize: 11, color: "#888" }}>
        點按項目會開啟 LINE 對話自動傳送指令
      </div>
    </div>
  );
}
