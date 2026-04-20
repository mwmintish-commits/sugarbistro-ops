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

export default function EmployeeHandbook() {
  const [open, setOpen] = useState(null);
  const [eid, setEid] = useState("");
  useEffect(() => {
    setEid(new URLSearchParams(window.location.search).get("eid") || "");
  }, []);
  const wrap = { maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "system-ui, 'Noto Sans TC', sans-serif", background: "#f7f5f0", minHeight: "100vh" };

  return (
    <div style={wrap}>
      <div style={{ background: "linear-gradient(135deg, #c2185b, #880e4f)", borderRadius: 16, padding: "16px 18px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 11, opacity: 0.85 }}>📋 員工守則</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>小食糖 Sugar Bistro</div>
        <div style={{ fontSize: 12, marginTop: 2, opacity: 0.85 }}>請詳閱並遵守各項規範</div>
      </div>

      {SECTIONS.map((sec, i) => (
        <div key={i} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", marginBottom: 8, overflow: "hidden" }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", border: "none", background: "none", cursor: "pointer", textAlign: "left" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#222" }}>{sec.title}</span>
            <span style={{ fontSize: 14, color: "#888", transform: open === i ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
          </button>
          {open === i && (
            <div style={{ padding: "0 14px 12px" }}>
              {sec.items.map((item, j) => (
                <div key={j} style={{ display: "flex", gap: 8, padding: "5px 0", borderTop: j === 0 ? "1px solid #f0ede8" : "none" }}>
                  <span style={{ color: "#c2185b", fontSize: 12, flexShrink: 0, marginTop: 1 }}>•</span>
                  <span style={{ fontSize: 12, color: "#444", lineHeight: 1.6 }}>{item}</span>
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
