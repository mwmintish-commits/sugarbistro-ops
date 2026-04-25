"use client";
import { useState, useEffect } from "react";

const SECTIONS = [
  {
    title: "🕐 工作時間與排班",
    items: [
      "依門市排班為準，每月底公布下月班表",
      "上班前 5 分鐘到崗準備，不得無故遲到早退",
      "更換班次須提前 48 小時告知主管，並確認對方同意",
      "排班如有疑問請向店長反映，不得自行更換",
    ],
  },
  {
    title: "⏱ 打卡規定",
    items: [
      "上下班均須 GPS 打卡，忘打卡請當天補登申請",
      "遲到 15 分鐘以上視為遲到，計入考核紀錄",
      "無故缺勤（未打卡且未請假）將依規定處理",
      "補打卡申請超過 3 天後不予受理",
    ],
  },
  {
    title: "🏖 請假規定",
    items: [
      "請假須提前 1 天（急病除外）透過系統申請",
      "特休依年資累積，未休特休依法規處理",
      "病假需附診斷書（連續 3 天以上）",
      "連假期間（國定假日前後）請假需提前 1 週申請",
    ],
  },
  {
    title: "👔 儀容與服裝",
    items: [
      "上班須穿著公司制服，保持整潔",
      "頭髮須整齊束好，不得散髮作業",
      "禁止佩戴過多飾品，以安全為優先",
      "指甲須修短並保持清潔",
    ],
  },
  {
    title: "📱 手機使用",
    items: [
      "上班時間禁止使用個人手機（緊急聯絡除外）",
      "休息時間可在指定區域使用手機",
      "禁止在工作區域拍照，客人隱私優先",
    ],
  },
  {
    title: "🍵 服務與品質",
    items: [
      "以笑容迎接每位客人，使用親切話語",
      "商品出餐前需確認品質，不合格不得出餐",
      "收銀找零須仔細確認，避免差錯",
      "客訴發生時保持冷靜，立即告知主管處理",
    ],
  },
  {
    title: "🔒 保密與職業道德",
    items: [
      "不得外洩公司食譜、成本、營業額等機密",
      "不得在社群媒體發布公司內部相關內容",
      "離職後保密義務仍然有效",
    ],
  },
  {
    title: "⚠️ 違規處理",
    items: [
      "輕微違規（遲到、儀容不符）：口頭警告→書面警告",
      "嚴重違規（盜竊、打架、洩密）：直接解僱",
      "考核連續兩季 D 等：進入績效改善計畫",
    ],
  },
];

const BONUS_SECTIONS = [
  {
    title: "一、季績效獎金",
    items: [
      "適用範圍：全體正式員工（試用期不納入），以季為單位計算並發放。",
      "業績達標率：各門市依每日營業目標計算月達標率，達 85% 以上方可發放，120% 以上額外加成。",
      "季末考核：個人考核滿分 100 分，涵蓋出勤、完成度、服務態度與違規紀錄。80 分以上全額、70~79 分發放 50%、未達 70 分取消資格。",
      "發放條件：季度累計營收不得虧損；發放日仍在職且未提離職方可領取；個人考核須達 70 分以上。",
    ],
  },
  {
    title: "二、三節獎金（端午、中秋、農曆年）",
    items: [
      "屬恩惠性、獎勵性給與，非經常性薪資，不構成勞動契約之必然義務。",
      "金額及發放與否依公司當年度營運盈餘、個人考核、服務年資綜合決定，公司保留最終裁量權。",
      "到職未滿 3 個月者不予發放；3~12 個月者依在職月數按比例發放。",
      "發放日當日須仍在職且未提出離職、未受懲戒處分者方可領取；於發放日前離職者不得溯及補發。",
    ],
  },
  {
    title: "三、年終獎金",
    items: [
      "屬恩惠性、獎勵性給與，非勞動基準法第 29 條所定之分配紅利或經常性薪資。",
      "發放金額、月數及時點，由公司依當年度獲利狀況、營運計畫及個人績效綜合裁量，並非保證每年發放。",
      "通常於農曆年前發放；發放日仍在職、未提出離職且未受重大懲戒處分者方可領取。",
      "到職未滿一個完整年度者，得依在職月數按比例計算或不予發放，由公司決定。",
    ],
  },
  {
    title: "四、員工聚餐、旅遊、教育訓練及其他福利",
    items: [
      "屬員工關係維繫性質之福利活動，非勞動契約義務，亦不屬工資。",
      "舉辦次數、時間、地點、金額，由公司依年度預算及營運狀況決定，得隨時調整、延期或停辦。",
      "員工選擇不參加者，公司無補貼、折換現金或其他補償義務。",
    ],
  },
  {
    title: "五、共通法律聲明 ⚠️",
    warn: true,
    items: [
      "上開各項獎金與福利，全部屬「恩惠性給與」（discretionary bonus），非勞動基準法第 2 條第 3 款所稱之工資，不計入平均工資、退休金提繳工資、資遣費及加班費基數。",
      "公司基於誠信原則，保有依市場環境、營運狀況、法令變更或個人表現，調整、暫停、變更或終止上述任一制度之最終裁量權，毋須個別徵得員工同意。",
      "本制度之歷次發放，不構成默示或明示之勞動條件約定，員工不得以「過往慣例」主張請求權。",
      "如因不可抗力（疫情、天災、重大商業變故等）致公司營運受嚴重影響，公司得暫停或取消當期發放，員工同意拋棄相關請求權。",
    ],
  },
];

