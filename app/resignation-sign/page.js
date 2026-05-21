"use client";
import { useEffect, useRef, useState } from "react";

const TYPE_LABEL = {
  voluntary: "自願離職",
  company_terminated: "公司資遣",
  contract_end: "契約期滿",
  retirement: "退休",
};

const fmt = n => "$" + Number(n || 0).toLocaleString();

export default function ResignationSignPage() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const canvasRef = useRef(null);
  const [hasInk, setHasInk] = useState(false);

  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;

  useEffect(() => {
    if (!token) { setError("缺少 token"); setLoading(false); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    fetch("/api/resignation?token=" + token, { signal: ctrl.signal })
      .then(r => r.json())
      .then(r => {
        if (r.error) setError(r.error);
        else if (r.data.status === "signed") { setError("此離職同意書已於 " + new Date(r.data.signed_at).toLocaleString("zh-TW") + " 簽署完成。"); }
        else if (r.data.status === "cancelled") { setError("此離職同意書已被取消。"); }
        else setInfo(r.data);
        setLoading(false);
      })
      .catch(e => { setError(e?.name === "AbortError" ? "載入逾時，請重試" : "載入失敗"); setLoading(false); })
      .finally(() => clearTimeout(t));
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [token]);

  // canvas 簽名邏輯（touch + mouse 都支援）
  useEffect(() => {
    if (loading || !info || done) return;
    const c = canvasRef.current; if (!c) return;
    // 設定 canvas 實際解析度 = display 大小 * dpr，避免模糊
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    let drawing = false, lastX = 0, lastY = 0;
    const getPos = (e) => {
      const r = c.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    const start = (e) => { e.preventDefault(); drawing = true; const p = getPos(e); lastX = p.x; lastY = p.y; };
    const move = (e) => {
      if (!drawing) return;
      e.preventDefault();
      const p = getPos(e);
      ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(p.x, p.y); ctx.stroke();
      lastX = p.x; lastY = p.y;
      setHasInk(true);
    };
    const end = () => { drawing = false; };

    c.addEventListener("mousedown", start); c.addEventListener("mousemove", move);
    c.addEventListener("mouseup", end); c.addEventListener("mouseleave", end);
    c.addEventListener("touchstart", start, { passive: false });
    c.addEventListener("touchmove", move, { passive: false });
    c.addEventListener("touchend", end);
    return () => {
      c.removeEventListener("mousedown", start); c.removeEventListener("mousemove", move);
      c.removeEventListener("mouseup", end); c.removeEventListener("mouseleave", end);
      c.removeEventListener("touchstart", start);
      c.removeEventListener("touchmove", move);
      c.removeEventListener("touchend", end);
    };
  }, [loading, info, done]);

  const clearSig = () => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  };

  const submit = async () => {
    if (!hasInk) { alert("請簽名"); return; }
    if (!agreed) { alert("請勾選「我已詳閱並同意」"); return; }
    setSubmitting(true);
    try {
      const c = canvasRef.current;
      const dataUrl = c.toDataURL("image/png");
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20000);
      const r = await fetch("/api/resignation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sign", token, signature_base64: dataUrl }),
        signal: ctrl.signal,
      }).finally(() => clearTimeout(t)).then(x => x.json());
      if (r.error) { alert("❌ " + r.error); setSubmitting(false); return; }
      setDone(true);
    } catch (e) {
      alert("提交失敗：" + (e?.name === "AbortError" ? "逾時" : e?.message || ""));
    }
    setSubmitting(false);
  };

  if (loading) return <Box><p style={{ textAlign: "center", padding: 40, color: "#888" }}>載入中…</p></Box>;
  if (error) return <Box><div style={{ padding: 30, textAlign: "center", color: "#b91c1c" }}>
    <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
    <div style={{ fontSize: 14 }}>{error}</div>
  </div></Box>;
  if (done) return <Box>
    <div style={{ padding: 30, textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
      <h1 style={{ fontSize: 18, fontWeight: 600 }}>離職同意書簽署完成</h1>
      <p style={{ fontSize: 13, color: "#666", marginTop: 12, lineHeight: 1.8 }}>
        感謝您的貢獻，本同意書已儲存於總部。<br />
        在最後工作日之前，請依正常班表上班。<br />
        系統將於最後工作日次日自動解除您的 LINE 登入權限。<br />
        薪資與特休結算依公司既有薪資作業流程辦理。<br />
        若有任何問題請聯繫總部。
      </p>
    </div>
  </Box>;

  return (
    <Box>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 28 }}>📋</div>
        <h1 style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>離職同意書</h1>
        <p style={{ fontSize: 11, color: "#888" }}>小食糖 SUGARbISTRO</p>
      </div>

      {/* 同意書本文 */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8e6e1", padding: "16px 14px", fontSize: 13, lineHeight: 1.85 }}>
        <div style={{ marginBottom: 12 }}>
          <Row l="姓名" v={info.employee_name} />
          {info.employee_id_number && <Row l="身分證字號" v={info.employee_id_number} />}
          {info.store_name && <Row l="服務門市" v={info.store_name} />}
          {info.hire_date && <Row l="到職日" v={info.hire_date} />}
          <Row l="離職類型" v={TYPE_LABEL[info.resignation_type] || info.resignation_type} />
          <Row l="最後工作日" v={<b>{info.last_working_date}</b>} />
          <Row l="服務年資" v={Math.floor((info.service_months || 0) / 12) + " 年 " + ((info.service_months || 0) % 12) + " 個月"} />
          {info.notice_days > 0 && <Row l="預告期" v={info.notice_days + " 天（依勞基法 §16）"} />}
        </div>

        <hr style={{ border: "none", borderTop: "1px dashed #ddd", margin: "10px 0" }} />

        <p>立同意書人 <b>{info.employee_name}</b> 茲因
          {info.resignation_type === "voluntary" ? "個人因素，主動向公司提出離職申請" :
           info.resignation_type === "company_terminated" ? "公司資遣終止勞動契約" :
           info.resignation_type === "contract_end" ? "契約期滿不續約" :
           "退休"}
          ，雙方同意條款如下：</p>
        <ol style={{ paddingLeft: 22, margin: "8px 0" }}>
          <li>本人之最後工作日為 <b>{info.last_working_date}</b>，自次日起終止勞動契約。在此之前本人仍依正常班表上班、領取薪資。</li>
          {info.reason && <li>離職原因說明：{info.reason}</li>}
          {info.annual_leave_remaining_days > 0 && (
            <li>本人之未休特別休假尚餘 <b>{info.annual_leave_remaining_days} 天</b>，
              將依公司薪資作業流程於離職日後隨末次薪資結算發放（試算金額 <b>{fmt(info.settlement_amount)}</b> 元整，實際以公司結算為準）。</li>
          )}
          <li>本人於任職期間應遵守之保密義務、競業禁止、智慧財產等條款，仍依雙方原訂約定繼續履行。</li>
          <li style={{ background: "#fef3c7", padding: "6px 8px", borderRadius: 4, margin: "6px 0", border: "1px solid #f59e0b" }}>
            <b>關於在職期間薪資數額經雙方依出勤資料核對無誤發放，勞方同意日後不再提出請求。</b>
          </li>
          <li>本人確認與公司間之加班費、勞退提撥、勞健保等事項皆已（或將依本書約定）結清，無其他爭議。</li>
          {info.additional_notes && <li>其他約定：{info.additional_notes}</li>}
          <li>本同意書經電子簽署即為雙方合意。系統將於最後工作日次日 00:00 解除本人之 LINE 綁定與系統登入權限。</li>
        </ol>
      </div>

      {/* 簽署區 */}
      <div style={{ background: "#fff", borderRadius: 10, border: "2px solid #b45309", padding: 14, marginTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#b45309", marginBottom: 6 }}>✍️ 員工簽名</div>
        <div style={{ background: "#faf8f5", borderRadius: 6, padding: 4, position: "relative" }}>
          <canvas ref={canvasRef} style={{ width: "100%", height: 160, background: "#fff", borderRadius: 4, border: "1px dashed #ddd", touchAction: "none", display: "block" }} />
          {!hasInk && <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "#bbb", fontSize: 12, pointerEvents: "none" }}>請在此區域簽名</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <button onClick={clearSig} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", fontSize: 11, cursor: "pointer" }}>🔄 重簽</button>
          <span style={{ fontSize: 10, color: "#888" }}>簽署日期：{new Date().toLocaleDateString("zh-TW")}</span>
        </div>
      </div>

      {/* 同意 + 送出 */}
      <label style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 12, fontSize: 12, cursor: "pointer", padding: 10, background: agreed ? "#e6f9f0" : "#fff", border: "1px solid " + (agreed ? "#0a7c42" : "#ddd"), borderRadius: 6 }}>
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 2 }} />
        <span>我已詳閱以上內容，確認所有資訊正確無誤，並同意以電子簽名方式簽署本離職同意書。</span>
      </label>

      <button onClick={submit} disabled={!hasInk || !agreed || submitting}
        style={{ width: "100%", padding: 14, borderRadius: 10, border: "none",
          background: (hasInk && agreed && !submitting) ? "#b91c1c" : "#ccc",
          color: "#fff", fontSize: 16, fontWeight: 700, cursor: (hasInk && agreed && !submitting) ? "pointer" : "not-allowed",
          marginTop: 12,
        }}>
        {submitting ? "送出中…" : "✅ 確認簽署並送出"}
      </button>
      <p style={{ fontSize: 10, color: "#888", textAlign: "center", marginTop: 8 }}>送出後將無法修改，請確認資料正確</p>
    </Box>
  );
}

function Row({ l, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, borderBottom: "1px solid #f0eeea" }}>
      <span style={{ color: "#888" }}>{l}</span>
      <span>{v}</span>
    </div>
  );
}

function Box({ children }) {
  return <div style={{ maxWidth: 520, margin: "0 auto", padding: 16, fontFamily: "system-ui, 'Noto Sans TC', sans-serif", minHeight: "100vh", background: "#f7f5f0" }}>{children}</div>;
}
