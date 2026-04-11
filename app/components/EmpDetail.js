"use client";
import { useState, useEffect } from "react";
import { ap, fmt, Row, ROLES, RB, TIERS_R, TIERS_P, tierLabel } from "./utils";

const modal = {
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(0,0,0,0.5)", display: "flex",
  alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16
};
const mbox = {
  background: "#fff", borderRadius: 14, maxWidth: 480,
  width: "100%", maxHeight: "85vh", overflow: "auto", padding: "20px 18px"
};
const sec = { marginBottom: 14, padding: "10px 12px", background: "#faf8f5", borderRadius: 8 };
const sh = { fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#444" };
const inp = { width: "100%", padding: "5px 8px", borderRadius: 5, border: "1px solid #ddd", fontSize: 12 };

export default function EmpDetail({ empId, onClose, storesRef }) {
  const [d, setD] = useState(null);
  const [ld, setLd] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    role: "", employment_type: "", labor_tier: "", health_tier: "",
    labor_start_date: "", health_start_date: "", hourly_rate: "", monthly_salary: ""
  });

  const reload = () => {
    ap("/api/admin/employees?id=" + empId).then(r => {
      setD(r);
      if (r.data) {
        setForm({
          role: r.data.role || "staff",
          employment_type: r.data.employment_type || "regular",
          labor_tier: r.data.labor_tier || "",
          health_tier: r.data.health_tier || "",
          labor_start_date: r.data.labor_start_date || "",
          health_start_date: r.data.health_start_date || "",
          hourly_rate: r.data.hourly_rate || "",
          monthly_salary: r.data.monthly_salary || ""
        });
      }
      setLd(false);
    });
  };

  useEffect(() => { reload(); }, [empId]);

  const save = async () => {
    setSaving(true);
    setMsg("");
    await ap("/api/admin/employees", {
      action: "update", employee_id: empId,
      role: form.role, employment_type: form.employment_type,
      labor_tier: form.labor_tier ? Number(form.labor_tier) : null,
      health_tier: form.health_tier ? Number(form.health_tier) : null,
      labor_start_date: form.labor_start_date || null,
      health_start_date: form.health_start_date || null,
      hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
      monthly_salary: form.monthly_salary ? Number(form.monthly_salary) : null
    });
    setMsg("✅ 已儲存");
    setSaving(false);
    reload();
  };

  if (ld || !d?.data) {
    return (
      <div style={modal}>
        <div style={mbox}>
          <p style={{ textAlign: "center", color: "#aaa" }}>載入中...</p>
        </div>
      </div>
    );
  }

  const e = d.data;
  const laborSelf = e.labor_self_amount || 0;
  const healthSelf = e.health_self_amount || 0;

  return (
    <div style={modal} onClick={onClose}>
      <div style={mbox} onClick={ev => ev.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{"👤 " + e.name}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        <div style={sec}>
          <h3 style={sh}>基本資料</h3>
          <Row l="門市" v={e.stores ? e.stores.name : "總部"} />
          <Row l="手機" v={e.phone} />
          <Row l="Email" v={e.email} />
          <Row l="生日" v={e.birthday} />
          <Row l="身分證" v={e.id_number} />
          <Row l="LINE" v={e.line_uid ? "✅已綁定" : "❌未綁定"} />
          <Row l="帳號" v={e.is_active ? "✅啟用" : "❌停用"} />
        </div>

        <div style={sec}>
          <h3 style={sh}>在職資訊</h3>
          <Row l="到職日" v={e.hire_date} />
          <Row l="年資" v={(d.service_months || 0) + "個月"} />
          <Row l="特休" v={(d.annual_leave_days || 0) + "天"} />
          <Row l="合約" v={e.onboarding_completed ? "✅已簽" : "❌未簽"} />
        </div>

        <div style={{ ...sec, border: "2px solid #4361ee" }}>
          <h3 style={sh}>角色與薪資設定</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div>
              <label style={{ fontSize: 10, color: "#888" }}>角色</label>
              <select value={form.role} onChange={ev => setForm({...form, role: ev.target.value})} style={inp}>
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#888" }}>類型</label>
              <select value={form.employment_type} onChange={ev => setForm({...form, employment_type: ev.target.value})} style={inp}>
                <option value="regular">一般</option>
                <option value="parttime">兼職</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#888" }}>月薪</label>
              <input type="number" value={form.monthly_salary} onChange={ev => setForm({...form, monthly_salary: ev.target.value})} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#888" }}>時薪</label>
              <input type="number" value={form.hourly_rate} onChange={ev => setForm({...form, hourly_rate: ev.target.value})} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#888" }}>勞保級距</label>
              <select value={form.labor_tier} onChange={ev => setForm({...form, labor_tier: ev.target.value})} style={inp}>
                <option value="">未設定</option>
                {TIERS_R.map(([i, r]) => <option key={i} value={i}>{tierLabel(i, r)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#888" }}>健保級距</label>
              <select value={form.health_tier} onChange={ev => setForm({...form, health_tier: ev.target.value})} style={inp}>
                <option value="">未設定</option>
                {TIERS_P.map(([i, r]) => <option key={i} value={i}>{tierLabel(i, r)}</option>)}
              </select>
            </div>
          </div>
          {(laborSelf > 0 || healthSelf > 0) && (
            <div style={{ marginTop: 6, fontSize: 10, color: "#666" }}>
              {"自付額：勞保 $" + laborSelf + " / 健保 $" + healthSelf}
            </div>
          )}
        </div>

        <button onClick={save} disabled={saving} style={{
          width: "100%", padding: "10px", borderRadius: 8, border: "none",
          background: saving ? "#ccc" : "#0a7c42", color: "#fff",
          fontSize: 14, fontWeight: 600, cursor: "pointer"
        }}>
          {saving ? "儲存中..." : "💾 儲存所有變更"}
        </button>
        {msg && <p style={{ textAlign: "center", fontSize: 12, color: "#0a7c42", marginTop: 4 }}>{msg}</p>}

        <div style={{ marginTop: 10, display: "flex", gap: 4, flexWrap: "wrap" }}>
          <select onChange={async (ev) => {
            if (!ev.target.value) return;
            if (!confirm("確定調到此門市？")) { ev.target.value = ""; return; }
            await ap("/api/admin/employees", { action: "update", employee_id: empId, store_id: ev.target.value });
            alert("已調店");
            ev.target.value = "";
            reload();
          }} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #4361ee", fontSize: 10, color: "#4361ee" }}>
            <option value="">{"🔄 調店..."}</option>
            {(storesRef || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <button onClick={async () => {
            if (!confirm("確定解除LINE綁定？")) return;
            await ap("/api/admin/employees", { action: "update", employee_id: empId, line_uid: null });
            alert("已解除");
            reload();
          }} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #b45309", background: "transparent", color: "#b45309", fontSize: 10, cursor: "pointer" }}>
            {"🔓 解除LINE"}
          </button>

          <button onClick={async () => {
            const ph = prompt("輸入新手機號碼：");
            if (ph) {
              await ap("/api/admin/employees", { action: "update", employee_id: empId, phone: ph });
              alert("已更新");
              reload();
            }
          }} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #666", background: "transparent", color: "#666", fontSize: 10, cursor: "pointer" }}>
            {"📱 換手機"}
          </button>

          <button onClick={async () => {
            const lastDay = prompt("離職日期（YYYY-MM-DD）：");
            if (!lastDay) return;
            const reason = prompt("離職原因（選填）：") || "";
            const r = await ap("/api/admin/leave-balances?employee_id=" + empId + "&year=" + new Date().getFullYear());
            const remaining = r.data ? r.data.annual_remaining || 0 : 0;
            const dailyPay = e.monthly_salary ? Math.round(e.monthly_salary / 30) : (e.hourly_rate ? e.hourly_rate * 8 : 0);
            const settlement = remaining * dailyPay;
            const months = d.service_months || 0;
            const notice = months < 3 ? 0 : months < 12 ? 10 : months < 36 ? 20 : 30;
            if (!confirm(
              e.name + " 離職作業\n\n" +
              "📅 離職日：" + lastDay + "\n" +
              "⏰ 預告期：" + notice + "天\n" +
              "🏖 未休特休：" + remaining + "天\n" +
              "💰 折算：$" + settlement.toLocaleString() + "\n\n確定？"
            )) return;
            await ap("/api/admin/employees", {
              action: "update", employee_id: empId,
              resignation_date: lastDay, resignation_reason: reason,
              last_working_date: lastDay, line_uid: null, is_active: false
            });
            if (settlement > 0) {
              await ap("/api/admin/payments", {
                action: "create", type: "leave_settlement",
                employee_id: empId, amount: settlement,
                recipient: e.name,
                notes: "離職特休結算 " + remaining + "天",
                month_key: lastDay.slice(0, 7)
              });
            }
            alert("離職完成，特休$" + settlement.toLocaleString() + "已入撥款");
            onClose();
          }} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #b91c1c", background: "transparent", color: "#b91c1c", fontSize: 10, cursor: "pointer" }}>
            {"🚪 離職作業"}
          </button>
        </div>
      </div>
    </div>
  );
}
