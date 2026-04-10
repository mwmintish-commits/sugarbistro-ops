export default function Home() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#faf8f5",
      color: "#2c2c2a",
    }}>
      <div style={{
        textAlign: "center",
        padding: "40px",
        maxWidth: "480px",
      }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🍯</div>
        <h1 style={{
          fontSize: "24px",
          fontWeight: 600,
          marginBottom: "8px",
        }}>
          小食糖營運系統
        </h1>
        <p style={{
          fontSize: "14px",
          color: "#888780",
          marginBottom: "32px",
        }}>
          Sugar Bistro Operations System
        </p>
        <div style={{
          background: "#fff",
          borderRadius: "12px",
          border: "1px solid #e8e6e1",
          padding: "24px",
          textAlign: "left",
        }}>
          <h2 style={{ fontSize: "16px", fontWeight: 500, marginBottom: "16px" }}>
            系統狀態
          </h2>
          <div style={{ fontSize: "14px", color: "#5f5e5a", lineHeight: 2 }}>
            <div>✅ LINE Bot Webhook：運作中</div>
            <div>✅ 資料庫：已連線</div>
            <div>🔨 管理後台：開發中</div>
          </div>
        </div>
        <p style={{
          marginTop: "24px",
          fontSize: "12px",
          color: "#b4b2a9",
        }}>
          管理後台即將上線，敬請期待
        </p>
      </div>
    </div>
  );
}
