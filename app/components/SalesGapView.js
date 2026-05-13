"use client";
import { useState, useEffect } from "react";
import { ap } from "./utils";

export default function SalesGapView({ sf, stores, auth, load }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState({}); // {key: true} 勾選要建的品項

  const reload = () => {
    setLoading(true);
    setPicked({});
    ap("/api/admin/inventory?type=sales_gap&days=" + days + (sf ? "&store_id=" + sf : ""))
      .then(r => { setData(r.data || []); setLoading(false); });
  };

  useEffect(reload, [days, sf]);

  const createOne = async (g) => {
    if (!confirm(`新增「${g.name}」到「${g.store_name}」庫存？\n類型=完成品、單位=個、成本=0（之後可改）`)) return;
    const r = await ap("/api/admin/inventory", {
      action: "create",
      name: g.name,
      type: "finished",
      unit: "個",
      cost_per_unit: 0,
      par_level: 0,
      safe_stock: 0,
      store_id: g.store_id,
    });
    if (r.error) { alert("❌ " + r.error); return; }
    alert("✅ 已新增「" + g.name + "」");
    reload();
    load?.();
  };

  const createBulk = async () => {
    const items = data.filter(g => picked[g.store_id + "|" + g.name]);
    if (items.length === 0) { alert("請先勾選要新增的品項"); return; }
    if (!confirm(`批次新增 ${items.length} 個品項到對應門市的庫存？\n（類型=完成品、單位=個、成本=0，請新增後到「品項清單」設定詳細資料）`)) return;
    let ok = 0, fail = 0;
    for (const g of items) {
      const r = await ap("/api/admin/inventory", {
        action: "create",
        name: g.name,
        type: "finished",
        unit: "個",
        cost_per_unit: 0,
        par_level: 0,
        safe_stock: 0,
        store_id: g.store_id,
      });
      if (r.error) fail++; else ok++;
    }
    alert(`✅ 完成：成功 ${ok}、失敗 ${fail}`);
    reload();
    load?.();
  };

  if (loading) return <div style={{ padding: 30, textAlign: "center", color: "#aaa" }}>載入中...</div>;

  const totalRevenue = data.reduce((a, g) => a + g.total_revenue, 0);
  const totalQty = data.reduce((a, g) => a + g.total_qty, 0);

  return (
    <div>
      <div style={{ background: "#fef3c7", border: "1px solid #f0e6c8", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
        <div style={{ fontSize: 12, marginBottom: 4, fontWeight: 600, color: "#8a6d00" }}>
          🔍 過去 {days} 天 iChef 賣過但沒對應庫存品項
        </div>
        <div style={{ fontSize: 11, color: "#666" }}>
          這些品項沒有自動扣帳。共 {data.length} 種、總銷量 {totalQty} 個、總營收 ${totalRevenue.toLocaleString()}
        </div>
        <div style={{ marginTop: 6, fontSize: 10, color: "#888" }}>
          💡 勾選後點「批次新增」直接建為「完成品」（type=finished）。建好後系統下次拉銷售就會自動扣帳。
          詳細的單位、成本、par_level 請到「品項清單」分頁編輯。
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 11, color: "#666" }}>查近</label>
        <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid #ddd", fontSize: 11 }}>
          {[3, 7, 14, 30].map(d => <option key={d} value={d}>{d} 天</option>)}
        </select>
        <button onClick={reload} style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid #ddd", background: "#fff", fontSize: 11, cursor: "pointer" }}>🔄 重新檢核</button>
        <div style={{ marginLeft: "auto" }}>
          <button onClick={createBulk} disabled={Object.values(picked).filter(Boolean).length === 0}
            style={{ padding: "5px 12px", borderRadius: 5, border: "none", background: Object.values(picked).filter(Boolean).length > 0 ? "#0a7c42" : "#ccc", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            ✅ 批次新增 {Object.values(picked).filter(Boolean).length} 個
          </button>
        </div>
      </div>

      {data.length === 0 && (
        <div style={{ background: "#fff", borderRadius: 8, padding: 30, textAlign: "center", color: "#0a7c42" }}>
          ✅ 所有 iChef 賣過的品項都有對應庫存
        </div>
      )}

      {data.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "#faf8f5" }}>
                <th style={{ padding: 6, width: 30 }}>
                  <input type="checkbox" checked={data.length > 0 && data.every(g => picked[g.store_id + "|" + g.name])}
                    onChange={e => {
                      const next = {};
                      if (e.target.checked) for (const g of data) next[g.store_id + "|" + g.name] = true;
                      setPicked(next);
                    }} />
                </th>
                {["門市", "品項", "近 N 天銷量", "近 N 天營收", "出現天數", "操作"].map(h => (
                  <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666", fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(g => {
                const key = g.store_id + "|" + g.name;
                return (
                  <tr key={key} style={{ borderTop: "1px solid #f0eeea" }}>
                    <td style={{ padding: 6, textAlign: "center" }}>
                      <input type="checkbox" checked={!!picked[key]} onChange={e => setPicked({ ...picked, [key]: e.target.checked })} />
                    </td>
                    <td style={{ padding: 6 }}>{g.store_name}</td>
                    <td style={{ padding: 6, fontWeight: 500 }}>{g.name}</td>
                    <td style={{ padding: 6, textAlign: "right", fontWeight: 600 }}>{g.total_qty}</td>
                    <td style={{ padding: 6, textAlign: "right", color: "#0a7c42", fontWeight: 600 }}>${g.total_revenue.toLocaleString()}</td>
                    <td style={{ padding: 6, textAlign: "right", color: "#888" }}>{g.days_seen} / {days}</td>
                    <td style={{ padding: 6 }}>
                      <button onClick={() => createOne(g)} style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #0a7c42", background: "#fff", color: "#0a7c42", fontSize: 10, cursor: "pointer" }}>＋新增</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
