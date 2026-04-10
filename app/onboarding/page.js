"use client";
import { useState, useEffect, useRef } from "react";

const HANDBOOK = [
  { title: "一、出勤、排班與請假", sections: [
    { sub: "1.1 基本出勤規定", items: ["準時上班：應提前 5 分鐘到崗，完成更衣、儀容確認後方可開始工作。","打卡規定：依公司系統進行上下班打卡，不得代打、協助他人代打。","不得無故曠職：曠職視為嚴重違規，第一次書面警告，第二次以上得依規定解僱。"] },
    { sub: "1.2 請假規定", items: ["事假、病假：應至少提前 4 小時以書面（LINE 群組）通知直屬主管。","病假超過 3 日：須檢附醫院證明，否則視為事假計算。","未核假擅自不到班：視曠職處理。","換班：須提前告知主管並經書面同意，當事雙方負連帶責任。"] },
  ]},
  { title: "二、儀容與服裝規定", sections: [
    { sub: "2.1 服裝", items: ["穿著公司制服，保持整潔無汙損。","圍裙：操作食物時全程佩戴。","鞋類：穿著防滑、包趾鞋，禁止拖鞋、涼鞋、高跟鞋。","非必要飾品一律禁止配戴（操作食品區域）。"] },
    { sub: "2.2 個人衛生", items: ["長髮必須紮起，接觸食品時配戴廚師帽或髮網。","指甲保持短、乾淨，不得塗指甲油或貼假指甲。","工作時禁止噴灑濃烈香水。","上班前不得飲酒，到班時不得有酒味。"] },
  ]},
  { title: "三、食品衛生安全規範【最高優先等級】", warn: true, sections: [
    { sub: "3.1 個人衛生操作", items: ["接觸食品前、如廁後務必以肥皂洗手至少 20 秒。","手套破損立即更換，更換工作項目前須更換新手套。","身體不適須立即告知主管，不得接觸食品。","工作中禁止觸碰臉、頭髮、鼻子。"] },
    { sub: "3.2 食材保存", items: ["冷藏 7°C 以下，冷凍 -18°C 以下。","食材標示開封日期及效期，超過效期禁止使用。","生熟食分開保存、分開器具。","不得私自使用或帶走門市食材。"] },
    { sub: "3.3 環境清潔", items: ["工作檯面、器具使用前後清潔消毒。","廚餘、垃圾及時處理。","發現蟲害、異物立即通報主管。"] },
  ]},
  { title: "四、服務態度與顧客應對", sections: [
    { sub: "4.1 基本服務規範", items: ["面對顧客保持主動、親切、微笑服務。","對顧客稱謂使用「您」，禁止粗俗語言。","接待顧客時禁止滑手機、嬉鬧。","顧客等候超過合理時間，應主動致歉。"] },
    { sub: "4.2 顧客投訴處理", items: ["保持冷靜，積極傾聽，不得與顧客爭辯。","超出處理能力立即通知主管。","衝突事件當日書面記錄。","禁止在社群媒體討論顧客投訴。"] },
  ]},
  { title: "五、金錢與財務誠信【零容忍政策】", warn: true, sections: [
    { sub: "5.1 收款操作", items: ["收款必須依 POS 系統操作。","折扣、免單、退款需主管授權。","班次結束前完成收銀對帳。","禁止私自收受顧客小費。"] },
    { sub: "5.2 財物誠信", items: ["公司財物不得私自挪用或帶離。","發現不誠信行為有責任向主管反映。","禁止向廠商索取回扣。"] },
  ]},
  { title: "六、手機與社群媒體使用", sections: [
    { sub: "6.1 工作時間手機", items: ["工作期間禁止於服務區使用私人手機。","手機限於休息時間在指定區域使用。"] },
    { sub: "6.2 社群媒體", items: ["禁止發布門市內部照片、影片。","禁止發布對公司、同事、顧客的負面評論。","接受媒體採訪需事先獲總部授權。"] },
  ]},
  { title: "七、職場環境與同仁相處", sections: [
    { sub: "7.1 職場尊重", items: ["禁止霸凌、歧視、性騷擾。","衝突應報告主管，禁止在工作區域爭執。"] },
    { sub: "7.2 保密義務", items: ["禁止洩露配方、成本、供應商、營業數據、客戶資料。","離職後保密義務仍持續有效。"] },
    { sub: "7.3 設備維護", items: ["不確定設備使用方式時主動詢問主管。","人為疏失損壞視情節要求賠償。","設備異常立即停止使用並通報。"] },
  ]},
  { title: "八、違規等級與懲處標準", sections: [
    { sub: "違規等級", items: [
      "▲ 輕微違規（遲到5分鐘內/首次、儀容輕微不符）→ 口頭警告",
      "■ 中度違規（遲到15分鐘以上、拒絕配合指示、未依SOP操作）→ 書面警告＋季考核扣分",
      "● 嚴重違規（無預警曠職、嚴重食安疏失、霸凌）→ 停職調查或解僱",
      "◆ 零容忍（竊盜、詐欺、舞弊、蓄意破壞）→ 立即解僱＋法律追訴",
      "書面警告累積 3 次：得依勞基法辦理解僱",
    ] },
  ]},
  { title: "九、申訴與舉報機制", sections: [
    { sub: "申訴管道", items: ["向直屬主管提出書面申訴，5 個工作日內回覆。","涉及主管本身可直接向總部提出。","懲處結果異議可於 5 個工作日內書面提出。","公司禁止任何報復行為。"] },
  ]},
  { title: "十、規範生效與簽署確認", sections: [
    { sub: "", items: ["本規範自 2026 年起正式施行。","所有同仁於到職時須簽署確認。","公司保有隨時修訂之權利。"] },
  ]},
];

