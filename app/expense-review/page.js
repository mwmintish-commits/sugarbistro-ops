"use client";
import { useState, useEffect } from "react";

const CATS = ["食材原料","包材耗材","飲料原料","清潔用品","設備維修","租金","水電費","瓦斯費","電信費","廣告行銷","印刷費","員工餐費","其他"];
const fmt = n => "$" + Number(n || 0).toLocaleString();

export default function ExpenseReview() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ amount: "", vendor_name: "", date: "", description: "", category_suggestion: "其他", invoice_number: "" });
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const id = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("id") : null;

  useEffect(() => {
    if (!id) { setErr("缺少 ID"); setLoading(false); return; }
    fetch("/api/admin/expenses?id=" + id).then(r => r.json()).then(r => {
      if (r.error || !r.data) { setErr("找不到費用資料"); setLoading(false); return; }
      setData(r.data);
      setForm({ amount: r.data.amount || "", vendor_name: r.data.vendor_name || "", date: r.data.date || "", description: r.data.description || "", category_suggestion: r.data.category_suggestion || "其他", invoice_number: r.data.invoice_number || "" });
      setLoading(false);
      // 如果金額是 0（新上傳），自動觸發 AI
      if (!r.data.amount || r.data.amount == 0) runAI(r.data);
    }).catch(() => { setErr("載入失敗"); setLoading(false); });
  }, []);

  const runAI = async (expData) => {
    const d = expData || data;
    if (!d?.image_url) return;
    setAiLoading(true);
    try {
      const r = await fetch("/api/admin/expenses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ai_recognize", expense_id: d.id, image_url: d.image_url }),
      }).then(r => r.json());
      if (r.data) {
        const ai = r.data;
        setForm(prev => ({
          amount: ai.total_amount || prev.amount || "",
          vendor_name: ai.vendor_name || prev.vendor_name || "",
          date: ai.date || prev.date || "",
          description: ai.description || ai.items?.map(i => i.name).join("、") || prev.description || "",
          category_suggestion: ai.category_suggestion || prev.category_suggestion || "其他",
          invoice_number: ai.invoice_number || prev.invoice_number || "",
        }));
      }
    } catch {}
    setAiLoading(false);
  };

  const submit = async (status) => {
    if (!form.amount || Number(form.amount) <= 0) { alert("請填寫金額"); return; }
    // 發票重複檢查
    if (form.invoice_number) {
      const dupCheck = await fetch("/api/admin/expenses?invoice_check=" + encodeURIComponent(form.invoice_number) + "&exclude_id=" + id).then(r => r.json());
      if (dupCheck.duplicate) { alert("⚠️ 發票 " + form.invoice_number + " 已存在！（" + dupCheck.duplicate.date + " " + (dupCheck.duplicate.vendor_name || "") + "）\n\n如確定不是重複，請移除發票號碼後再送出。"); return; }
    }
    const updates = { status: status || "pending", amount: Number(form.amount || 0), vendor_name: form.vendor_name, date: form.date, description: form.description, category_suggestion: form.category_suggestion, invoice_number: form.invoice_number, month_key: (form.date || "").slice(0, 7) };
    if (reason) { updates.edit_reason = reason; updates.edited_at = new Date().toISOString(); }
    const r = await fetch("/api/admin/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", expense_id: id, ...updates }) }).then(r => r.json());
    if (r.error) alert("❌ " + r.error);
    else setDone(true);
  };

  const typeLabel = data?.expense_type === "vendor" ? "📦 月結" : data?.expense_type === "hq_advance" ? "🏢 代付" : "💰 零用金";

  if (loading) return <Box><p style={{ textAlign: "center", color: "#888", padding: 40 }}>載入中...</p></Box>;
  if (err) return <Box><p style={{ textAlign: "center", color: "#b91c1c", padding: 40 }}>{err}</p></Box>;
  if (done) return <Box><div style={{ padding: 40, textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 12 }}>✅</div><div style={{ fontSize: 18, fontWeight: 600 }}>費用已送出</div><p style={{ color: "#888", marginTop: 8 }}>可關閉此頁面</p></div></Box>;

  return (
    <Box>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{typeLabel} 核對</h2>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>{data?.stores?.name || "總部"}</div>

      {/* 照片（預設展開） */}
      {data?.image_url && (
        <div style={{ marginBottom: 12, borderRadius: 8, overflow: "hidden", border: "1px solid #eee" }}>
          <img src={data.image_url} alt="" style={{ width: "100%", display: "block" }} />
        </div>
      )}

      {/* AI 辨識按鈕 */}
      <button onClick={() => runAI()} disabled={aiLoading}
        style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #4361ee", background: aiLoading ? "#e6f1fb" : "#fff", color: "#4361ee", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>
        {aiLoading ? "🤖 AI 辨識中..." : "🤖 AI 自動辨識"}
      </button>

      {/* 表單 */}
      <div style={{ background: "#faf8f5", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <Field label="💰 金額" type="number" value={form.amount} onChange={v => setForm({ ...form, amount: v })} big />
        <Field label="🏢 廠商" value={form.vendor_name} onChange={v => setForm({ ...form, vendor_name: v })} />
        <Field label="📅 日期" type="date" value={form.date} onChange={v => setForm({ ...form, date: v })} />
        <Field label="📋 說明" value={form.description} onChange={v => setForm({ ...form, description: v })} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label style={{ fontSize: 12, color: "#666", minWidth: 70 }}>📁 分類</label>
          <select value={form.category_suggestion} onChange={e => setForm({ ...form, category_suggestion: e.target.value })}
            style={{ flex: 1, maxWidth: 200, padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }}>
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <Field label="🧾 發票" value={form.invoice_number} onChange={v => setForm({ ...form, invoice_number: v })} placeholder="AB-12345678" />
      </div>

      {/* 修改原因 */}
      {data?.amount > 0 && <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="修改原因（選填）" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd", fontSize: 12, marginBottom: 12, minHeight: 40, resize: "vertical" }} />}

      {/* 按鈕 */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => submit("pending")} disabled={!form.amount || Number(form.amount) <= 0}
          style={{ flex: 1, padding: 14, borderRadius: 8, border: "none", background: Number(form.amount) > 0 ? "#0a7c42" : "#ddd", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
          ✅ 確認送出
        </button>
      </div>
      <p style={{ fontSize: 10, color: "#888", textAlign: "center", marginTop: 8 }}>送出後管理員會收到通知</p>
    </Box>
  );
}

function Field({ label, value, onChange, type, big, placeholder }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <label style={{ fontSize: 12, color: "#666", minWidth: 70 }}>{label}</label>
      <input type={type || "text"} inputMode={type === "number" ? "decimal" : undefined} value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder || ""}
        style={{ flex: 1, maxWidth: 200, padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: big ? 18 : 13, fontWeight: big ? 700 : 400, textAlign: type === "number" ? "right" : "left", color: big ? "#0a7c42" : "inherit" }} />
    </div>
  );
}

function Box({ children }) { return <div style={{ maxWidth: 420, margin: "0 auto", padding: 16, fontFamily: "system-ui, 'Noto Sans TC', sans-serif" }}>{children}</div>; }
