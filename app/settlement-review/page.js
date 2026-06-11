"use client";
import { useState, useEffect } from "react";
import { PageShell, PageHeader, LoadingSkeleton, ErrorState } from "../components/ui";
import { fetchJSON } from "@/lib/fetch-json";

const FIELDS = [
  { k: "net_sales", l: "營業淨額", color: "var(--success)" },
  { k: "cash_amount", l: "現金" },
  { k: "twqr_amount", l: "TWQR" },
  { k: "remittance_amount", l: "匯款" },
  { k: "uber_eat_amount", l: "UberEats" },
  { k: "line_pay_amount", l: "LINE Pay" },
  { k: "easy_card_amount", l: "悠遊卡" },
  { k: "meal_voucher_amount", l: "餐券(50/100)" },
  { k: "drink_voucher_amount", l: "飲料券(130/160)" },
  { k: "line_credit_amount", l: "LINE儲值金" },
  { k: "discount_total", l: "折扣金額" },
  { k: "invoice_count", l: "發票張數" },
  { k: "void_invoice_count", l: "作廢張數" },
  { k: "void_invoice_amount", l: "作廢金額" },
  { k: "petty_cash_reserved", l: "預留零用金" },
  { k: "void_item_count", l: "註銷數量" },
  { k: "void_item_amount", l: "註銷金額" },
];
const fmt = n => "$" + Number(n || 0).toLocaleString();

export default function SettlementReview() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({});
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [showImg, setShowImg] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) { setErr("缺少 ID"); setLoading(false); return; }
    fetchJSON("/api/admin/settlements?id=" + id)
      .then(r => {
        if (r.error || !r.data) { setErr("找不到日結資料"); setLoading(false); return; }
        setData(r.data);
        const f = {};
        FIELDS.forEach(({ k }) => f[k] = r.data[k] || 0);
        setForm(f);
        setLoading(false);
      })
      .catch(() => { setErr("載入失敗"); setLoading(false); });
  }, []);

  const paySum = FIELDS.slice(1, 10).reduce((s, { k }) => s + Number(form[k] || 0), 0);
  const diff = Number(form.net_sales || 0) - paySum;
  const hasChanges = data && FIELDS.some(({ k }) => Number(form[k] || 0) !== Number(data[k] || 0));

  const submit = async () => {
    if (hasChanges && !reason.trim()) { alert("有修改數字，請填寫修改原因"); return; }
    const id = new URLSearchParams(window.location.search).get("id");
    const updates = {};
    FIELDS.forEach(({ k }) => updates[k] = Number(form[k] || 0));
    updates.cash_to_deposit = Number(form.cash_amount || 0) - Number(form.petty_cash_reserved || 0);
    updates.status = "confirmed";
    if (hasChanges) {
      const changes = [];
      FIELDS.forEach(({ k, l }) => {
        if (Number(form[k] || 0) !== Number(data[k] || 0))
          changes.push({ field: l, from: Number(data[k] || 0), to: Number(form[k] || 0) });
      });
      updates.edit_reason = reason;
      updates.edit_changes = JSON.stringify(changes);
      updates.edited_at = new Date().toISOString();
    }
    const r = await fetch("/api/admin/settlements", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", settlement_id: id, ...updates }),
    }).then(r => r.json());
    if (r.error) alert("❌ " + r.error);
    else setDone(true);
  };

  if (loading) return <PageShell maxWidth={420}><LoadingSkeleton kind="list" rows={8} /></PageShell>;
  if (err) return <PageShell maxWidth={420}><ErrorState message={err} onRetry={() => window.location.reload()} /></PageShell>;
  if (done) return (
    <PageShell maxWidth={420}>
      <div className="sb-card" style={{ padding: 40, textAlign: "center", marginTop: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>日結已確認送出</div>
        <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 8 }}>可關閉此頁面</div>
      </div>
    </PageShell>
  );

  return (
    <PageShell maxWidth={420}>
      <PageHeader emoji="📊" title="日結確認"
        subtitle={`${data.stores?.name || ""} ${data.date} ${data.cashier_name ? "(" + data.cashier_name + ")" : ""}`} />

      {data.image_url && (
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => setShowImg(!showImg)}
            style={{ fontSize: 13, color: "var(--brand-strong)", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: "8px 0" }}>
            {showImg ? "▼ 收起單據照片" : "▶ 查看單據照片"}
          </button>
          {showImg && <img src={data.image_url} alt="" style={{ width: "100%", borderRadius: 8, marginTop: 6, border: "1px solid var(--border)" }} />}
        </div>
      )}

      <div className="sb-card" style={{ borderRadius: 10, padding: 12, marginBottom: 12 }}>
        {FIELDS.map(({ k, l, color }) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label style={{ fontSize: 12, color: "var(--text-2)", minWidth: 90 }}>{l}</label>
            <input type="number" value={form[k] || ""} onChange={e => setForm({ ...form, [k]: e.target.value })}
              style={{ width: 120, padding: "8px", borderRadius: 6, border: "1px solid " + (Number(form[k] || 0) !== Number(data[k] || 0) ? "var(--brand)" : "var(--border)"),
                textAlign: "right", fontWeight: color ? 600 : 400, color: color || "inherit",
                background: Number(form[k] || 0) !== Number(data[k] || 0) ? "var(--sugar-50)" : "var(--surface)" }} />
          </div>
        ))}
      </div>

      {/* 驗算 */}
      <div style={{ background: Math.abs(diff) > 100 ? "var(--danger-bg)" : "var(--success-bg)", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12 }}>
        <div>營收 {fmt(form.net_sales)} — 收款合計 {fmt(paySum)}</div>
        {Math.abs(diff) > 100
          ? <div style={{ color: "var(--danger)", fontWeight: 600 }}>⚠️ 差額 {fmt(diff)}，請核對</div>
          : <div style={{ color: "var(--success)" }}>✅ 數字吻合</div>}
      </div>

      {/* 修改原因 */}
      {hasChanges && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "var(--danger)", fontWeight: 500 }}>⚠️ 數字有修改，請填寫原因：</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="例：AI把3辨識成8、漏算匯款金額..."
            style={{ width: "100%", boxSizing: "border-box", padding: 8, borderRadius: 6, border: "1px solid var(--danger)", marginTop: 4, minHeight: 60, resize: "vertical" }} />
        </div>
      )}

      <button onClick={submit}
        className={hasChanges ? "sb-btn sb-btn-primary" : "sb-btn sb-btn-success"} style={{ fontSize: 15, minHeight: 52 }}>
        {hasChanges ? "✏️ 修正並送出" : "✅ 確認送出"}
      </button>
    </PageShell>
  );
}
