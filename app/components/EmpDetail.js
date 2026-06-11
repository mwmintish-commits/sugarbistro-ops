"use client";
import { useState, useEffect } from "react";
import { ap, fmt, Row, ROLES, RB, TIERS_R, TIERS_P, tierLabel, pickLaborSelf, pickHealthSelf, INSURANCE_TIERS, INSURANCE_TIERS_PT } from "./utils";

const modal = {
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(0,0,0,0.5)", display: "flex",
  alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16
};
const mbox = {
  background: "#fff", borderRadius: 14, maxWidth: 480,
  width: "100%", maxHeight: "85vh", overflow: "auto", padding: "20px 18px"
};
const sec = { marginBottom: 14, padding: "10px 12px", background: "var(--surface-warm)", borderRadius: 8 };
const sh = { fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text-2)" };
const inp = { width: "100%", padding: "5px 8px", borderRadius: 5, border: "1px solid var(--border)", fontSize: 12 };

export default function EmpDetail({ empId, onClose, storesRef, auth }) {
  const [d, setD] = useState(null);
  const [ld, setLd] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [docs, setDocs] = useState([]);
  const [showDoc, setShowDoc] = useState(null);
  const [backfillForm, setBackfillForm] = useState(null); // null = closed, {} = open
  const [backfillSaving, setBackfillSaving] = useState(false);
  const [form, setForm] = useState({
    role: "", employment_type: "", store_id: "",
    labor_tier: "", health_tier: "",
    labor_self_override: "", health_self_override: "", health_insured_here: true,
    labor_start_date: "", health_start_date: "", hourly_rate: "", monthly_salary: "",
    hire_date: "", annual_leave_override: "",
    phone: "", email: "", birthday: "", id_number: "", address: "",
    emergency_contact: "", emergency_phone: "", bank_name: "", bank_account: "",
    name: ""
  });

  const reload = () => {
    // 兩個 fetch 並行 + 8 秒 timeout，避免「載入中」卡住
    const withTimeout = (p, ms) => Promise.race([
      p,
      new Promise(res => setTimeout(() => res({ error: "載入逾時 " + (ms/1000) + " 秒（網路不穩，請重試）" }), ms)),
    ]);
    setLd(true);
    setMsg("");
    Promise.all([
      withTimeout(ap("/api/admin/employees?id=" + empId), 8000),
      withTimeout(ap("/api/admin/documents?employee_id=" + empId), 8000).catch(() => ({ data: [] })),
    ]).then(([r, docsRes]) => {
      setD(r);
      if (r?.error) {
        setMsg("❌ " + r.error);
      } else if (r?.data) {
        setForm({
          role: r.data.role || "staff",
          employment_type: r.data.employment_type || "regular",
          store_id: r.data.store_id || "",
          labor_tier: r.data.labor_tier || "",
          health_tier: r.data.health_tier || "",
          labor_self_override: r.data.labor_self_override ?? "",
          health_self_override: r.data.health_self_override ?? "",
          health_insured_here: r.data.health_insured_here !== false,
          labor_start_date: r.data.labor_start_date || "",
          health_start_date: r.data.health_start_date || "",
          hourly_rate: r.data.hourly_rate || "",
          monthly_salary: r.data.monthly_salary || "",
          hire_date: r.data.hire_date || "",
          annual_leave_override: "",
          phone: r.data.phone || "", email: r.data.email || "",
          birthday: r.data.birthday || "", id_number: r.data.id_number || "",
          address: r.data.address || "",
          emergency_contact: r.data.emergency_contact || "", emergency_phone: r.data.emergency_phone || "",
          bank_name: r.data.bank_name || "", bank_account: r.data.bank_account || "",
          name: r.data.name || "",
        });
      }
      setDocs(docsRes?.data || []);
      setLd(false);
    });
  };

  useEffect(() => { reload(); }, [empId]);

  const save = async () => {
    setSaving(true);
    setMsg("");
    await ap("/api/admin/employees", {
      action: "update", employee_id: empId,
      name: form.name || null,
      role: form.role, employment_type: form.employment_type,
      store_id: form.store_id || null,
      hire_date: form.hire_date || null,
      phone: form.phone || null, email: form.email || null,
      birthday: form.birthday || null, id_number: form.id_number || null,
      address: form.address || null,
      emergency_contact: form.emergency_contact || null, emergency_phone: form.emergency_phone || null,
      bank_name: form.bank_name || null, bank_account: form.bank_account || null,
      labor_tier: form.labor_tier ? Number(form.labor_tier) : null,
      health_tier: form.health_tier ? Number(form.health_tier) : null,
      labor_self_override: form.labor_self_override === "" ? null : Number(form.labor_self_override),
      health_self_override: form.health_self_override === "" ? null : Number(form.health_self_override),
      health_insured_here: form.health_insured_here !== false,
      labor_start_date: form.labor_start_date || null,
      health_start_date: form.health_start_date || null,
      hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
      monthly_salary: form.monthly_salary ? Number(form.monthly_salary) : null,
      _admin_name: auth?.name || null,
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

  if (ld) {
    return (
      <div style={modal}>
        <div style={mbox}>
          <p style={{ textAlign: "center", color: "var(--text-hint)" }}>載入中...</p>
        </div>
      </div>
    );
  }
  if (!d?.data) {
    return (
      <div style={modal}>
        <div style={mbox}>
          <div style={{ textAlign: "center", padding: "20px 10px" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
            <p style={{ color: "var(--danger)", marginBottom: 12 }}>{msg || (d?.error ? "❌ " + d.error : "❌ 找不到員工資料")}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={reload} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "var(--success)", color: "#fff", fontSize: 13, cursor: "pointer" }}>🔄 重試</button>
              <button onClick={onClose} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "#fff", fontSize: 13, cursor: "pointer" }}>關閉</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const e = d.data;
  // 即時依 form（含手動覆寫 + 兼職健保旗標）計算，所見即所得
  const formForCalc = {
    employment_type: form.employment_type,
    labor_tier: form.labor_tier ? Number(form.labor_tier) : null,
    health_tier: form.health_tier ? Number(form.health_tier) : null,
    labor_self_override: form.labor_self_override,
    health_self_override: form.health_self_override,
    health_insured_here: form.health_insured_here,
  };
  const laborSelf = pickLaborSelf(formForCalc);
  const healthSelf = pickHealthSelf(formForCalc);

  return (
    <div style={modal} onClick={onClose}>
      <div style={mbox} onClick={ev => ev.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{"👤 "}<input value={form.name} onChange={ev=>setForm({...form,name:ev.target.value})} style={{border:"none",borderBottom:"1px solid var(--border)",fontSize:16,fontWeight:600,width:120,padding:"0 2px"}} /></h2>
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
                    background: "#fff", border: "1px solid var(--border)", borderRadius: 6, padding: 6,
                    textAlign: "center", cursor: "pointer", fontSize: 10
                  }}>
                    <div style={{ fontSize: 18 }}>{doc.file_url || doc.signature_url ? "📄" : "✍️"}</div>
                    <div style={{ fontWeight: 500, marginTop: 2 }}>{label}</div>
                    <div style={{ fontSize: 7, color: "var(--text-hint)" }}>{doc.created_at?.slice(0, 10)}</div>
                  </div>
                );
              })}
            </div>
          )}
          {/* 上傳按鈕 */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {[["health_check","🏥 體檢表"],["id_card_front","🪪 身分證正面"],["id_card_back","🪪 身分證反面"],["contract_sign","📝 合約"],["handbook_sign","📖 守則"]].map(([dt,lb]) => (
              <label key={dt} style={{ padding: "3px 8px", borderRadius: 4, border: "1px dashed #ccc", fontSize: 9, cursor: "pointer", color: "var(--brand-strong)" }}>
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
              {showDoc.signature_url && <div><p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>電子簽名</p><img src={showDoc.signature_url} alt="簽名" style={{ border: "1px solid #eee", borderRadius: 6, maxWidth: 200 }} /></div>}
              {showDoc.signed_at && <p style={{ fontSize: 10, color: "var(--text-3)", marginTop: 6 }}>簽署時間：{new Date(showDoc.signed_at).toLocaleString("zh-TW")}</p>}
              {showDoc.file_url && <a href={showDoc.file_url} download style={{ display: "block", textAlign: "center", marginTop: 8, padding: "8px 16px", borderRadius: 6, background: "var(--brand-strong)", color: "#fff", fontSize: 12, textDecoration: "none", fontWeight: 600 }}>📥 下載 / 列印</a>}
            </div>
          </div>
        )}

        <div style={sec}>
          <h3 style={sh}>基本資料</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            <div><label style={{fontSize:10,color:"var(--text-3)"}}>手機</label><input value={form.phone} onChange={ev=>setForm({...form,phone:ev.target.value})} style={inp} /></div>
            <div><label style={{fontSize:10,color:"var(--text-3)"}}>Email</label><input value={form.email} onChange={ev=>setForm({...form,email:ev.target.value})} style={inp} /></div>
            <div><label style={{fontSize:10,color:"var(--text-3)"}}>生日</label><input type="date" value={form.birthday} onChange={ev=>setForm({...form,birthday:ev.target.value})} style={inp} /></div>
            <div><label style={{fontSize:10,color:"var(--text-3)"}}>身分證</label><input value={form.id_number} onChange={ev=>setForm({...form,id_number:ev.target.value})} style={inp} /></div>
          </div>
          <div style={{marginTop:4}}><label style={{fontSize:10,color:"var(--text-3)"}}>地址</label><input value={form.address} onChange={ev=>setForm({...form,address:ev.target.value})} style={inp} /></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:4}}>
            <div><label style={{fontSize:10,color:"var(--text-3)"}}>緊急聯絡人</label><input value={form.emergency_contact} onChange={ev=>setForm({...form,emergency_contact:ev.target.value})} style={inp} /></div>
            <div><label style={{fontSize:10,color:"var(--text-3)"}}>緊急電話</label><input value={form.emergency_phone} onChange={ev=>setForm({...form,emergency_phone:ev.target.value})} style={inp} /></div>
            <div><label style={{fontSize:10,color:"var(--text-3)"}}>銀行</label><input value={form.bank_name} onChange={ev=>setForm({...form,bank_name:ev.target.value})} style={inp} /></div>
            <div><label style={{fontSize:10,color:"var(--text-3)"}}>銀行帳號</label><input value={form.bank_account} onChange={ev=>setForm({...form,bank_account:ev.target.value})} style={inp} /></div>
          </div>
          <div style={{marginTop:6,display:"flex",gap:8,fontSize:10}}>
            <span style={{color:e.line_uid?"var(--success)":"var(--danger)"}}>{e.line_uid?"✅ LINE已綁定":"❌ LINE未綁定"}</span>
            <span style={{color:e.is_active?"var(--success)":"var(--danger)"}}>{e.is_active?"✅ 帳號啟用":"❌ 帳號停用"}</span>
          </div>
        </div>

        <div style={sec}>
          <h3 style={sh}>在職資訊</h3>
          <div style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 10, color: "var(--text-3)" }}>到職日</label>
            <input type="date" value={form.hire_date} onChange={ev => setForm({...form, hire_date: ev.target.value})} style={inp} />
          </div>
          <Row l="年資" v={(d.service_months || 0) + "個月"} />
          <div style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 10, color: "var(--text-3)" }}>{"特休天數（系統計算：" + (d.annual_leave_days || 0) + "天）"}</label>
            <input type="number" value={form.annual_leave_override}
              onChange={ev => setForm({...form, annual_leave_override: ev.target.value})}
              placeholder={"自動" + (d.annual_leave_days || 0) + "天，填數字可覆蓋"}
              style={inp} />
            <div style={{ fontSize: 9, color: "var(--text-3)", marginTop: 1 }}>留空=依到職日自動計算，填數字=手動設定（舊員工導入用）</div>
          </div>
          <Row l="合約" v={e.onboarding_completed ? "✅已簽" : "❌未簽"} />
          {/* 報到連結 */}
          {!e.onboarding_completed && (
            <div style={{ marginTop: 6, padding: 8, background: "var(--warning-bg)", borderRadius: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--warning)", marginBottom: 4 }}>📋 新人報到</div>
              {e.bind_code ? (
                <div>
                  <div style={{ fontSize: 10, color: "var(--text-2)", marginBottom: 4 }}>報到連結（傳給員工開啟）：</div>
                  <div style={{ fontSize: 10, background: "#fff", padding: 6, borderRadius: 4, border: "1px solid var(--border)", wordBreak: "break-all", userSelect: "all" }}>
                    {window.location.origin + "/onboarding?token=" + e.bind_code}
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(window.location.origin + "/onboarding?token=" + e.bind_code); alert("✅ 已複製報到連結"); }}
                    style={{ marginTop: 4, padding: "3px 10px", borderRadius: 4, border: "1px solid var(--brand-strong)", background: "transparent", color: "var(--brand-strong)", fontSize: 10, cursor: "pointer" }}>📋 複製連結</button>
                </div>
              ) : (
                <button onClick={async () => {
                  const r = await ap("/api/admin/employees", { action: "generate_bind_code", employee_id: empId });
                  if (r.error) { alert("❌ " + r.error); return; }
                  alert("✅ 綁定碼：" + r.bind_code + "\n\n報到連結：\n" + window.location.origin + "/onboarding?token=" + r.bind_code);
                  reload();
                }} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "var(--warning)", color: "#fff", fontSize: 11, cursor: "pointer" }}>
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
              }} style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--brand-strong)", background: "#fff", color: "var(--brand-strong)", fontSize: 10, cursor: "pointer" }}>
                📄 列印合約
              </button>
              <button onClick={async () => {
                if (!e.email) { alert("此員工沒有設定 Email"); return; }
                const r = await ap("/api/admin/documents", { action: "resend_email", employee_id: empId });
                if (r.error) alert("❌ " + r.error); else alert("✅ 合約已寄至 " + e.email);
              }} style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--success)", background: "#fff", color: "var(--success)", fontSize: 10, cursor: "pointer" }}>
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

        <div style={{ ...sec, border: "2px solid var(--brand-strong)" }}>
          <h3 style={{ ...sh, color: "var(--brand-strong)" }}>🔑 權限與所屬門市</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div>
              <label style={{ fontSize: 10, color: "var(--text-3)" }}>角色權限</label>
              <select value={form.role} onChange={ev => setForm({...form, role: ev.target.value})} style={inp}>
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "var(--text-3)" }}>僱用類型</label>
              <select value={form.employment_type} onChange={ev => setForm({...form, employment_type: ev.target.value})} style={inp}>
                <option value="regular">一般</option>
                <option value="parttime">兼職</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 6 }}>
            <label style={{ fontSize: 10, color: "var(--text-3)" }}>所屬門市</label>
            <select value={form.store_id || ""} onChange={ev => setForm({...form, store_id: ev.target.value})} style={inp}>
              <option value="">🏢 總部（無門市）</option>
              {(storesRef || []).map(s => <option key={s.id} value={s.id}>{"🏠 " + s.name}</option>)}
            </select>
          </div>
          {/* 後台登入密碼設定（只對有後台權限的員工顯示） */}
          {["admin","manager","store_manager"].includes(form.role) && (
            <PasswordSection empId={empId} hasPassword={!!d?.data?.has_password} onChanged={reload} />
          )}
        </div>

        <div style={{ ...sec, border: "2px solid var(--text-2)" }}>
          <h3 style={{ ...sh, color: "var(--text-2)" }}>💰 薪資設定</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div>
              <label style={{ fontSize: 10, color: "var(--text-3)" }}>月薪</label>
              <input type="number" value={form.monthly_salary} onChange={ev => setForm({...form, monthly_salary: ev.target.value})} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: "var(--text-3)" }}>時薪</label>
              <input type="number" value={form.hourly_rate} onChange={ev => setForm({...form, hourly_rate: ev.target.value})} style={inp} />
            </div>
          </div>
        </div>

        <div style={{ ...sec, border: "2px solid var(--warning)" }}>
          <h3 style={{ ...sh, color: "var(--warning)" }}>🛡️ 勞健保設定</h3>
          {(() => {
            const isPT = form.employment_type === "parttime";
            const laborTiers = isPT ? TIERS_P : TIERS_R;
            return <>
            <div style={{ fontSize: 10, color: "var(--text-2)", marginBottom: 6, padding: 6, background: "var(--warning-bg)", borderRadius: 4 }}>
              💡 勞保依「{isPT ? "兼職" : "正職"}」級距；健保一律用正職級距（健保最低 = 基本工資）。
              {isPT && " 兼職若另有加保（家屬/他司）請勾下方「不在此加保健保」。"}
              <br/>實際金額以勞健保事務所核定為準，可在下方手動覆寫。
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <div>
                <label style={{ fontSize: 10, color: "var(--text-3)" }}>勞保級距（{isPT ? "兼職表" : "正職表"}）</label>
                <select value={form.labor_tier} onChange={ev => setForm({...form, labor_tier: ev.target.value})} style={inp}>
                  <option value="">未設定</option>
                  {laborTiers.map(([i, r]) => <option key={i} value={i}>{tierLabel(i, r)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: "var(--text-3)" }}>健保級距（正職表）</label>
                <select value={form.health_tier} onChange={ev => setForm({...form, health_tier: ev.target.value})}
                  disabled={isPT && !form.health_insured_here}
                  style={{...inp, opacity: (isPT && !form.health_insured_here) ? 0.4 : 1}}>
                  <option value="">未設定</option>
                  {TIERS_R.map(([i, r]) => <option key={i} value={i}>{tierLabel(i, r)}</option>)}
                </select>
              </div>
            </div>
            {isPT && (
              <label style={{ marginTop: 8, fontSize: 11, color: "var(--text)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={!form.health_insured_here}
                  onChange={ev => setForm({...form, health_insured_here: !ev.target.checked})} />
                不在此加保健保（員工另由家屬/他司加保）
              </label>
            )}
            <div style={{ marginTop: 8, padding: 6, background: "var(--surface-warm)", borderRadius: 4 }}>
              <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 4 }}>📋 自付額手動覆寫（事務所核定為準，留空則查表估算）</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <div>
                  <label style={{ fontSize: 9, color: "var(--text-3)" }}>勞保自付額</label>
                  <input type="number" placeholder="留空＝查表" value={form.labor_self_override}
                    onChange={ev => setForm({...form, labor_self_override: ev.target.value})} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 9, color: "var(--text-3)" }}>健保自付額</label>
                  <input type="number" placeholder="留空＝查表" value={form.health_self_override}
                    onChange={ev => setForm({...form, health_self_override: ev.target.value})} style={inp} />
                </div>
              </div>
            </div>
            {(laborSelf > 0 || healthSelf > 0) && (
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--success)", fontWeight: 600 }}>
                💰 目前用於計算：勞保 ${laborSelf} / 健保 ${healthSelf}
                {(form.labor_self_override !== "" || form.health_self_override !== "") && <span style={{ color: "var(--warning)", marginLeft: 6 }}>（含手動覆寫）</span>}
              </div>
            )}
            </>;
          })()}
        </div>

        {/* 📜 投保金額異動歷史 */}
        <div style={sec}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <h3 style={{ ...sh, marginBottom: 0 }}>📜 投保金額異動歷史</h3>
            <button onClick={() => setBackfillForm(backfillForm ? null : {
              change_date: form.hire_date || new Date().toLocaleDateString("sv-SE"),
              employment_type: form.employment_type || "regular",
              labor_tier: "", health_tier: "",
              labor_self_override: "", health_self_override: "",
              health_insured_here: true, note: "",
            })} style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid var(--warning)", background: backfillForm ? "var(--warning-bg)" : "transparent", color: "var(--warning)", fontSize: 10, cursor: "pointer", fontWeight: 600 }}>
              {backfillForm ? "✕ 取消補登" : "📌 補登過去異動"}
            </button>
          </div>

          {/* 補登表單 */}
          {backfillForm && (() => {
            const isPT = backfillForm.employment_type === "parttime";
            const laborTiers = isPT ? TIERS_P : TIERS_R;
            return (
              <div style={{ background: "var(--warning-bg)", border: "1px solid #f0e6c8", borderRadius: 6, padding: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: "var(--warning)", marginBottom: 6 }}>💡 補登過去某日的投保狀態（例如剛升級時忘了系統內變更，事後追記）</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
                  <div>
                    <label style={{ fontSize: 9, color: "var(--text-3)" }}>變動生效日 *</label>
                    <input type="date" value={backfillForm.change_date}
                      onChange={ev => setBackfillForm({ ...backfillForm, change_date: ev.target.value })} style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 9, color: "var(--text-3)" }}>當時身份</label>
                    <select value={backfillForm.employment_type}
                      onChange={ev => setBackfillForm({ ...backfillForm, employment_type: ev.target.value, labor_tier: "" })} style={inp}>
                      <option value="regular">正職</option>
                      <option value="parttime">兼職</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 9, color: "var(--text-3)" }}>勞保級距（{isPT ? "兼職" : "正職"}表）</label>
                    <select value={backfillForm.labor_tier}
                      onChange={ev => setBackfillForm({ ...backfillForm, labor_tier: ev.target.value })} style={inp}>
                      <option value="">未投保</option>
                      {laborTiers.map(([i, r]) => <option key={i} value={i}>{tierLabel(i, r)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 9, color: "var(--text-3)" }}>健保級距（正職表）</label>
                    <select value={backfillForm.health_tier}
                      onChange={ev => setBackfillForm({ ...backfillForm, health_tier: ev.target.value })}
                      disabled={isPT && !backfillForm.health_insured_here}
                      style={{ ...inp, opacity: (isPT && !backfillForm.health_insured_here) ? 0.4 : 1 }}>
                      <option value="">未投保</option>
                      {TIERS_R.map(([i, r]) => <option key={i} value={i}>{tierLabel(i, r)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 9, color: "var(--text-3)" }}>勞保自付額覆寫</label>
                    <input type="number" placeholder="留空＝查表" value={backfillForm.labor_self_override}
                      onChange={ev => setBackfillForm({ ...backfillForm, labor_self_override: ev.target.value })} style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 9, color: "var(--text-3)" }}>健保自付額覆寫</label>
                    <input type="number" placeholder="留空＝查表" value={backfillForm.health_self_override}
                      onChange={ev => setBackfillForm({ ...backfillForm, health_self_override: ev.target.value })} style={inp} />
                  </div>
                </div>
                {isPT && (
                  <label style={{ fontSize: 11, color: "var(--text)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginBottom: 6 }}>
                    <input type="checkbox" checked={!backfillForm.health_insured_here}
                      onChange={ev => setBackfillForm({ ...backfillForm, health_insured_here: !ev.target.checked })} />
                    當時不在此加保健保（他司加保）
                  </label>
                )}
                <input type="text" placeholder="備註（例如：事務所核定、年度級距調整...）"
                  value={backfillForm.note}
                  onChange={ev => setBackfillForm({ ...backfillForm, note: ev.target.value })} style={{ ...inp, marginBottom: 6 }} />
                <button disabled={backfillSaving || !backfillForm.change_date}
                  onClick={async () => {
                    if (!backfillForm.change_date) { alert("請填變動日期"); return; }
                    setBackfillSaving(true);
                    const r = await ap("/api/admin/employees", {
                      action: "backfill_insurance_history",
                      employee_id: empId,
                      change_date: backfillForm.change_date,
                      employment_type: backfillForm.employment_type,
                      labor_tier: backfillForm.labor_tier || null,
                      health_tier: backfillForm.health_tier || null,
                      labor_self_override: backfillForm.labor_self_override,
                      health_self_override: backfillForm.health_self_override,
                      health_insured_here: backfillForm.health_insured_here,
                      changed_by: auth?.name || null,
                      note: backfillForm.note || "",
                    });
                    setBackfillSaving(false);
                    if (r?.error) { alert("❌ " + r.error); return; }
                    setBackfillForm(null);
                    reload();
                  }}
                  style={{ width: "100%", padding: 8, borderRadius: 5, border: "none", background: "var(--warning)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {backfillSaving ? "儲存中..." : "💾 補登這筆歷史"}
                </button>
              </div>
            );
          })()}

          {(() => {
            const history = d?.insurance_history || [];
            if (history.length === 0) {
              return <p style={{ fontSize: 11, color: "var(--text-3)", padding: "8px 0" }}>尚無異動紀錄（自部署日起會自動記錄勞健保級距/自付額/投保身份的每次變動；過去異動可用上方「補登」按鈕手動加入）</p>;
            }
            return (
              <div style={{ background: "#fff", borderRadius: 6, border: "1px solid var(--border)", overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                  <thead><tr style={{ background: "var(--surface-warm)" }}>
                    {["日期", "身份", "勞保", "健保", "覆寫", "異動人", "備註", ""].map(h =>
                      <th key={h} style={{ padding: 5, textAlign: "left", fontWeight: 500, color: "var(--text-2)" }}>{h}</th>
                    )}
                  </tr></thead>
                  <tbody>
                    {history.map((h, i) => {
                      const isPT = h.employment_type === "parttime";
                      const ls = h.labor_tier ? (isPT ? INSURANCE_TIERS_PT : INSURANCE_TIERS)[h.labor_tier - 1]?.[0] : null;
                      const hs = h.health_tier ? INSURANCE_TIERS[h.health_tier - 1]?.[0] : null;
                      const overrides = [];
                      if (h.labor_self_override != null) overrides.push("勞" + h.labor_self_override);
                      if (h.health_self_override != null) overrides.push("健" + h.health_self_override);
                      const isBackfill = h.note && h.note.startsWith("[補登]");
                      return (
                        <tr key={h.id || i} style={{ borderTop: "1px solid var(--divider)", background: isBackfill ? "#fffbeb" : "transparent" }}>
                          <td style={{ padding: 5, whiteSpace: "nowrap" }}>{h.change_date}{isBackfill && <span style={{ fontSize: 8, color: "var(--warning)", marginLeft: 3 }}>補</span>}</td>
                          <td style={{ padding: 5 }}>{isPT ? "兼職" : "正職"}</td>
                          <td style={{ padding: 5, color: ls ? "var(--info)" : "var(--text-hint)" }}>{ls ? "$" + ls.toLocaleString() + " (L" + h.labor_tier + ")" : "—"}</td>
                          <td style={{ padding: 5, color: h.health_insured_here === false ? "var(--warning)" : (hs ? "var(--success)" : "var(--text-hint)") }}>
                            {h.health_insured_here === false ? "他司" : (hs ? "$" + hs.toLocaleString() + " (H" + h.health_tier + ")" : "—")}
                          </td>
                          <td style={{ padding: 5, color: "var(--warning)" }}>{overrides.length > 0 ? overrides.join(" / ") : "—"}</td>
                          <td style={{ padding: 5 }}>{h.changed_by || "—"}</td>
                          <td style={{ padding: 5, color: "var(--text-2)" }}>{h.note || "—"}</td>
                          <td style={{ padding: 5 }}>
                            <button onClick={async () => {
                              if (!confirm("刪除這筆歷史紀錄？（無法復原）")) return;
                              const r = await ap("/api/admin/employees", { action: "delete_insurance_history", history_id: h.id });
                              if (r?.error) { alert("❌ " + r.error); return; }
                              reload();
                            }} style={{ padding: "1px 5px", borderRadius: 3, border: "1px solid var(--border)", background: "#fff", color: "var(--danger)", fontSize: 9, cursor: "pointer" }}>🗑</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>

        <button onClick={save} disabled={saving} style={{
          width: "100%", padding: "10px", borderRadius: 8, border: "none",
          background: saving ? "#ccc" : "var(--success)", color: "#fff",
          fontSize: 14, fontWeight: 600, cursor: "pointer"
        }}>
          {saving ? "儲存中..." : "💾 儲存所有變更"}
        </button>
        {msg && <p style={{ textAlign: "center", fontSize: 12, color: "var(--success)", marginTop: 4 }}>{msg}</p>}

        <div style={{ marginTop: 10, display: "flex", gap: 4, flexWrap: "wrap" }}>
          <button onClick={async () => {
            if (!confirm("確定解除LINE綁定？")) return;
            await ap("/api/admin/employees", { action: "update", employee_id: empId, line_uid: null });
            alert("已解除");
            reload();
          }} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid var(--warning)", background: "transparent", color: "var(--warning)", fontSize: 10, cursor: "pointer" }}>
            {"🔓 解除LINE"}
          </button>

          <button onClick={async () => {
            const ph = prompt("輸入新手機號碼：");
            if (ph) {
              await ap("/api/admin/employees", { action: "update", employee_id: empId, phone: ph });
              alert("已更新");
              reload();
            }
          }} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid var(--text-2)", background: "transparent", color: "var(--text-2)", fontSize: 10, cursor: "pointer" }}>
            {"📱 換手機"}
          </button>

          <button onClick={() => {
            // 開新分頁進入完整離職同意書流程（含員工 LINE 簽署）
            window.open("/resignation-create?eid=" + empId, "_blank");
          }} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid var(--danger)", background: "transparent", color: "var(--danger)", fontSize: 10, cursor: "pointer" }}>
            {"🚪 離職作業"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PasswordSection({ empId, hasPassword, onChanged }) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const save = async () => {
    if (!pw || pw.length < 4) { setMsg("❌ 密碼至少 4 個字元"); return; }
    setSaving(true); setMsg("");
    try {
      const auth = JSON.parse(localStorage.getItem("sb_auth") || "{}");
      const r = await fetch("/api/auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_password", employee_id: empId, new_password: pw, admin_token: auth.token }),
      }).then(r => r.json());
      if (r.error) setMsg("❌ " + r.error);
      else { setMsg("✅ 已更新密碼"); setPw(""); onChanged?.(); }
    } catch (e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };
  return (
    <div style={{ marginTop: 8, padding: 8, background: "#fff7ed", borderRadius: 6, border: "1px solid #fbbf24" }}>
      <label style={{ fontSize: 10, color: "#92400e", fontWeight: 600 }}>
        🔐 後台登入密碼 {hasPassword ? <span style={{ color: "var(--success)" }}>（已設定）</span> : <span style={{ color: "var(--danger)" }}>（未設定）</span>}
      </label>
      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
        <input type={show ? "text" : "password"} value={pw} onChange={e => setPw(e.target.value)} placeholder="輸入新密碼"
          style={{ flex: 1, padding: "5px 8px", borderRadius: 5, border: "1px solid var(--border)", fontSize: 12 }} />
        <button onClick={() => setShow(s => !s)} title={show ? "隱藏" : "顯示"}
          style={{ padding: "2px 8px", borderRadius: 5, border: "1px solid var(--border)", background: "#fff", cursor: "pointer", fontSize: 11 }}>
          {show ? "🙈" : "👁"}
        </button>
        <button onClick={save} disabled={saving || !pw}
          style={{ padding: "2px 10px", borderRadius: 5, border: "none", background: pw && !saving ? "var(--warning)" : "#ccc", color: "#fff", fontSize: 11, cursor: pw ? "pointer" : "not-allowed", fontWeight: 600 }}>
          {saving ? "..." : "更新"}
        </button>
      </div>
      {msg && <div style={{ fontSize: 10, marginTop: 4, color: msg.startsWith("✅") ? "var(--success)" : "var(--danger)" }}>{msg}</div>}
    </div>
  );
}
