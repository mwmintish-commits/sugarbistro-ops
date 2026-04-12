"use client";
import { useState, useEffect } from "react";

const FIELDS = [
  { k: "net_sales", l: "營業淨額", color: "#0a7c42" },
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
    fetch("/api/admin/settlements?id=" + id)
      .then(r => r.json())
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

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#888" }}>載入中...</div>;
  if (err) return <div style={{ padding: 40, textAlign: "center", color: "#b91c1c" }}>{err}</div>;
  if (done) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>日結已確認送出</div>
      <div style={{ fontSize: 13, color: "#888", marginTop: 8 }}>可關閉此頁面</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 16, fontFamily: "-apple-system,sans-serif" }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>📊 日結確認</h2>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
        {data.stores?.name || ""} {data.date} {data.cashier_name ? "(" + data.cashier_name + ")" : ""}
      </div>

      {data.image_url && (
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => setShowImg(!showImg)}
            style={{ fontSize: 12, color: "#4361ee", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            {showImg ? "▼ 收起單據照片" : "▶ 查看單據照片"}
          </button>
          {showImg && <img src={data.image_url} alt="" style={{ width: "100%", borderRadius: 8, marginTop: 6, border: "1px solid #eee" }} />}
        </div>
      )}

      <div style={{ background: "#faf8f5", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        {FIELDS.map(({ k, l, color }) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label style={{ fontSize: 12, color: "#666", minWidth: 90 }}>{l}</label>
            <input type="number" value={form[k] || ""} onChange={e => setForm({ ...form, [k]: e.target.value })}
              style={{ width: 110, padding: "6px 8px", borderRadius: 6, border: "1px solid " + (Number(form[k] || 0) !== Number(data[k] || 0) ? "#4361ee" : "#ddd"),
                fontSize: 13, textAlign: "right", fontWeight: color ? 600 : 400, color: color || "inherit",
                background: Number(form[k] || 0) !== Number(data[k] || 0) ? "#e6f1fb" : "#fff" }} />
          </div>
        ))}
      </div>

      {/* 驗算 */}
      <div style={{ background: Math.abs(diff) > 100 ? "#fef2f2" : "#e6f9f0", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12 }}>
        <div>營收 {fmt(form.net_sales)} — 收款合計 {fmt(paySum)}</div>
        {Math.abs(diff) > 100
          ? <div style={{ color: "#b91c1c", fontWeight: 600 }}>⚠️ 差額 {fmt(diff)}，請核對</div>
          : <div style={{ color: "#0a7c42" }}>✅ 數字吻合</div>}
      </div>

      {/* 修改原因 */}
      {hasChanges && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "#b91c1c", fontWeight: 500 }}>⚠️ 數字有修改，請填寫原因：</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="例：AI把3辨識成8、漏算匯款金額..."
            style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #fca5a5", fontSize: 12, marginTop: 4, minHeight: 60, resize: "vertical" }} />
        </div>
      )}

      <button onClick={submit}
        style={{ width: "100%", padding: 14, borderRadius: 8, border: "none",
          background: hasChanges ? "#4361ee" : "#0a7c42", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
        {hasChanges ? "✏️ 修正並送出" : "✅ 確認送出"}
      </button>
    </div>
  );
}
