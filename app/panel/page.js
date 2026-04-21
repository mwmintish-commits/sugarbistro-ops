"use client";
import { useEffect, useState } from "react";

export default function PanelLanding() {
  const [msg, setMsg] = useState("載入中…");

  useEffect(() => {
    const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!LIFF_ID) { setMsg("⚠️ 系統未設定 LIFF_ID，請聯繫總部"); return; }

    const s = document.createElement("script");
    s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    s.onload = async () => {
      try {
        await window.liff.init({ liffId: LIFF_ID });
        if (!window.liff.isLoggedIn()) { window.liff.login(); return; }
        const profile = await window.liff.getProfile();
        const r = await fetch("/api/admin/employees?line_uid=" + profile.userId).then(r => r.json());
        if (r.data?.id) {
          window.location.replace("/me?eid=" + r.data.id);
        } else {
          setMsg("⚠️ 找不到你的員工資料，請聯繫總部啟用帳號");
        }
      } catch (e) {
        setMsg("❌ 載入失敗：" + (e.message || "請重新開啟"));
      }
    };
    s.onerror = () => setMsg("❌ 無法載入 LINE SDK");
    document.head.appendChild(s);
  }, []);

  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",fontFamily:"system-ui,'Noto Sans TC',sans-serif",background:"#f7f5f0",padding:20,textAlign:"center"}}>
      <div>
        <div style={{fontSize:40,marginBottom:12}}>🍯</div>
        <div style={{fontSize:14,color:"#666"}}>{msg}</div>
      </div>
    </div>
  );
}
