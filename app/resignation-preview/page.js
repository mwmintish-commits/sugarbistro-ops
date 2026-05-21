"use client";
import { useRef, useState } from "react";

const TYPE_LABEL = {
  voluntary: "自願離職",
  company_terminated: "公司資遣",
  contract_end: "契約期滿",
  retirement: "退休",
};

const fmt = n => "$" + Number(n || 0).toLocaleString();

// 預覽用的 mock 資料 — 可在頁面右上切換不同情境
const MOCK = {
  voluntary: {
    employee_name: "王小明",
    employee_id_number: "A123456789",
    store_name: "新光左營店",
    hire_date: "2024-03-01",
    resignation_type: "voluntary",
    last_working_date: "2026-06-15",
    reason: "另有生涯規劃，欲轉換跑道",
    service_months: 27,
    notice_days: 20,
    annual_leave_remaining_days: 5,
    settlement_amount: 6000,
    additional_notes: "離職後一個月內可協助銜接訓練新進同仁",
  },
  company_terminated: {
    employee_name: "李小華",
    employee_id_number: "B234567890",
    store_name: "屏東店",
    hire_date: "2025-01-15",
    resignation_type: "company_terminated",
    last_working_date: "2026-06-30",
    reason: "業務調整",
    service_months: 17,
    notice_days: 20,
    annual_leave_remaining_days: 3,
    settlement_amount: 3600,
    additional_notes: "",
  },
};

export default function ResignationPreviewPage() {
  const [scenario, setScenario] = useState("voluntary");
  const info = MOCK[scenario];
  const canvasRef = useRef(null);
  const [hasInk, setHasInk] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // 簡化的 canvas 簽名（同實際頁面）
  const setupCanvas = (c) => {
    if (!c || c._setup) return;
    c._setup = true;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    let drawing = false, lx = 0, ly = 0;
    const getPos = (e) => {
      const r = c.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    c.addEventListener("mousedown", e => { drawing = true; const p = getPos(e); lx = p.x; ly = p.y; });
    c.addEventListener("mousemove", e => {
      if (!drawing) return;
      const p = getPos(e);
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(p.x, p.y); ctx.stroke();
      lx = p.x; ly = p.y;
      setHasInk(true);
    });
    c.addEventListener("mouseup", () => drawing = false);
    c.addEventListener("mouseleave", () => drawing = false);
    c.addEventListener("touchstart", e => { e.preventDefault(); drawing = true; const p = getPos(e); lx = p.x; ly = p.y; }, { passive: false });
    c.addEventListener("touchmove", e => {
      e.preventDefault();
      if (!drawing) return;
      const p = getPos(e);
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(p.x, p.y); ctx.stroke();
      lx = p.x; ly = p.y;
      setHasInk(true);
    }, { passive: false });
    c.addEventListener("touchend", () => drawing = false);
  };

  const clear = () => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  };

  return (
    <div style={{ background: "#222", minHeight: "100vh", padding: "20px 12px", fontFamily: "system-ui, 'Noto Sans TC', sans-serif" }}>
      {/* 預覽控制列 */}
      <div style={{ maxWidth: 520, margin: "0 auto 12px", padding: 10, background: "#444", borderRadius: 8, color: "#fff", fontSize: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>🔍 預覽模式（不會實際送出，可隨意操作）</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span>切換情境：</span>
          {Object.keys(MOCK).map(k => (
            <button key={k} onClick={() => setScenario(k)}
              style={{ padding: "2px 10px", borderRadius: 4, border: "none",
                background: scenario === k ? "#fff" : "#666",
                color: scenario === k ? "#000" : "#fff",
                fontSize: 11, cursor: "pointer" }}>
              {TYPE_LABEL[k]}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 6, fontSize: 10, opacity: 0.8 }}>
          → 看完告訴 Claude 哪邊要改（用字 / 條款 / 順序 / 顏色…），不需 merge PR
        </div>
      </div>

      {/* 以下完全複製 /resignation-sign 的版面 */}
      <div style={{ maxWidth: 520, margin: "0 auto", padding: 16, background: "#f7f5f0", borderRadius: 12 }}>
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
            <li>本人之未休特別休假，將依公司薪資作業流程於離職日後隨末次薪資結算發放。</li>
            <li>本人於任職期間應遵守之保密義務、競業禁止、智慧財產等條款，仍依雙方原訂約定繼續履行。</li>
            <li>關於在職期間薪資數額經雙方依出勤資料核對無誤發放，勞方同意日後不再提出請求。</li>
            <li>本人確認與公司間之加班費、勞退提撥、勞健保等事項皆已（或將依本書約定）結清，無其他爭議。</li>
            {info.additional_notes && <li>其他約定：{info.additional_notes}</li>}
            <li>本同意書經電子簽署即為雙方合意。系統將於最後工作日次日 00:00 解除本人之 LINE 綁定與系統登入權限。</li>
          </ol>
        </div>

        {/* 簽署區 */}
        <div style={{ background: "#fff", borderRadius: 10, border: "2px solid #b45309", padding: 14, marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#b45309", marginBottom: 6 }}>✍️ 員工簽名</div>
          <div style={{ background: "#faf8f5", borderRadius: 6, padding: 4, position: "relative" }}>
            <canvas ref={(c) => { canvasRef.current = c; setupCanvas(c); }} style={{ width: "100%", height: 160, background: "#fff", borderRadius: 4, border: "1px dashed #ddd", touchAction: "none", display: "block" }} />
            {!hasInk && <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "#bbb", fontSize: 12, pointerEvents: "none" }}>請在此區域簽名</div>}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <button onClick={clear} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", fontSize: 11, cursor: "pointer" }}>🔄 重簽</button>
            <span style={{ fontSize: 10, color: "#888" }}>簽署日期：{new Date().toLocaleDateString("zh-TW")}</span>
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 12, fontSize: 12, cursor: "pointer", padding: 10, background: agreed ? "#e6f9f0" : "#fff", border: "1px solid " + (agreed ? "#0a7c42" : "#ddd"), borderRadius: 6 }}>
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 2 }} />
          <span>我已詳閱以上內容，確認所有資訊正確無誤，並同意以電子簽名方式簽署本離職同意書。</span>
        </label>

        <button onClick={() => alert("（預覽模式，不會實際送出）")}
          disabled={!hasInk || !agreed}
          style={{ width: "100%", padding: 14, borderRadius: 10, border: "none",
            background: (hasInk && agreed) ? "#b91c1c" : "#ccc",
            color: "#fff", fontSize: 16, fontWeight: 700,
            cursor: (hasInk && agreed) ? "pointer" : "not-allowed",
            marginTop: 12,
          }}>
          ✅ 確認簽署並送出
        </button>
        <p style={{ fontSize: 10, color: "#888", textAlign: "center", marginTop: 8 }}>送出後將無法修改，請確認資料正確</p>
      </div>
    </div>
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
