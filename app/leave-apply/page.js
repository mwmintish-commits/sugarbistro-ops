"use client";
import { useState, useEffect } from "react";
import { PageShell, PageHeader, ErrorState, Card, Button, Field, ChoiceButton, SuccessCard, BackLink, inputStyle } from "../components/ui";
import { fetchJSON } from "@/lib/fetch-json";

const TYPES = [
  { k: "annual", l: "🏖 特休", desc: "有薪，不扣薪" },
  { k: "comp_time", l: "🔄 補休", desc: "扣補休餘額" },
  { k: "personal", l: "📋 事假", desc: "扣全薪" },
  { k: "sick", l: "🤒 病假", desc: "扣半薪" },
  { k: "menstrual", l: "🩸 生理假", desc: "扣半薪" },
  { k: "marriage", l: "💒 婚假", desc: "有薪" },
  { k: "funeral", l: "🕯 喪假", desc: "有薪" },
  { k: "paternity", l: "👶 陪產假", desc: "有薪" },
  { k: "family_care", l: "🏠 家庭照顧假", desc: "扣全薪" },
];

export default function LeaveApply() {
  const [emp, setEmp] = useState(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ type: "", startDate: "", endDate: "", halfDay: "", mode: "full", hours: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [balance, setBalance] = useState(null);

  const eid = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("eid") : null;

  useEffect(() => {
    if (!eid) return;
    fetchJSON("/api/admin/employees?id=" + eid).then(r => setEmp(r.data)).catch(() => {});
    fetchJSON("/api/admin/leave-balances?employee_id=" + eid + "&year=" + new Date().getFullYear()).then(r => setBalance(r)).catch(() => {});
  }, [eid]);

  const submit = async () => {
    if (!form.type || !form.startDate) { setErr("請選假別和日期"); return; }
    setSubmitting(true); setErr("");
    try {
      const r = await fetch("/api/admin/leaves", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          employee_id: eid,
          leave_type: form.type,
          start_date: form.startDate,
          end_date: form.endDate || form.startDate,
          half_day: form.mode === "half" ? form.halfDay : null,
          leave_hours: form.mode === "hours" ? Number(form.hours || 0) : form.mode === "half" ? 4 : 0,
          request_type: "leave",
        }),
      }).then(r => r.json());
      setSubmitting(false);
      if (r.error) { setErr(r.error); return; }
      setDone(true);
    } catch (e) {
      setSubmitting(false);
      setErr("連線失敗，請再試一次");
    }
  };

  if (!eid) return <PageShell maxWidth={420}><ErrorState message="缺少員工識別碼" /></PageShell>;

  if (done) {
    const typeInfo = TYPES.find(t => t.k === form.type) || {};
    const days = form.halfDay ? 0.5 : (form.endDate && form.endDate !== form.startDate
      ? Math.ceil((new Date(form.endDate) - new Date(form.startDate)) / 86400000) + 1 : 1);
    const rows = [
      ["假別", typeInfo.l],
      ["日期", form.startDate + (form.endDate && form.endDate !== form.startDate ? " ~ " + form.endDate : "")],
      ["天數", days + " 天"],
    ];
    if (form.halfDay) rows.push(["時段", form.halfDay === "am" ? "上午" : "下午"]);
    return (
      <PageShell maxWidth={420}>
        <SuccessCard title="請假已送出" rows={rows} eid={eid} />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth={420}>
      <PageHeader emoji="🏖" title="請假申請" subtitle={`${emp?.name || "..."}${emp?.stores?.name ? "　·　" + emp.stores.name : ""}`} />

      {balance && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
          <div style={{ background: "var(--info-bg)", borderRadius: "var(--radius-sm)", padding: "8px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "var(--text-3)" }}>特休餘額</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--info)" }}>{balance.annual_remaining ?? "-"} 天</div>
          </div>
          <div style={{ background: "var(--success-bg)", borderRadius: "var(--radius-sm)", padding: "8px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "var(--text-3)" }}>補休餘額</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--success)" }}>{balance.comp_available ?? "-"} hr</div>
          </div>
        </div>
      )}

      {/* Step 1: 選假別 */}
      {step === 1 && (
        <Card title="1. 選擇假別">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {TYPES.map(t => (
              <ChoiceButton key={t.k} selected={form.type === t.k} onClick={() => { setForm({ ...form, type: t.k }); setStep(2); }}>
                <div style={{ fontSize: 13 }}>{t.l}</div>
                <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2, fontWeight: 400 }}>{t.desc}</div>
              </ChoiceButton>
            ))}
          </div>
        </Card>
      )}

      {/* Step 2: 選日期 */}
      {step === 2 && (
        <Card title={
          <span>2. 選擇日期
            <button onClick={() => setStep(1)} style={{ fontSize: 12, color: "var(--brand-strong)", marginLeft: 8, background: "none", border: "none", cursor: "pointer", padding: "4px 6px", fontWeight: 600 }}>← 改假別</button>
          </span>
        }>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 10 }}>
            {TYPES.find(t => t.k === form.type)?.l}
          </div>

          <Field label="開始日期">
            <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value, endDate: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="結束日期（多天請假）">
            <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} min={form.startDate} style={inputStyle} />
          </Field>

          <Field label="請假方式">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
              {[["full", "整天"], ["half", "半天"], ["hours", "按小時"]].map(([v, l]) => (
                <ChoiceButton key={v} selected={form.mode === v} style={{ textAlign: "center" }}
                  onClick={() => setForm({ ...form, mode: v, halfDay: v === "half" ? "am" : "", hours: "" })}>{l}</ChoiceButton>
              ))}
            </div>
            {form.mode === "half" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {[["am", "上午"], ["pm", "下午"]].map(([v, l]) => (
                  <ChoiceButton key={v} selected={form.halfDay === v} style={{ textAlign: "center" }}
                    onClick={() => setForm({ ...form, halfDay: v })}>{l}</ChoiceButton>
                ))}
              </div>
            )}
            {form.mode === "hours" && (
              <div>
                <input type="number" min="1" max="7" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} placeholder="請假時數（1~7）" style={inputStyle} />
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>當天仍需上班，僅扣請假時數的薪資</div>
              </div>
            )}
          </Field>

          {err && <div style={{ color: "var(--danger)", fontSize: 12, marginBottom: 8 }}>❌ {err}</div>}

          <Button onClick={submit} loading={submitting} disabled={!form.startDate}>
            📤 送出請假申請
          </Button>
        </Card>
      )}

      <BackLink eid={eid} />
    </PageShell>
  );
}
