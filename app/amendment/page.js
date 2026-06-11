"use client";
import { useState, useEffect } from "react";
import { PageShell, PageHeader, ErrorState, Card, Button, Field, ChoiceButton, SuccessCard, BackLink, inputStyle } from "../components/ui";
import { fetchJSON } from "@/lib/fetch-json";

const REASONS = ["忘記打卡", "手機沒電", "GPS 失效", "系統異常"];

export default function Amendment() {
  const [emp, setEmp] = useState(null);
  const [form, setForm] = useState({ date: "", type: "clock_in", time: "", reason: "" });
  const [customReason, setCustomReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const eid = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("eid") : null;

  useEffect(() => {
    if (!eid) return;
    fetchJSON("/api/admin/employees?id=" + eid).then(r => setEmp(r.data)).catch(() => {});
  }, [eid]);

  const submit = async () => {
    const reason = form.reason === "__custom" ? customReason : form.reason;
    if (!form.date || !form.time || !reason) { setErr("請填寫所有欄位"); return; }
    setSubmitting(true); setErr("");
    try {
      const r = await fetch("/api/admin/attendance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_amendment", employee_id: eid, store_id: emp?.store_id, date: form.date, type: form.type, amended_time: form.time, reason }),
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

  if (done) return (
    <PageShell maxWidth={420}>
      <SuccessCard title="補打卡已送出" eid={eid} rows={[
        ["日期", form.date],
        ["類型", form.type === "clock_in" ? "上班" : "下班"],
        ["時間", form.time],
      ]} />
    </PageShell>
  );

  return (
    <PageShell maxWidth={420}>
      <PageHeader emoji="🕐" title="補打卡申請" subtitle={emp?.name || "..."} />

      <Card>
        <Field label="日期">
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} />
        </Field>

        <Field label="打卡類型">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {[["clock_in", "🌅 上班"], ["clock_out", "🌙 下班"]].map(([v, l]) => (
              <ChoiceButton key={v} selected={form.type === v} style={{ textAlign: "center" }}
                onClick={() => setForm({ ...form, type: v })}>{l}</ChoiceButton>
            ))}
          </div>
        </Field>

        <Field label="實際時間">
          <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} style={inputStyle} />
        </Field>

        <Field label="原因">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 4 }}>
            {REASONS.map(r => (
              <ChoiceButton key={r} selected={form.reason === r} style={{ textAlign: "center", fontSize: 12 }}
                onClick={() => setForm({ ...form, reason: r })}>{r}</ChoiceButton>
            ))}
          </div>
          <ChoiceButton selected={form.reason === "__custom"} style={{ width: "100%", textAlign: "center", fontSize: 12 }}
            onClick={() => setForm({ ...form, reason: "__custom" })}>其他（自行輸入）</ChoiceButton>
          {form.reason === "__custom" && (
            <input value={customReason} onChange={e => setCustomReason(e.target.value)} placeholder="請輸入原因"
              style={{ ...inputStyle, marginTop: 6 }} />
          )}
        </Field>

        {err && <div style={{ color: "var(--danger)", fontSize: 12, marginBottom: 8 }}>❌ {err}</div>}

        <Button onClick={submit} loading={submitting}>
          📤 送出補打卡申請
        </Button>
      </Card>

      <BackLink eid={eid} />
    </PageShell>
  );
}