export default function OnboardingPage() {
  const [token, setToken] = useState(null);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sigName, setSigName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    if (!t) { setError("缺少 Token"); setLoading(false); return; }
    setToken(t);
    fetch(`/api/onboarding?token=${t}`).then(r => r.json()).then(d => {
      if (d.error) setError(d.error);
      else { setRecord(d.data); if (d.data.status === "signed") setDone(true); }
      setLoading(false);
    }).catch(() => { setError("載入失敗"); setLoading(false); });
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setScrolled(true); }, { threshold: 0.5 });
    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [record]);

  const submit = async () => {
    setSubmitting(true);
    const res = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sign", token, signature_name: sigName }) });
    const d = await res.json();
    if (d.success) setDone(true);
    else setError(d.error);
    setSubmitting(false);
  };

  if (loading) return <div style={S.center}>載入中...</div>;
  if (error) return <div style={S.center}><div style={S.error}>{error}</div></div>;

  if (done) return (
    <div style={S.container}><div style={S.center}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>簽署完成</h1>
      <p style={{ fontSize: 14, color: "#666" }}>歡迎加入小食糖！</p>
      <p style={{ fontSize: 13, color: "#999", marginTop: 8 }}>請等待主管為你開通系統帳號。</p>
    </div></div>
  );

  return (
    <div style={S.container}>
      <div style={{ textAlign: "center", marginBottom: 20, padding: "20px 0" }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🍯</div>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>小食糖 SUGARbISTRO</h1>
        <h2 style={{ fontSize: 15, fontWeight: 500, color: "#666" }}>員工行為規範與工作守則</h2>
        <p style={{ fontSize: 12, color: "#999", marginTop: 8 }}>👤 {record?.name}｜🏠 {record?.store_name}</p>
        <p style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>請完整閱讀以下內容後簽署確認</p>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", padding: "20px 16px", marginBottom: 16 }}>
        <p style={{ fontSize: 13, lineHeight: 1.8, color: "#444", marginBottom: 16 }}>
          小食糖 SUGARbISTRO 致力提供每位顧客高品質的台式甜點體驗。本守則作為全體同仁的共同承諾，<b>所有人員於到職日起即受本規範約束</b>，違反規定者依本文所列違規等級處理。
        </p>

        {HANDBOOK.map((ch, ci) => (
          <div key={ci} style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: ch.warn ? "#b91c1c" : "#1a1a1a", padding: "8px 12px", background: ch.warn ? "#fde8e8" : "#faf8f5", borderRadius: 8 }}>
              {ch.title}
            </h3>
            {ch.sections.map((sec, si) => (
              <div key={si} style={{ marginBottom: 12, paddingLeft: 8 }}>
                {sec.sub && <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#444" }}>{sec.sub}</h4>}
                {sec.items.map((item, ii) => (
                  <div key={ii} style={{ fontSize: 12, lineHeight: 1.8, color: "#555", paddingLeft: 12, position: "relative", marginBottom: 2 }}>
                    <span style={{ position: "absolute", left: 0 }}>▸</span>{item}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}

        <div ref={bottomRef} style={{ height: 1 }} />
      </div>

      {/* 簽署區 */}
      <div style={{ background: "#fff", borderRadius: 12, border: scrolled ? "2px solid #0a7c42" : "1px solid #e8e6e1", padding: "20px 16px", opacity: scrolled ? 1 : 0.5, transition: "all 0.3s" }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, textAlign: "center" }}>📝 電子簽署確認</h3>

        {!scrolled && <p style={{ fontSize: 12, color: "#b45309", textAlign: "center", marginBottom: 12 }}>⬇ 請先閱讀完整守則內容（滾動到底部）</p>}

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>簽署姓名（請輸入你的全名）</label>
          <input value={sigName} onChange={e => setSigName(e.target.value)} placeholder={record?.name || ""} disabled={!scrolled}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", fontSize: 15, textAlign: "center" }} />
        </div>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 16, cursor: scrolled ? "pointer" : "default" }}>
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} disabled={!scrolled}
            style={{ marginTop: 3, width: 18, height: 18 }} />
          <span style={{ fontSize: 12, lineHeight: 1.6, color: "#444" }}>
            本人已詳細閱讀「小食糖 SUGARbISTRO 員工行為規範與工作守則」全文，瞭解並同意遵守所有規定。本人理解違反規定將依據本守則所列懲處標準處理。
          </span>
        </label>

        <button onClick={submit} disabled={!scrolled || !sigName || !agreed || submitting}
          style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", fontSize: 15, fontWeight: 600, cursor: scrolled && sigName && agreed ? "pointer" : "default",
            background: scrolled && sigName && agreed ? "#0a7c42" : "#ccc", color: "#fff" }}>
          {submitting ? "簽署中..." : "✅ 確認簽署"}
        </button>

        <p style={{ fontSize: 10, color: "#999", textAlign: "center", marginTop: 8 }}>
          簽署時間將被記錄 ｜ 本規範正本由總部存檔
        </p>
      </div>
    </div>
  );
}

const S = {
  container: { maxWidth: 480, margin: "0 auto", padding: "16px 12px", fontFamily: "system-ui, 'Noto Sans TC', sans-serif", background: "#faf8f5", minHeight: "100vh" },
  center: { minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
  error: { background: "#fde8e8", color: "#b91c1c", padding: 14, borderRadius: 8, fontSize: 13 },
};
