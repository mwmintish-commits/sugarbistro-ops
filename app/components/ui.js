"use client";
// 員工端共用 UI 元件（design tokens 見 app/globals.css）
// 原則：純 props、無新依賴；頁面只動視覺殼，不動資料邏輯
import { useEffect, useState } from "react";

export function PageShell({ children, maxWidth = "var(--page-max)", style }) {
  return (
    <div style={{
      maxWidth, margin: "0 auto", padding: 16,
      minHeight: "100dvh", background: "var(--bg)",
      paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
      ...style,
    }}>
      {children}
    </div>
  );
}

// variant: brand（員工糖色漸層）| audit（稽核大地色漸層）| plain（白卡）
export function PageHeader({ emoji, title, subtitle, variant = "brand", right, children }) {
  const plain = variant === "plain";
  return (
    <div style={{
      background: plain ? "var(--surface)" : variant === "audit" ? "var(--audit-grad)" : "var(--brand-grad)",
      border: plain ? "1px solid var(--border)" : "none",
      borderRadius: "var(--radius-lg)", padding: "18px 18px", marginBottom: 14,
      color: plain ? "var(--text)" : "#fff",
      boxShadow: plain ? "var(--shadow-card)" : "var(--shadow-float)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>
            {emoji ? `${emoji} ` : ""}{title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, marginTop: 4, opacity: plain ? 1 : 0.92, color: plain ? "var(--text-3)" : undefined }}>
              {subtitle}
            </div>
          )}
        </div>
        {right && <div style={{ flexShrink: 0 }}>{right}</div>}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, children, pad = true, style }) {
  return (
    <div className="sb-card" style={{ marginBottom: 12, ...style }}>
      {title && (
        <div style={{ padding: "12px 14px 0", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
          {title}
        </div>
      )}
      <div style={pad ? { padding: 14 } : undefined}>{children}</div>
    </div>
  );
}

export function Button({ variant = "primary", loading = false, full = true, children, style, disabled, ...rest }) {
  return (
    <button
      className={`sb-btn sb-btn-${variant}`}
      disabled={disabled || loading}
      style={{ width: full ? "100%" : "auto", ...style }}
      {...rest}
    >
      {loading ? "處理中..." : children}
    </button>
  );
}

export function Row({ label, value, strong = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid var(--divider)", fontSize: 14 }}>
      <span style={{ color: "var(--text-3)", flexShrink: 0 }}>{label}</span>
      <span style={{ color: "var(--text)", fontWeight: strong ? 700 : 500, textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

// kind: card（單卡）| list（多列）| grid（3欄按鈕格）
export function LoadingSkeleton({ kind = "card", rows = 3 }) {
  if (kind === "grid") {
    return (
      <div>
        <div className="sb-skel" style={{ height: 96, borderRadius: "var(--radius-lg)", marginBottom: 14 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="sb-skel" style={{ height: 96, borderRadius: 14 }} />
          ))}
        </div>
      </div>
    );
  }
  if (kind === "list") {
    return (
      <div>
        <div className="sb-skel" style={{ height: 72, borderRadius: "var(--radius-lg)", marginBottom: 14 }} />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="sb-skel" style={{ height: 56, marginBottom: 10 }} />
        ))}
      </div>
    );
  }
  return (
    <div>
      <div className="sb-skel" style={{ height: 72, borderRadius: "var(--radius-lg)", marginBottom: 14 }} />
      <div className="sb-skel" style={{ height: 180 }} />
    </div>
  );
}

export function EmptyState({ icon = "📭", title = "目前沒有資料", desc }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-3)" }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-2)" }}>{title}</div>
      {desc && <div style={{ fontSize: 13, marginTop: 6 }}>{desc}</div>}
    </div>
  );
}

export function ErrorState({ message = "載入失敗", onRetry }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 16px" }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>😵</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--danger)" }}>{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="sb-btn sb-btn-ghost" style={{ width: "auto", marginTop: 16, padding: "0 24px" }}>
          🔄 重試
        </button>
      )}
    </div>
  );
}

const BADGE_TONES = {
  success: { color: "var(--success)", bg: "var(--success-bg)" },
  danger: { color: "var(--danger)", bg: "var(--danger-bg)" },
  warning: { color: "var(--warning)", bg: "var(--warning-bg)" },
  info: { color: "var(--info)", bg: "var(--info-bg)" },
  neutral: { color: "var(--text-3)", bg: "var(--surface-warm)" },
};

export function Badge({ tone = "neutral", children }) {
  const t = BADGE_TONES[tone] || BADGE_TONES.neutral;
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 99, fontSize: 12, fontWeight: 700, color: t.color, background: t.bg, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 4, fontWeight: 600 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

export const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px",
  borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--text)",
};

// 表單選項 chip（選中=糖色框）
export function ChoiceButton({ selected, onClick, children, style }) {
  return (
    <button onClick={onClick} style={{
      minHeight: "var(--tap-min)", padding: "8px 10px", borderRadius: "var(--radius-sm)",
      border: selected ? "2px solid var(--brand)" : "1px solid var(--border)",
      background: selected ? "var(--sugar-50)" : "var(--surface)",
      color: "var(--text)", cursor: "pointer", fontSize: 13, fontWeight: selected ? 700 : 500,
      textAlign: "left", ...style,
    }}>
      {children}
    </button>
  );
}

// 表單送出成功畫面（標題 + 摘要列 + 回面板）
export function SuccessCard({ title, subtitle = "等待主管審核", rows = [], eid }) {
  return (
    <div className="sb-card" style={{ padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>{subtitle}</div>
      {rows.length > 0 && (
        <div style={{ background: "var(--bg)", borderRadius: "var(--radius-sm)", padding: 12, textAlign: "left", fontSize: 13 }}>
          {rows.map(([l, v], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none" }}>
              <span style={{ color: "var(--text-3)" }}>{l}</span><span style={{ fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
      <a href={`/me?eid=${eid || ""}`} className="sb-btn sb-btn-primary"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 16, textDecoration: "none", boxSizing: "border-box" }}>
        ← 回面板
      </a>
    </div>
  );
}

export function BackLink({ eid, label = "← 回面板" }) {
  return (
    <div style={{ marginTop: 14, textAlign: "center" }}>
      <a href={`/me?eid=${eid || ""}`} style={{ display: "inline-block", padding: "10px 18px", fontSize: 13, color: "var(--brand-strong)", fontWeight: 600, textDecoration: "none" }}>
        {label}
      </a>
    </div>
  );
}

// 輕量 toast：const { toast, el } = useToast(); toast("已儲存"); render {el}
export function useToast() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  const toast = (text, tone = "success") => setMsg({ text, tone });
  const el = msg ? (
    <div style={{
      position: "fixed", left: "50%", bottom: "calc(28px + env(safe-area-inset-bottom))",
      transform: "translateX(-50%)", zIndex: 9999,
      background: msg.tone === "danger" ? "var(--danger)" : "var(--ink)",
      color: "#fff", padding: "10px 18px", borderRadius: 99,
      fontSize: 14, fontWeight: 600, boxShadow: "var(--shadow-float)",
      maxWidth: "calc(100vw - 40px)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    }}>
      {msg.text}
    </div>
  ) : null;
  return { toast, el };
}
