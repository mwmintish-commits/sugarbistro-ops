"use client";
import { useState } from "react";

export default function SetupPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const setupRichMenu = async () => {
    setLoading(true); setStatus(null);
    try {
      const res = await fetch("/api/admin/richmenu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup" }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ ok: true, msg: `✅ LINE 常駐選單建立成功！\n\nRich Menu ID: ${data.richMenuId}\n\n${data.note || ""}` });
      } else {
        setStatus({ ok: false, msg: `❌ 失敗：${data.error || JSON.stringify(data.detail)}` });
      }
    } catch (e) {
      setStatus({ ok: false, msg: "❌ 錯誤：" + e.message });
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e8e6e1", padding: "40px 32px", maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🍯</div>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>小食糖系統設定</h1>
        <p style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>以下設定只需要執行一次</p>

        <div style={{ background: "#faf8f5", borderRadius: 12, padding: 16, marginBottom: 16, textAlign: "left" }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>📋 LINE 常駐選單</h3>
          <p style={{ fontSize: 12, color: "#666", lineHeight: 1.6, marginBottom: 12 }}>
            點擊下方按鈕，系統會自動建立 LINE 底部的常駐功能選單。<br/>
            建立後員工打開 LINE 聊天室就會看到功能按鈕，不需要打字。
          </p>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>
            選單配置：<br/>
            上排：上班打卡 ｜ 下班打卡 ｜ 我的班表<br/>
            下排：日結回報 ｜ 存款回報 ｜ 更多功能
          </div>
          <button onClick={setupRichMenu} disabled={loading} style={{
            width: "100%", padding: "12px", borderRadius: 10, border: "none",
            background: loading ? "#ccc" : "#1a1a1a", color: "#fff", fontSize: 14,
            cursor: loading ? "default" : "pointer",
          }}>
            {loading ? "建立中..." : "🚀 建立 LINE 常駐選單"}
          </button>
        </div>

        {status && (
          <div style={{
            background: status.ok ? "#e6f9f0" : "#fde8e8",
            color: status.ok ? "#0a7c42" : "#b91c1c",
            padding: 14, borderRadius: 10, fontSize: 13, textAlign: "left", whiteSpace: "pre-wrap",
          }}>
            {status.msg}
          </div>
        )}

        <p style={{ fontSize: 11, color: "#aaa", marginTop: 16 }}>
          建立後如需更換圖片，可到 LINE Official Account Manager → 聊天室相關 → 圖文選單 修改
        </p>
      </div>
    </div>
  );
}
