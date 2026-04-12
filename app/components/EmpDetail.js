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
  const [docs, setDocs] = useState([]);
  const [showDoc, setShowDoc] = useState(null);
  const [form, setForm] = useState({
    role: "", employment_type: "", store_id: "",
    labor_tier: "", health_tier: "",
    labor_start_date: "", health_start_date: "", hourly_rate: "", monthly_salary: "",
    hire_date: "", annual_leave_override: ""
  });

  const reload = () => {
    ap("/api/admin/employees?id=" + empId).then(r => {
      setD(r);
      if (r.data) {
        setForm({
          role: r.data.role || "staff",
          employment_type: r.data.employment_type || "regular",
          store_id: r.data.store_id || "",
          labor_tier: r.data.labor_tier || "",
          health_tier: r.data.health_tier || "",
          labor_start_date: r.data.labor_start_date || "",
          health_start_date: r.data.health_start_date || "",
          hourly_rate: r.data.hourly_rate || "",
          monthly_salary: r.data.monthly_salary || "",
          hire_date: r.data.hire_date || "",
          annual_leave_override: ""
        });
      }
      setLd(false);
    });
    ap("/api/admin/documents?employee_id=" + empId).then(r => setDocs(r.data || [])).catch(() => {});
  };

  useEffect(() => { reload(); }, [empId]);

  const save = async () => {
    setSaving(true);
    setMsg("");
    await ap("/api/admin/employees", {
      action: "update", employee_id: empId,
      role: form.role, employment_type: form.employment_type,
      store_id: form.store_id || null,
      hire_date: form.hire_date || null,
      labor_tier: form.labor_tier ? Number(form.labor_tier) : null,
      health_tier: form.health_tier ? Number(form.health_tier) : null,
      labor_start_date: form.labor_start_date || null,
      health_start_date: form.health_start_date || null,
      hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
      monthly_salary: form.monthly_salary ? Number(form.monthly_salary) : null
    });
    // 手動調整特休天數
    if (form.annual_leave_override !== "" && form.annual_leave_override !== null) {
      await ap("/api/admin/leave-balances", {
        action: "set_annual", employee_id: empId,
        annual_total: Number(form.annual_leave_override)
      });
    }
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

        {/* 📄 文件檔案（最上方）+ 上傳功能 */}
        <div style={sec}>
          <h3 style={sh}>📄 報到文件</h3>
          {docs.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 6, marginBottom: 8 }}>
              {docs.map(doc => {
                const labels = { health_check: "🏥 體檢表", id_card_front: "🪪 身分證正", id_card_back: "🪪 身分證反", id_card: "🪪 身分證", handbook_sign: "📖 守則簽署", contract_sign: "📝 合約簽署" };
                const label = labels[doc.doc_type] || doc.doc_type;
                return (
                  <div key={doc.id} onClick={() => setShowDoc(doc)} style={{
                    background: "#fff", border: "1px solid #e8e6e1", borderRadius: 6, padding: 6,
                    textAlign: "center", cursor: "pointer", fontSize: 10
                  }}>
                    <div style={{ fontSize: 18 }}>{doc.file_url || doc.signature_url ? "📄" : "✍️"}</div>
                    <div style={{ fontWeight: 500, marginTop: 2 }}>{label}</div>
                    <div style={{ fontSize: 7, color: "#aaa" }}>{doc.created_at?.slice(0, 10)}</div>
                  </div>
                );
              })}
            </div>
          )}
          {/* 上傳按鈕 */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {[["health_check","🏥 體檢表"],["id_card_front","🪪 身分證正面"],["id_card_back","🪪 身分證反面"],["contract_sign","📝 合約"],["handbook_sign","📖 守則"]].map(([dt,lb]) => (
              <label key={dt} style={{ padding: "3px 8px", borderRadius: 4, border: "1px dashed #ccc", fontSize: 9, cursor: "pointer", color: "#4361ee" }}>
                {"📎 " + lb}
                <input type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={async (ev) => {
                  const file = ev.target.files[0]; if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async () => {
                    let url = reader.result;
                    // 圖片壓縮（max 1200px, 品質60%）
                    if (file.type.startsWith("image")) {
                      url = await new Promise(res => {
                        const img = new Image(); img.onload = () => {
                          const c = document.createElement("canvas");
                          const s = Math.min(1, 1200 / Math.max(img.width, img.height));
                          c.width = img.width * s; c.height = img.height * s;
                          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
                          res(c.toDataURL("image/jpeg", 0.6));
                        }; img.src = url;
                      });
                    }
                    const payload = dt.includes("sign") ? { employee_id: empId, doc_type: dt, signature_url: url } : { employee_id: empId, doc_type: dt, file_url: url };
                    const r = await ap("/api/admin/documents", payload);
                    if (r.error) alert("❌ " + r.error); else { alert("✅ " + lb + " 已上傳"); reload(); }
                  };
                  reader.readAsDataURL(file);
                  ev.target.value = "";
                }} />
              </label>
            ))}
          </div>
        </div>

        {/* 文件預覽彈窗 */}
        {showDoc && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={() => setShowDoc(null)}>
            <div style={{ background: "#fff", borderRadius: 10, maxWidth: 500, width: "100%", maxHeight: "80vh", overflow: "auto", padding: 16 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600 }}>
                  {({ health_check: "🏥 體檢表", id_card_front: "🪪 身分證正面", id_card_back: "🪪 身分證反面", id_card: "🪪 身分證", handbook_sign: "📖 守則簽署", contract_sign: "📝 合約簽署" })[showDoc.doc_type] || showDoc.doc_type}
                </h4>
                <button onClick={() => setShowDoc(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer" }}>✕</button>
              </div>
              {showDoc.file_url && <img src={showDoc.file_url} alt="" style={{ width: "100%", borderRadius: 6, marginBottom: 8 }} />}
              {showDoc.signature_url && <div><p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>電子簽名</p><img src={showDoc.signature_url} alt="簽名" style={{ border: "1px solid #eee", borderRadius: 6, maxWidth: 200 }} /></div>}
              {showDoc.signed_at && <p style={{ fontSize: 10, color: "#888", marginTop: 6 }}>簽署時間：{new Date(showDoc.signed_at).toLocaleString("zh-TW")}</p>}
              {showDoc.file_url && <a href={showDoc.file_url} download style={{ display: "block", textAlign: "center", marginTop: 8, padding: "8px 16px", borderRadius: 6, background: "#4361ee", color: "#fff", fontSize: 12, textDecoration: "none", fontWeight: 600 }}>📥 下載 / 列印</a>}
            </div>
          </div>
        )}

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
          <div style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 10, color: "#888" }}>到職日</label>
            <input type="date" value={form.hire_date} onChange={ev => setForm({...form, hire_date: ev.target.value})} style={inp} />
          </div>
          <Row l="年資" v={(d.service_months || 0) + "個月"} />
          <div style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 10, color: "#888" }}>{"特休天數（系統計算：" + (d.annual_leave_days || 0) + "天）"}</label>
            <input type="number" value={form.annual_leave_override}
              onChange={ev => setForm({...form, annual_leave_override: ev.target.value})}
              placeholder={"自動" + (d.annual_leave_days || 0) + "天，填數字可覆蓋"}
              style={inp} />
            <div style={{ fontSize: 9, color: "#888", marginTop: 1 }}>留空=依到職日自動計算，填數字=手動設定（舊員工導入用）</div>
          </div>
          <Row l="合約" v={e.onboarding_completed ? "✅已簽" : "❌未簽"} />
          {/* 報到連結 */}
          {!e.onboarding_completed && (
            <div style={{ marginTop: 6, padding: 8, background: "#fff8e6", borderRadius: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#8a6d00", marginBottom: 4 }}>📋 新人報到</div>
              {e.bind_code ? (
                <div>
                  <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>報到連結（傳給員工開啟）：</div>
                  <div style={{ fontSize: 10, background: "#fff", padding: 6, borderRadius: 4, border: "1px solid #ddd", wordBreak: "break-all", userSelect: "all" }}>
                    {window.location.origin + "/onboarding?token=" + e.bind_code}
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(window.location.origin + "/onboarding?token=" + e.bind_code); alert("✅ 已複製報到連結"); }}
                    style={{ marginTop: 4, padding: "3px 10px", borderRadius: 4, border: "1px solid #4361ee", background: "transparent", color: "#4361ee", fontSize: 10, cursor: "pointer" }}>📋 複製連結</button>
                </div>
              ) : (
                <button onClick={async () => {
                  const r = await ap("/api/admin/employees", { action: "generate_bind_code", employee_id: empId });
                  if (r.error) { alert("❌ " + r.error); return; }
                  alert("✅ 綁定碼：" + r.bind_code + "\n\n報到連結：\n" + window.location.origin + "/onboarding?token=" + r.bind_code);
                  reload();
                }} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#b45309", color: "#fff", fontSize: 11, cursor: "pointer" }}>
                  🔗 產生報到連結
                </button>
              )}
            </div>
          )}
          {/* 合約操作（已簽約才顯示） */}
          {(e.contract_signed || e.onboarding_completed) && (
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              <button onClick={() => {
                const cd = docs.find(d => d.doc_type === "contract_pdf");
                if (cd && cd.file_url) {
                  if (cd.file_url.startsWith("data:text/html;base64,")) {
                    const html = atob(cd.file_url.replace("data:text/html;base64,", ""));
                    const w = window.open(); w.document.write(html); w.document.close();
                  } else { window.open(cd.file_url, "_blank"); }
                } else { alert("找不到合約文件"); }
              }} style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid #4361ee", background: "#fff", color: "#4361ee", fontSize: 10, cursor: "pointer" }}>
                📄 列印合約
              </button>
              <button onClick={async () => {
                if (!e.email) { alert("此員工沒有設定 Email"); return; }
                const r = await ap("/api/admin/documents", { action: "resend_email", employee_id: empId });
                if (r.error) alert("❌ " + r.error); else alert("✅ 合約已寄至 " + e.email);
              }} style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid #0a7c42", background: "#fff", color: "#0a7c42", fontSize: 10, cursor: "pointer" }}>
                📧 重寄合約
              </button>
            </div>
          )}
          {e.probation_end_date && (
            <Row l="試用期" v={
              e.probation_status === "passed" ? "✅ 已通過" :
              e.probation_status === "failed" ? "❌ 未通過" :
              "⏳ 至 " + e.probation_end_date + (new Date(e.probation_end_date) < new Date() ? " (已到期)" : "")
            } />
          )}
        </div>

        <div style={{ ...sec, border: "2px solid #4361ee" }}>
          <h3 style={{ ...sh, color: "#4361ee" }}>🔑 權限與所屬門市</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div>
              <label style={{ fontSize: 10, color: "#888" }}>角色權限</label>
              <select value={form.role} onChange={ev => setForm({...form, role: ev.target.value})} style={inp}>
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#888" }}>僱用類型</label>
              <select value={form.employment_type} onChange={ev => setForm({...form, employment_type: ev.target.value})} style={inp}>
                <option value="regular">一般</option>
                <option value="parttime">兼職</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 6 }}>
            <label style={{ fontSize: 10, color: "#888" }}>所屬門市</label>
            <select value={form.store_id || ""} onChange={ev => setForm({...form, store_id: ev.target.value})} style={inp}>
              <option value="">🏢 總部（無門市）</option>
              {(storesRef || []).map(s => <option key={s.id} value={s.id}>{"🏠 " + s.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ ...sec, border: "2px solid #666" }}>
          <h3 style={{ ...sh, color: "#666" }}>💰 薪資設定</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div>
              <label style={{ fontSize: 10, color: "#888" }}>月薪</label>
              <input type="number" value={form.monthly_salary} onChange={ev => setForm({...form, monthly_salary: ev.target.value})} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#888" }}>時薪</label>
              <input type="number" value={form.hourly_rate} onChange={ev => setForm({...form, hourly_rate: ev.target.value})} style={inp} />
            </div>
          </div>
        </div>

        <div style={{ ...sec, border: "2px solid #b45309" }}>
          <h3 style={{ ...sh, color: "#b45309" }}>🛡️ 勞健保設定</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
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
                {TIERS_R.map(([i, r]) => <option key={i} value={i}>{tierLabel(i, r)}</option>)}
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
