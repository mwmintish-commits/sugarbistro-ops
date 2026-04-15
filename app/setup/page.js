"use client";
import { useState, useEffect } from "react";

const DEFAULT_MENU = [
  { label: "上班打卡", text: "上班打卡" },
  { label: "下班打卡", text: "下班打卡" },
  { label: "我的班表", text: "我的班表" },
  { label: "日結回報", text: "日結回報" },
  { label: "存款回報", text: "存款回報" },
  { label: "選單", text: "選單" },
];

export default function SetupPage() {
  const [items, setItems] = useState(DEFAULT_MENU);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/system?key=richmenu_config").then(r => r.json()).then(d => {
      if (d.data && Array.isArray(d.data)) setItems(d.data);
    }).catch(() => {});
  }, []);

  const updateItem = (idx, field, val) => {
    const n = [...items]; n[idx] = { ...n[idx], [field]: val }; setItems(n);
  };

  const saveConfig = async () => {
    await fetch("/api/admin/system", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "richmenu_config", value: items }),
    });
    setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  const buildMenu = async () => {
    setLoading(true); setStatus(null);
    await saveConfig();
    try {
      const res = await fetch("/api/admin/richmenu", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup", items }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ ok: true, msg: "LINE 常駐選單建立成功！ID: " + data.richMenuId });
      } else {
        setStatus({ ok: false, msg: "失敗：" + (data.error || JSON.stringify(data.detail)) });
      }
    } catch (e) {
      setStatus({ ok: false, msg: "錯誤：" + e.message });
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f5", fontFamily: "system-ui, sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>{"🍯"}</div>
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>LINE 常駐選單設定</h1>
          <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>設定 LINE 聊天室底部的常駐功能按鈕</p>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>{"📱 選單按鈕配置（2行 x 3列 = 6個按鈕）"}</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
            {items.slice(0, 6).map((item, i) => (
              <div key={i} style={{ background: "#faf8f5", borderRadius: 8, padding: 10, border: "1px solid #e8e6e1" }}>
                <div style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>{"按鈕 " + (i + 1) + (i < 3 ? "（上排）" : "（下排）")}</div>
                <div style={{ marginBottom: 4 }}>
                  <label style={{ fontSize: 10, color: "#888" }}>顯示文字</label>
                  <input value={item.label} onChange={e => updateItem(i, "label", e.target.value)} style={{ width: "100%", padding: "4px 6px", borderRadius: 4, border: "1px solid #ddd", fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "#888" }}>送出指令</label>
                  <input value={item.text} onChange={e => updateItem(i, "text", e.target.value)} style={{ width: "100%", padding: "4px 6px", borderRadius: 4, border: "1px solid #ddd", fontSize: 12 }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: "#1a1a1a", borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#888", textAlign: "center", marginBottom: 6 }}>預覽（實際外觀需在 LINE 上傳圖片）</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
              {items.slice(0, 6).map((item, i) => (
                <div key={i} style={{ background: "#333", borderRadius: 4, padding: "8px 4px", textAlign: "center", color: "#fff", fontSize: 11 }}>{item.label}</div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={saveConfig} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", fontSize: 13, cursor: "pointer" }}>{"💾 儲存設定"}</button>
            <button onClick={buildMenu} disabled={loading} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: loading ? "#ccc" : "#0a7c42", color: "#fff", fontSize: 14, fontWeight: 600, cursor: loading ? "default" : "pointer" }}>
              {loading ? "建立中..." : "🚀 建立 LINE 常駐選單"}
            </button>
          </div>
          {saved && <p style={{ fontSize: 11, color: "#0a7c42", marginTop: 4 }}>{"✅ 設定已儲存"}</p>}
        </div>

        {status && (
          <div style={{ background: status.ok ? "#e6f9f0" : "#fde8e8", color: status.ok ? "#0a7c42" : "#b91c1c", padding: 14, borderRadius: 10, fontSize: 13, marginBottom: 12 }}>{status.msg}</div>
        )}

        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{"📝 使用說明"}</h3>
          <ol style={{ fontSize: 12, lineHeight: 2, color: "#555", paddingLeft: 20 }}>
            <li>修改上方 6 個按鈕的「顯示文字」和「送出指令」</li>
            <li>{"點擊「🚀 建立 LINE 常駐選單」"}</li>
            <li>{"系統會自動在 LINE 建立選單結構"}</li>
            <li>{"到 LINE Official Account Manager → 聊天室相關 → 圖文選單"}</li>
            <li>上傳正式的選單背景圖片（2500x843 像素）</li>
          </ol>
          <p style={{ fontSize: 11, color: "#888", marginTop: 8 }}>{"* 每次修改按鈕後需重新建立選單才會生效"}</p>
          <p style={{ fontSize: 11, color: "#888" }}>{"* 員工輸入「選單」仍會依角色顯示不同的快捷按鈕"}</p>
        </div>
      </div>
    </div>
  );
}
