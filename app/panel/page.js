"use client";
import { useEffect, useState, useCallback } from "react";

const withTimeout = (promise, ms, label) => Promise.race([
  promise,
  new Promise((_, rej) => setTimeout(() => rej(new Error(label + " 逾時")), ms)),
]);

export default function PanelLanding() {
  const [msg, setMsg] = useState("載入中…");
  const [canRetry, setCanRetry] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const boot = useCallback(async () => {
    setMsg("載入中…");
    setCanRetry(false);
    const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!LIFF_ID) { setMsg("⚠️ 系統未設定 LIFF_ID，請聯繫總部"); return; }

    // 載 LINE SDK（若已載過直接用 window.liff）
    const loadSdk = () => new Promise((resolve, reject) => {
      if (window.liff) return resolve();
      const s = document.createElement("script");
      s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("無法載入 LINE SDK"));
      document.head.appendChild(s);
    });

    try {
      await withTimeout(loadSdk(), 8000, "LINE SDK 載入");
      await withTimeout(window.liff.init({ liffId: LIFF_ID }), 5000, "LIFF 初始化");
      if (!window.liff.isLoggedIn()) { window.liff.login(); return; }
      const profile = await withTimeout(window.liff.getProfile(), 5000, "讀取 LINE 個資");
      const r = await withTimeout(
        fetch("/api/admin/employees?line_uid=" + profile.userId).then(r => r.json()),
        5000, "查員工資料"
      );
      if (r.data?.id) {
        window.location.replace("/me?eid=" + r.data.id + "&liff=1");
      } else {
        setMsg("⚠️ 找不到你的員工資料，請聯繫總部啟用帳號");
      }
    } catch (e) {
      setMsg("❌ " + (e.message || "載入失敗") + "（網路較慢或不穩）");
      setCanRetry(true);
    }
  }, []);

  useEffect(() => { boot(); }, [boot, attempt]);

  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100dvh",background:"var(--bg)",padding:20,textAlign:"center"}}>
      <div style={{width:"100%",maxWidth:320}}>
        <div style={{fontSize:40,marginBottom:12}}>🍯</div>
        {!canRetry && <div className="sb-skel" style={{height:8,width:160,margin:"0 auto 14px",borderRadius:99}} />}
        <div style={{fontSize:14,color:"var(--text-2)",marginBottom:16,whiteSpace:"pre-line"}}>{msg}</div>
        {canRetry && (
          <button onClick={() => setAttempt(a => a + 1)}
            className="sb-btn sb-btn-success" style={{width:"auto",padding:"0 24px"}}>
            🔄 重試
          </button>
        )}
      </div>
    </div>
  );
}
