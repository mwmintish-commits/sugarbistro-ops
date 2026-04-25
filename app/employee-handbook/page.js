"use client";
import { useState, useEffect } from "react";
import { BONUS_SECTION } from "@/lib/bonus-terms";

const FALLBACK = [
  { title: "守則內容載入中", items: ["請稍候..."] },
];

export default function EmployeeHandbook() {
  const [open, setOpen] = useState(null);
  const [eid, setEid] = useState("");
  const [sections, setSections] = useState(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setEid(new URLSearchParams(window.location.search).get("eid") || "");
    Promise.all([
      fetch("/api/admin/system?key=handbook").then(r => r.json()).catch(() => ({})),
      fetch("/api/admin/system?key=bonus_terms").then(r => r.json()).catch(() => ({})),
    ]).then(([hbRes, btRes]) => {
      const hbVal = hbRes.data?.value;
      const btVal = btRes.data?.value;
      const hb = (Array.isArray(hbVal) && hbVal.length > 0) ? hbVal : [];
      const bonus = (btVal && btVal.title && Array.isArray(btVal.items)) ? btVal : BONUS_SECTION;
      setSections([...hb, bonus]);
      setLoading(false);
    }).catch(() => { setSections([BONUS_SECTION]); setLoading(false); });
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