export default function EmployeeHandbook() {
  const [tab, setTab] = useState("rules");
  const [open, setOpen] = useState(null);
  const [eid, setEid] = useState("");
  useEffect(() => {
    setEid(new URLSearchParams(window.location.search).get("eid") || "");
  }, []);
  const wrap = { maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "system-ui, 'Noto Sans TC', sans-serif", background: "#f7f5f0", minHeight: "100vh" };

  const sections = tab === "rules" ? SECTIONS : BONUS_SECTIONS;

  return (
    <div style={wrap}>
      <div style={{ background: "linear-gradient(135deg, #c2185b, #880e4f)", borderRadius: 16, padding: "16px 18px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 11, opacity: 0.85 }}>📋 員工手冊</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>小食糖 Sugar Bistro</div>
        <div style={{ fontSize: 12, marginTop: 2, opacity: 0.85 }}>請詳閱並遵守各項規範</div>
      </div>

      {/* Tab 切換 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[
          { k: "rules", l: "📖 工作守則" },
          { k: "bonus", l: "🏆 獎金與福利" },
        ].map(t => (
          <button key={t.k} onClick={() => { setTab(t.k); setOpen(null); }}
            style={{
              flex: 1, padding: "10px 8px", borderRadius: 10,
              border: "1px solid " + (tab === t.k ? "#880e4f" : "#e8e6e1"),
              background: tab === t.k ? "#880e4f" : "#fff",
              color: tab === t.k ? "#fff" : "#666",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>{t.l}</button>
        ))}
      </div>

      {tab === "bonus" && (
        <div style={{ background: "#fff8e6", border: "1px solid #f5d589", borderRadius: 10, padding: "10px 12px", marginBottom: 10, fontSize: 11, lineHeight: 1.7, color: "#8a6d00" }}>
          💡 本頁所列各項獎金與福利，全部屬<b>恩惠性給與</b>，非勞動基準法所定經常性薪資。公司保留最終調整、停發之裁量權，員工不得以過往發放慣例主張請求權。報到時已簽署同意。
        </div>
      )}

      {sections.map((sec, i) => (
        <div key={i} style={{ background: "#fff", borderRadius: 12, border: "1px solid " + (sec.warn ? "#fca5a5" : "#e8e6e1"), marginBottom: 8, overflow: "hidden" }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", border: "none", background: sec.warn ? "#fef2f2" : "none", cursor: "pointer", textAlign: "left" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: sec.warn ? "#b91c1c" : "#222" }}>{sec.title}</span>
            <span style={{ fontSize: 14, color: "#888", transform: open === i ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
          </button>
          {open === i && (
            <div style={{ padding: "0 14px 12px" }}>
              {sec.items.map((item, j) => (
                <div key={j} style={{ display: "flex", gap: 8, padding: "5px 0", borderTop: j === 0 ? "1px solid #f0ede8" : "none" }}>
                  <span style={{ color: sec.warn ? "#b91c1c" : "#c2185b", fontSize: 12, flexShrink: 0, marginTop: 1 }}>•</span>
                  <span style={{ fontSize: 12, color: "#444", lineHeight: 1.7 }}>{item}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div style={{ marginTop: 14, background: "#fff3e0", borderRadius: 10, padding: 12, fontSize: 11, color: "#e65100", textAlign: "center" }}>
        如有任何疑問，請向店長或總部反映
      </div>

      <div style={{ marginTop: 12, textAlign: "center" }}>
        <a href={`/me?eid=${eid}`} style={{ fontSize: 12, color: "#880e4f" }}>← 回面板</a>
      </div>
    </div>
  );
}
