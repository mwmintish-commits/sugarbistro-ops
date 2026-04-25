"use client";
import { useState, useEffect } from "react";
import { BONUS_SECTION } from "@/lib/bonus-terms";

const FALLBACK_HB = [
  { title: "一、出勤、排班與請假", items: ["準時上班：應提前5分鐘到崗，完成更衣、儀容確認後方可開始工作。","依公司系統（QR Code）進行上下班打卡，不得代打、協助他人代打。","不得無故曠職：第一次書面警告，第二次以上得依規定解僱。","事假、病假至少提前4小時以書面（LINE群組）通知直屬主管。","病假超過3日須檢附醫院證明，否則視為事假計算。","換班須提前告知主管並經書面同意，當事雙方負連帶責任。"] },
  { title: "二、儀容與服裝規定", items: ["穿著公司制服，保持整潔無汙損。","操作食物時全程佩戴圍裙。","穿著防滑、包趾鞋，禁止穿拖鞋、涼鞋、高跟鞋。","長髮必須紮起，接觸食品時須全程配戴廚師帽或髮網。","指甲保持短、乾淨，不得塗指甲油、貼假指甲。","工作時禁止噴灑濃烈香水，上班前不得飲酒。"] },
  { title: "三、食品衛生安全規範【最高優先】", items: ["接觸食品前、如廁後、觸碰非食品物品後，務必以肥皂洗手至少20秒。","手套破損立即更換，更換工作項目前須更換新手套。","身體不適（嘔吐、腹瀉、發燒）須立即告知主管，不得接觸食品。","冷藏食材維持7°C以下，冷凍維持-18°C以下，超出範圍須立即通報。","食材須標示開封日期及效期，超過效期禁止使用。","生熟食分開保存、分開器具，嚴禁交叉污染。","不得私自使用或帶走門市食材，須經主管批准。","工作檯面、器具、設備於使用前後均須確實清潔消毒。"] },
  { title: "四、服務態度與顧客應對", items: ["面對顧客保持主動、親切、有禮之態度，微笑服務。","對顧客稱謂一律使用「您」，禁止使用粗俗語言。","接待顧客時禁止滑手機、嬉鬧、大聲喧嘩。","遇顧客投訴保持冷靜，積極傾聽，不得與顧客爭辯。","超出處理能力之情況，立即通知主管接手。","任何顧客衝突事件均須於當日以書面（日誌）記錄。"] },
  { title: "五、金錢與財務誠信【零容忍】", items: ["收款必須依POS系統操作，禁止私自調整金額或繞過系統。","任何折扣、免單、退款需取得主管當下授權。","班次結束前須完成收銀對帳，差額超過容許範圍須書面說明。","公司財物不得私自挪用或帶離門市。","竊盜、舞弊、偽造紀錄一律直接解僱並保留法律追訴權。"] },
  { title: "六、手機與社群媒體", items: ["工作期間禁止於服務區、備料區使用私人手機。","禁止在個人社群媒體發布門市內部照片、影片。","禁止發布任何對公司、同事、顧客的負面評論。","接受媒體採訪或公開代表公司發言前，須事先獲得總部書面授權。"] },
  { title: "七、職場環境與保密", items: ["禁止任何形式的霸凌、歧視、性騷擾。","禁止對外洩露公司機密（配方、成本、供應商、營業數據、客戶資料）。","離職後保密義務仍持續有效。","操作設備前須確認熟悉使用方式，設備異常立即停止使用並通報。"] },
  { title: "八、違規等級與懲處", items: ["▲ 輕微違規：口頭警告並紀錄存檔（遲到5分鐘內首次、服裝輕微不符等）","■ 中度違規：書面警告＋季考核扣分（習慣性遲到、拒絕配合主管指示等）","● 嚴重違規：停職調查或解僱＋取消季獎金（無預警曠職、嚴重食安疏失、霸凌等）","◆ 零容忍：立即解僱＋取消所有獎金＋保留法律追訴（竊盜、詐欺、舞弊、蓄意破壞等）","書面警告累積3次以上得依勞基法辦理解僱。","同一季內書面警告2次以上，當季績效獎金取消。"] },
  { title: "九、申訴與舉報", items: ["可向直屬主管提出書面申訴，主管須於5個工作日內回覆。","涉及主管本身之違規，可直接向總部提出，舉報者身分受保密保護。","公司禁止任何形式的報復行為。"] },
];

export default function EmployeeHandbook() {
  const [open, setOpen] = useState(null);
  const [eid, setEid] = useState("");
  const [sections, setSections] = useState([...FALLBACK_HB, BONUS_SECTION]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setEid(new URLSearchParams(window.location.search).get("eid") || "");
    Promise.all([
      fetch("/api/admin/system?key=handbook").then(r => r.json()).catch(() => ({})),
      fetch("/api/admin/system?key=bonus_terms").then(r => r.json()).catch(() => ({})),
    ]).then(([hbRes, btRes]) => {
      const hbVal = hbRes.data?.value;
      const btVal = btRes.data?.value;
      const hb = (Array.isArray(hbVal) && hbVal.length > 0) ? hbVal : FALLBACK_HB;
      const bonus = (btVal && btVal.title && Array.isArray(btVal.items)) ? btVal : BONUS_SECTION;
      setSections([...hb, bonus]);
      setLoading(false);
    }).catch(() => { setSections([...FALLBACK_HB, BONUS_SECTION]); setLoading(false); });
  }, []);

  const wrap = { maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "system-ui, 'Noto Sans TC', sans-serif", background: "#f7f5f0", minHeight: "100vh" };

  return (
    <div style={wrap}>
      <div style={{ background: "linear-gradient(135deg, #c2185b, #880e4f)", borderRadius: 16, padding: "16px 18px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 11, opacity: 0.85 }}>📋 員工守則</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>小食糖 Sugar Bistro</div>
        <div style={{ fontSize: 12, marginTop: 2, opacity: 0.85 }}>請詳閱並遵守各項規範</div>
      </div>

      {loading && <div style={{ textAlign: "center", color: "#888", padding: 40, fontSize: 13 }}>載入中...</div>}

      {!loading && sections.map((sec, i) => (
        <div key={i} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", marginBottom: 8, overflow: "hidden" }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", border: "none", background: "none", cursor: "pointer", textAlign: "left" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#222" }}>{sec.title}</span>
            <span style={{ fontSize: 14, color: "#888", transform: open === i ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
          </button>
          {open === i && (
            <div style={{ padding: "0 14px 12px" }}>
              {(sec.items || []).map((item, j) => (
                <div key={j} style={{ display: "flex", gap: 8, padding: "5px 0", borderTop: j === 0 ? "1px solid #f0ede8" : "none" }}>
                  <span style={{ color: "#c2185b", fontSize: 12, flexShrink: 0, marginTop: 1 }}>•</span>
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
