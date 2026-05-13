"use client";
import { useState, useEffect } from "react";
import { ap, fmt } from "./utils";

const ZONE_LABEL = { refrig: "🧊", freezer: "❄️", ambient: "🌡", display: "🪟" };

export default function OrderSuggestionsView({ sf, stores, auth }) {
  const tomorrow = () => {
    const t = new Date(Date.now() + 8 * 3600_000);
    t.setUTCDate(t.getUTCDate() + 1);
    return t.toISOString().slice(0, 10);
  };
  const [date, setDate] = useState(tomorrow());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    ap("/api/admin/inventory?type=order_suggestions&date=" + date + (sf ? "&store_id=" + sf : ""))
      .then(r => { setData(r.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(load, [date, sf]);

  const exportCSV = (grp) => {
    const rows = [["店", "類型", "品項", "區域", "現有", "標準", "預估明日銷", "已下單", "建議出貨", "單位", "預估成本"]];
    for (const it of grp.purchase) rows.push([grp.store_name, "進貨", it.name, ZONE_LABEL[it.zone] || it.zone || "", it.current_stock, it.par_level, it.estimated_demand, it.pending_qty, it.suggestion, it.unit, it.suggestion_cost]);
    for (const it of grp.production) rows.push([grp.store_name, "製作", it.name, ZONE_LABEL[it.zone] || it.zone || "", it.current_stock, it.par_level, it.estimated_demand, it.pending_qty, it.suggestion, it.unit, it.suggestion_cost]);
    const csv = "﻿" + rows.map(r => r.map(c => '"' + String(c || "").replace(/"/g, '""') + '"').join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `出貨建議_${grp.store_name}_${date}.csv`;
    a.click();
  };

  const exportAll = () => {
    const rows = [["店", "類型", "品項", "區域", "現有", "標準", "預估明日銷", "已下單", "建議出貨", "單位", "預估成本"]];
    for (const grp of data) {
      for (const it of grp.purchase) rows.push([grp.store_name, "進貨", it.name, ZONE_LABEL[it.zone] || it.zone || "", it.current_stock, it.par_level, it.estimated_demand, it.pending_qty, it.suggestion, it.unit, it.suggestion_cost]);
      for (const it of grp.production) rows.push([grp.store_name, "製作", it.name, ZONE_LABEL[it.zone] || it.zone || "", it.current_stock, it.par_level, it.estimated_demand, it.pending_qty, it.suggestion, it.unit, it.suggestion_cost]);
    }
    const csv = "﻿" + rows.map(r => r.map(c => '"' + String(c || "").replace(/"/g, '""') + '"').join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `出貨建議_全店_${date}.csv`;
    a.click();
  };

  if (loading) return <div style={{ textAlign: "center", padding: 30, color: "#aaa" }}>載入中...</div>;

  const totalItems = data.reduce((a, g) => a + g.purchase.length + g.production.length, 0);
  const totalCost = data.reduce((a, g) => a + g.totalCost, 0);
  const totalStale = data.reduce((a, g) => a + g.staleCount, 0);

  return (
    <div>
      <div style={{ background: "#fff8e6", border: "1px solid #f0e6c8", borderRadius: 8, padding: "10px 12px", marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#8a6d00" }}>📅 目標日：</span>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid #ddd", fontSize: 12 }} />
        <span style={{ fontSize: 11, color: "#666" }}>
          合計 <b>{totalItems}</b> 品項建議補貨 / 估計成本 <b>${totalCost.toLocaleString()}</b>
          {totalStale > 0 && <span style={{ color: "#b91c1c", marginLeft: 6 }}>⚠️ {totalStale} 品項超過 36 小時未盤點</span>}
        </span>
        <button onClick={exportAll} disabled={data.length === 0} style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 5, border: "1px solid #b45309", background: "#fff", color: "#b45309", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>📥 匯出全店 CSV</button>
        <button onClick={() => window.print()} style={{ padding: "5px 12px", borderRadius: 5, border: "1px solid #ddd", background: "#fff", fontSize: 11, cursor: "pointer" }}>🖨 列印</button>
      </div>

      {data.length === 0 && (
        <div style={{ background: "#fff", borderRadius: 8, padding: 30, textAlign: "center", color: "#aaa" }}>
          目前沒有需要補貨的品項，或品項未設定 par_level（標準存量）
        </div>
      )}

      {data.map(grp => (
        <div key={grp.store_id} style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8e6e1", padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>🏠 {grp.store_name}</h4>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#666" }}>{grp.purchase.length + grp.production.length} 品項 · 估 ${grp.totalCost.toLocaleString()}</span>
              {grp.staleCount > 0 && <span style={{ fontSize: 10, color: "#b91c1c", background: "#fef2f2", padding: "2px 6px", borderRadius: 3 }}>⚠️ {grp.staleCount} 品未盤點</span>}
              <button onClick={() => exportCSV(grp)} style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #b45309", background: "#fff", color: "#b45309", fontSize: 10, cursor: "pointer" }}>📥 CSV</button>
            </div>
          </div>

          {grp.purchase.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#0a7c42", marginBottom: 4, padding: "4px 8px", background: "#e6f9f0", borderRadius: 4 }}>📦 進貨類（總部送貨）{grp.purchase.length} 項</div>
              <ItemTable items={grp.purchase} />
            </div>
          )}

          {grp.production.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#7c3aed", marginBottom: 4, padding: "4px 8px", background: "#f3e8ff", borderRadius: 4 }}>🍰 現場製作類（總部備料）{grp.production.length} 項</div>
              <ItemTable items={grp.production} />
            </div>
          )}

          {grp.purchase.length === 0 && grp.production.length === 0 && (
            <div style={{ padding: 10, textAlign: "center", color: "#aaa", fontSize: 11 }}>✅ 此店所有品項都在標準量以上，無需補貨</div>
          )}
        </div>
      ))}
    </div>
  );
}

function ItemTable({ items }) {
  return (
    <div style={{ overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ background: "#faf8f5" }}>
            {["品項", "現有", "標準", "預估明日銷", "已下單", "建議出貨", "預估成本"].map(h => (
              <th key={h} style={{ padding: 6, textAlign: "left", fontWeight: 500, color: "#666", fontSize: 10 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(it => (
            <tr key={it.id} style={{ borderTop: "1px solid #f0eeea" }}>
              <td style={{ padding: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span>{ZONE_LABEL[it.zone] || ""}</span>
                  <span style={{ fontWeight: 500 }}>{it.name}</span>
                  {it.is_key_item && <span style={{ fontSize: 8, color: "#b45309", background: "#fff8e6", padding: "1px 4px", borderRadius: 3 }}>★</span>}
                  {it.stale_count && <span style={{ fontSize: 8, color: "#b91c1c", background: "#fef2f2", padding: "1px 4px", borderRadius: 3 }}>⚠️未盤</span>}
                </div>
                <div style={{ fontSize: 9, color: "#aaa" }}>
                  {it.last_count_at ? "上次盤點：" + new Date(it.last_count_at).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "尚未盤點"}
                  {it.sales_days_used > 0 && " · 銷量取近 " + it.sales_days_used + " 天平均"}
                </div>
              </td>
              <td style={{ padding: 6, textAlign: "right" }}>{it.current_stock}{it.unit}</td>
              <td style={{ padding: 6, textAlign: "right", color: "#888" }}>{it.par_level}{it.unit}</td>
              <td style={{ padding: 6, textAlign: "right", color: "#888" }}>{it.estimated_demand > 0 ? it.estimated_demand + it.unit : "—"}</td>
              <td style={{ padding: 6, textAlign: "right", color: "#888" }}>{it.pending_qty > 0 ? it.pending_qty + it.unit : "—"}</td>
              <td style={{ padding: 6, textAlign: "right", fontWeight: 700, color: "#b45309" }}>{it.suggestion}{it.unit}</td>
              <td style={{ padding: 6, textAlign: "right", color: "#666" }}>${it.suggestion_cost.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
