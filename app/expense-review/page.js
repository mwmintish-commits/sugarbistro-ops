"use client";
import { useState, useEffect } from "react";

const FIELDS = [
  { k: "amount", l: "金額", type: "number", color: "#0a7c42" },
  { k: "vendor_name", l: "廠商名稱", type: "text" },
  { k: "date", l: "日期", type: "date" },
  { k: "description", l: "品項說明", type: "text" },
  { k: "category_suggestion", l: "費用分類", type: "text" },
  { k: "invoice_number", l: "發票號碼", type: "text" },
];
const fmt = n => "$" + Number(n || 0).toLocaleString();

export default function ExpenseReview() {
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
    fetch("/api/admin/expenses?id=" + id)
      .then(r => r.json())
      .then(r => {
        if (r.error || !r.data) { setErr("找不到費用資料"); setLoading(false); return; }
        setData(r.data);
        const f = {};
        FIELDS.forEach(({ k }) => f[k] = r.data[k] || "");
        setForm(f);
        setLoading(false);
      })
      .catch(() => { setErr("載入失敗"); setLoading(false); });
  }, []);

  const hasChanges = data && FIELDS.some(({ k }) => String(form[k] || "") !== String(data[k] || ""));
  const typeLabel = data?.expense_type === "vendor" ? "📦 月結單據" : data?.expense_type === "hq_advance" ? "🏢 總部代付" : "💰 零用金";

  const submit = async () => {
    if (hasChanges && !reason.trim()) { alert("有修改，請填寫修改原因"); return; }
    const id = new URLSearchParams(window.location.search).get("id");
    const updates = {};
    FIELDS.forEach(({ k }) => { if (k === "amount") updates[k] = Number(form[k] || 0); else updates[k] = form[k] || ""; });
    updates.status = "confirmed";
    if (hasChanges) {
      const changes = [];
      FIELDS.forEach(({ k, l }) => {
        if (String(form[k] || "") !== String(data[k] || ""))
          changes.push({ field: l, from: data[k] || "", to: form[k] || "" });
      });
      updates.edit_reason = reason;
      updates.edit_changes = JSON.stringify(changes);
      updates.edited_at = new Date().toISOString();
    }
    const r = await fetch("/api/admin/expenses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", expense_id: id, ...updates }),
    }).then(r => r.json());
    if (r.error) alert("❌ " + r.error);
    else setDone(true);
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#888" }}>載入中...</div>;
  if (err) return <div style={{ padding: 40, textAlign: "center", color: "#b91c1c" }}>{err}</div>;
  if (done) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>費用已確認送出</div>
      <div style={{ fontSize: 13, color: "#888", marginTop: 8 }}>可關閉此頁面</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 16, fontFamily: "-apple-system,sans-serif" }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{typeLabel} 確認</h2>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
        {data.stores?.name || ""} {data.submitted_by_name ? "(" + data.submitted_by_name + ")" : ""}
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

      {/* AI 辨識明細 */}
      {data.ai_raw_data?.items?.length > 0 && (
        <div style={{ background: "#f0f8ff", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 11 }}>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>AI 辨識品項：</div>
          {data.ai_raw_data.items.map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{item.name}</span><span>{fmt(item.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: "#faf8f5", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        {FIELDS.map(({ k, l, type, color }) => {
          const changed = data && String(form[k] || "") !== String(data[k] || "");
          return (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ fontSize: 12, color: "#666", minWidth: 80 }}>{l}</label>
              <input type={type || "text"} value={form[k] || ""} onChange={e => setForm({ ...form, [k]: e.target.value })}
                style={{ flex: 1, maxWidth: 200, padding: "6px 8px", borderRadius: 6,
                  border: "1px solid " + (changed ? "#4361ee" : "#ddd"),
                  fontSize: 13, textAlign: type === "number" ? "right" : "left",
                  fontWeight: color ? 600 : 400, color: color || "inherit",
                  background: changed ? "#e6f1fb" : "#fff" }} />
            </div>
          );
        })}
      </div>

      {hasChanges && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "#b91c1c", fontWeight: 500 }}>⚠️ 有修改，請填寫原因：</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="例：AI金額辨識錯誤、廠商名稱打錯..."
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
