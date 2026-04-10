"use client";
import { useState, useEffect, useCallback } from "react";

const fmt = (n) => "$" + Number(n || 0).toLocaleString();
const ROLES = { admin: "👑 總部", manager: "🏠 管理", staff: "👤 員工" };
const DAYS = ["日", "一", "二", "三", "四", "五", "六"];

function Card({ label, value, sub, color }) {
  return <div style={{ background: "#fff", borderRadius: 12, padding: "14px 18px", border: "1px solid #e8e6e1", flex: "1 1 130px", minWidth: 130 }}>
    <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 600, color: color || "#1a1a1a" }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{sub}</div>}
  </div>;
}

function Badge({ status }) {
  const m = { matched: { bg: "#e6f9f0", c: "#0a7c42", t: "✅吻合" }, minor_diff: { bg: "#fff8e6", c: "#8a6d00", t: "⚠️差異" }, anomaly: { bg: "#fde8e8", c: "#b91c1c", t: "🚨異常" }, pending: { bg: "#f0f0f0", c: "#666", t: "⏳待核" } };
  const s = m[status] || m.pending;
  return <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 500, background: s.bg, color: s.c }}>{s.t}</span>;
}

function RoleBadge({ role }) {
  const c = { admin: { bg: "#fde8e8", c: "#b91c1c" }, manager: { bg: "#e6f1fb", c: "#185fa5" }, staff: { bg: "#e6f9f0", c: "#0a7c42" } };
  const s = c[role] || c.staff;
  return <span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 500, background: s.bg, color: s.c }}>{ROLES[role]}</span>;
}

export default function Admin() {
  const [tab, setTab] = useState("schedules");
  const [stores, setStores] = useState([]);
  const [storeFilter, setStoreFilter] = useState("");
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [settlements, setSettlements] = useState([]);
  const [summary, setSummary] = useState({});
  const [deposits, setDeposits] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [attSettings, setAttSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmp, setNewEmp] = useState({ name: "", store_id: "", role: "staff", phone: "" });
  const [newBindCode, setNewBindCode] = useState(null);
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [newShift, setNewShift] = useState({ store_id: "", name: "", start_time: "10:00", end_time: "20:00", break_minutes: 60, work_hours: 9, role: "all" });
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1);
    return d.toLocaleDateString("sv-SE");
  });
  const [scheduleForm, setScheduleForm] = useState({ employee_id: "", shift_id: "", date: "" });
  const [publishMsg, setPublishMsg] = useState(null);

  useEffect(() => { fetch("/api/admin/stores").then(r => r.json()).then(d => setStores(d.data || [])); }, []);

  const loadData = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (month) p.set("month", month);
    if (storeFilter) p.set("store_id", storeFilter);
    const wp = new URLSearchParams();
    const ws = weekStart;
    const we = new Date(new Date(ws).getTime() + 6 * 86400000).toLocaleDateString("sv-SE");
    wp.set("week_start", ws); wp.set("week_end", we);
    if (storeFilter) wp.set("store_id", storeFilter);

    Promise.all([
      fetch(`/api/admin/settlements?${p}`).then(r => r.json()),
      fetch(`/api/admin/deposits?${p}`).then(r => r.json()),
      fetch(`/api/admin/employees`).then(r => r.json()),
      fetch(`/api/admin/shifts${storeFilter ? `?store_id=${storeFilter}` : ""}`).then(r => r.json()),
      fetch(`/api/admin/schedules?${wp}`).then(r => r.json()),
      fetch(`/api/admin/attendance?type=records&${p}`).then(r => r.json()),
      fetch(`/api/admin/attendance?type=settings`).then(r => r.json()),
    ]).then(([s, d, e, sh, sc, at, as]) => {
      setSettlements(s.data || []); setSummary(s.summary || {}); setDeposits(d.data || []);
      setEmployees(e.data || []); setShifts(sh.data || []); setSchedules(sc.data || []);
      setAttendance(at.data || []); setAttSettings(as.data || {}); setLoading(false);
    });
  }, [month, storeFilter, weekStart]);

  useEffect(() => { loadData(); }, [loadData]);

  // ===== 員工操作 =====
  const addEmployee = async () => {
    const res = await fetch("/api/admin/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", ...newEmp }) });
    const d = await res.json(); if (d.bind_code) { setNewBindCode(d.bind_code); loadData(); }
  };
  const regenerateCode = async (id) => {
    const res = await fetch("/api/admin/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate_bind_code", employee_id: id }) });
    const d = await res.json(); if (d.bind_code) { alert(`綁定碼：${d.bind_code}\n員工在 LINE 輸入：綁定 ${d.bind_code}`); loadData(); }
  };

  // ===== 班別操作 =====
  const addShift = async () => {
    await fetch("/api/admin/shifts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", ...newShift }) });
    setShowShiftForm(false); loadData();
  };
  const deleteShift = async (id) => {
    if (!confirm("確定刪除此班別？")) return;
    await fetch("/api/admin/shifts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", shift_id: id }) });
    loadData();
  };

  // ===== 排班操作 =====
  const addSchedule = async (empId, shiftId, date) => {
    const shift = shifts.find(s => s.id === shiftId);
    await fetch("/api/admin/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", employee_id: empId, store_id: shift?.store_id || storeFilter, shift_id: shiftId, date }) });
    loadData();
  };
  const deleteSchedule = async (id) => {
    await fetch("/api/admin/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", schedule_id: id }) });
    loadData();
  };
  const publishSchedules = async () => {
    const we = new Date(new Date(weekStart).getTime() + 6 * 86400000).toLocaleDateString("sv-SE");
    const res = await fetch("/api/admin/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish", week_start: weekStart, week_end: we, store_id: storeFilter || undefined }) });
    const d = await res.json();
    setPublishMsg(`已發布 ${d.published || 0} 筆排班，通知 ${d.notified || 0} 位員工`);
    setTimeout(() => setPublishMsg(null), 5000);
    loadData();
  };

  // ===== 打卡設定 =====
  const updateSettings = async (key, value) => {
    await fetch("/api/admin/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_settings", [key]: value }) });
    loadData();
  };

  // 週日期陣列
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(new Date(weekStart).getTime() + i * 86400000);
    return d.toLocaleDateString("sv-SE");
  });

  const prevWeek = () => { setWeekStart(new Date(new Date(weekStart).getTime() - 7 * 86400000).toLocaleDateString("sv-SE")); };
  const nextWeek = () => { setWeekStart(new Date(new Date(weekStart).getTime() + 7 * 86400000).toLocaleDateString("sv-SE")); };

  const activeEmployees = employees.filter(e => e.is_active);
  const filteredEmployees = storeFilter ? activeEmployees.filter(e => e.store_id === storeFilter || e.role === "admin") : activeEmployees;

  const ts = (id) => ({ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: tab === id ? 600 : 400, background: tab === id ? "#1a1a1a" : "transparent", color: tab === id ? "#fff" : "#888", whiteSpace: "nowrap" });

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f5", fontFamily: "system-ui, 'Noto Sans TC', sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e6e1", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 22 }}>🍯</span>
          <div><div style={{ fontSize: 15, fontWeight: 600 }}>小食糖管理後台</div></div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 12 }} />
          <select value={storeFilter} onChange={e => setStoreFilter(e.target.value)} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 12 }}>
            <option value="">全部門市</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 12px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
          {[["schedules", "📅 排班"], ["shifts", "⏰ 班別"], ["attendance", "📍 出勤"], ["settings", "⚙️ 設定"], ["settlements", "💰 日結"], ["deposits", "🏦 存款"], ["employees", "👥 員工"]].map(([id, label]) =>
            <button key={id} style={ts(id)} onClick={() => setTab(id)}>{label}</button>
          )}
        </div>

        {loading && <div style={{ textAlign: "center", padding: 40, color: "#aaa" }}>載入中...</div>}

        {/* ==================== 排班表 ==================== */}
        {!loading && tab === "schedules" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <button onClick={prevWeek} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>◀ 上週</button>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{weekStart} ~ {weekDates[6]}</span>
              <button onClick={nextWeek} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>下週 ▶</button>
              <button onClick={publishSchedules} style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: "#0a7c42", color: "#fff", cursor: "pointer", fontSize: 13, marginLeft: "auto" }}>📢 發布班表通知員工</button>
            </div>
            {publishMsg && <div style={{ background: "#e6f9f0", color: "#0a7c42", padding: "8px 14px", borderRadius: 8, fontSize: 13, marginBottom: 10 }}>{publishMsg}</div>}

            {/* 排班表格 */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 800 }}>
                <thead><tr style={{ background: "#faf8f5", borderBottom: "1px solid #e8e6e1" }}>
                  <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 500, color: "#666", minWidth: 80, position: "sticky", left: 0, background: "#faf8f5", zIndex: 1 }}>員工</th>
                  {weekDates.map((d, i) => (
                    <th key={d} style={{ padding: "10px 6px", textAlign: "center", fontWeight: 500, color: i === 0 || i === 6 ? "#b91c1c" : "#666", minWidth: 100 }}>
                      {d.slice(5)}<br /><span style={{ fontSize: 11 }}>（{DAYS[new Date(d).getDay()]}）</span>
                    </th>
                  ))}
                </tr></thead>
                <tbody>
                  {filteredEmployees.map(emp => (
                    <tr key={emp.id} style={{ borderBottom: "1px solid #f0eeea" }}>
                      <td style={{ padding: "8px", fontWeight: 500, fontSize: 13, position: "sticky", left: 0, background: "#fff", zIndex: 1 }}>
                        {emp.name}<br /><RoleBadge role={emp.role} />
                      </td>
                      {weekDates.map(date => {
                        const sch = schedules.find(s => s.employee_id === emp.id && s.date === date);
                        return (
                          <td key={date} style={{ padding: "4px", textAlign: "center", verticalAlign: "top" }}>
                            {sch ? (
                              <div style={{ background: sch.published ? "#e6f9f0" : "#fff8e6", borderRadius: 6, padding: "4px 6px", fontSize: 11, position: "relative" }}>
                                <div style={{ fontWeight: 500 }}>{sch.shifts?.name}</div>
                                <div style={{ color: "#888" }}>{sch.shifts?.start_time?.slice(0, 5)}~{sch.shifts?.end_time?.slice(0, 5)}</div>
                                {!sch.published && <span style={{ fontSize: 9, color: "#8a6d00" }}>未發布</span>}
                                <button onClick={() => deleteSchedule(sch.id)} style={{ position: "absolute", top: 1, right: 3, background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#ccc" }}>✕</button>
                              </div>
                            ) : (
                              <select onChange={e => { if (e.target.value) { addSchedule(emp.id, e.target.value, date); e.target.value = ""; } }} style={{ width: "100%", padding: "4px", borderRadius: 6, border: "1px dashed #ddd", fontSize: 11, color: "#ccc", background: "transparent", cursor: "pointer" }}>
                                <option value="">＋</option>
                                {shifts.filter(s => !storeFilter || s.store_id === storeFilter).map(s => (
                                  <option key={s.id} value={s.id}>{s.name} {s.start_time?.slice(0, 5)}~{s.end_time?.slice(0, 5)}</option>
                                ))}
                              </select>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!storeFilter && <p style={{ fontSize: 12, color: "#999", marginTop: 8 }}>💡 建議先選擇門市再排班，班別會根據門市篩選</p>}
          </div>
        )}

        {/* ==================== 班別設定 ==================== */}
        {!loading && tab === "shifts" && (
          <div>
            <button onClick={() => setShowShiftForm(!showShiftForm)} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #ddd", background: showShiftForm ? "#f0f0f0" : "#1a1a1a", color: showShiftForm ? "#666" : "#fff", fontSize: 13, cursor: "pointer", marginBottom: 12 }}>
              {showShiftForm ? "✕ 取消" : "＋ 新增班別"}
            </button>
            {showShiftForm && (
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", padding: 18, marginBottom: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>門市 *</label>
                    <select value={newShift.store_id} onChange={e => setNewShift({ ...newShift, store_id: e.target.value })} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }}>
                      <option value="">選擇門市</option>
                      {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>班別名稱 *</label>
                    <input value={newShift.name} onChange={e => setNewShift({ ...newShift, name: e.target.value })} placeholder="例：早班" style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>角色</label>
                    <select value={newShift.role} onChange={e => setNewShift({ ...newShift, role: e.target.value })} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }}>
                      <option value="all">全場</option><option value="外場">外場</option><option value="內場">內場</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>上班時間</label>
                    <input type="time" value={newShift.start_time} onChange={e => setNewShift({ ...newShift, start_time: e.target.value })} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>下班時間</label>
                    <input type="time" value={newShift.end_time} onChange={e => setNewShift({ ...newShift, end_time: e.target.value })} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>休息(分鐘)</label>
                    <input type="number" value={newShift.break_minutes} onChange={e => setNewShift({ ...newShift, break_minutes: Number(e.target.value) })} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }} />
                  </div>
                </div>
                <button onClick={addShift} disabled={!newShift.store_id || !newShift.name} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: newShift.store_id && newShift.name ? "#0a7c42" : "#ccc", color: "#fff", fontSize: 13, cursor: "pointer" }}>建立班別</button>
              </div>
            )}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "#faf8f5", borderBottom: "1px solid #e8e6e1" }}>
                  {["門市", "班別名稱", "時間", "休息", "工時", "角色", "操作"].map(h => <th key={h} style={{ padding: "10px 8px", textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {shifts.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#ccc" }}>尚無班別，請先新增</td></tr>}
                  {shifts.map(s => (
                    <tr key={s.id} style={{ borderBottom: "1px solid #f0eeea" }}>
                      <td style={{ padding: "10px 8px", fontWeight: 500 }}>{s.stores?.name}</td>
                      <td style={{ padding: "10px 8px" }}>{s.name}</td>
                      <td style={{ padding: "10px 8px" }}>{s.start_time?.slice(0, 5)} ~ {s.end_time?.slice(0, 5)}</td>
                      <td style={{ padding: "10px 8px" }}>{s.break_minutes} 分</td>
                      <td style={{ padding: "10px 8px" }}>{s.work_hours} hr</td>
                      <td style={{ padding: "10px 8px" }}>{s.role}</td>
                      <td style={{ padding: "10px 8px" }}><button onClick={() => deleteShift(s.id)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #ddd", background: "transparent", cursor: "pointer", fontSize: 11, color: "#b91c1c" }}>刪除</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== 出勤紀錄 ==================== */}
        {!loading && tab === "attendance" && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 700 }}>
              <thead><tr style={{ background: "#faf8f5", borderBottom: "1px solid #e8e6e1" }}>
                {["時間", "員工", "門市", "類型", "距離", "狀態", "遲到"].map(h => <th key={h} style={{ padding: "10px 8px", textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {attendance.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#ccc" }}>尚無出勤紀錄</td></tr>}
                {attendance.map(a => (
                  <tr key={a.id} style={{ borderBottom: "1px solid #f0eeea" }}>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap", fontSize: 12 }}>{new Date(a.timestamp).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 500 }}>{a.employees?.name}</td>
                    <td style={{ padding: "10px 8px" }}>{a.stores?.name}</td>
                    <td style={{ padding: "10px 8px" }}>{a.type === "clock_in" ? "🟢 上班" : "🔴 下班"}</td>
                    <td style={{ padding: "10px 8px" }}>{a.distance_meters ? `${Math.round(a.distance_meters)}m` : "-"}</td>
                    <td style={{ padding: "10px 8px" }}>{a.is_valid ? <span style={{ color: "#0a7c42" }}>✅</span> : <span style={{ color: "#b91c1c" }}>❌ 異常</span>}</td>
                    <td style={{ padding: "10px 8px", color: a.late_minutes > 0 ? "#b91c1c" : "#0a7c42" }}>{a.late_minutes > 0 ? `${a.late_minutes}分` : "準時"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ==================== 打卡設定 ==================== */}
        {!loading && tab === "settings" && (
          <div style={{ maxWidth: 500 }}>
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", padding: 18 }}>
              <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 14 }}>⚙️ 打卡設定（台灣勞基法標準）</h3>
              {[
                { key: "late_grace_minutes", label: "遲到寬限（分鐘）", desc: "在此分鐘內打卡不算遲到" },
                { key: "late_threshold_minutes", label: "嚴重遲到（分鐘）", desc: "超過此分鐘視為嚴重遲到" },
                { key: "early_leave_minutes", label: "早退認定（分鐘）", desc: "提前幾分鐘以上算早退" },
                { key: "overtime_min_minutes", label: "加班最低（分鐘）", desc: "超時幾分鐘以上才計入加班" },
                { key: "work_hours_per_day", label: "每日正常工時", desc: "法定 8 小時" },
                { key: "work_hours_per_week", label: "每週正常工時", desc: "法定 40 小時" },
              ].map(item => (
                <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f0eeea" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: "#999" }}>{item.desc}</div>
                  </div>
                  <input type="number" value={attSettings[item.key] ?? ""} onChange={e => {
                    const v = Number(e.target.value);
                    setAttSettings({ ...attSettings, [item.key]: v });
                    clearTimeout(window._settingsTimer);
                    window._settingsTimer = setTimeout(() => updateSettings(item.key, v), 1000);
                  }} style={{ width: 70, padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, textAlign: "center" }} />
                </div>
              ))}
              <div style={{ marginTop: 14, padding: 12, background: "#f0eeea", borderRadius: 8, fontSize: 12, color: "#666" }}>
                加班費率：前 2 小時 1.34 倍，後 2 小時 1.67 倍<br />
                休息：連續工作 4 小時以上至少休 30 分鐘
              </div>
            </div>
          </div>
        )}

        {/* ==================== 日結紀錄 ==================== */}
        {!loading && tab === "settlements" && (
          <div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <Card label="營業淨額" value={fmt(summary.total_net_sales)} sub={`${summary.count || 0}筆`} color="#0a7c42" />
              <Card label="現金" value={fmt(summary.total_cash)} />
              <Card label="應存" value={fmt(summary.total_cash_to_deposit)} color="#b45309" />
            </div>
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 800 }}>
                <thead><tr style={{ background: "#faf8f5", borderBottom: "1px solid #e8e6e1" }}>
                  {["日期", "門市", "結單人", "淨額", "現金", "TWQR", "UberEat", "應存", "📷"].map(h => <th key={h} style={{ padding: "8px 6px", textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {settlements.map(s => (
                    <tr key={s.id} style={{ borderBottom: "1px solid #f0eeea" }}>
                      <td style={{ padding: "8px 6px" }}>{s.date}</td>
                      <td style={{ padding: "8px 6px", fontWeight: 500 }}>{s.stores?.name}</td>
                      <td style={{ padding: "8px 6px" }}>{s.cashier_name || "-"}</td>
                      <td style={{ padding: "8px 6px", fontWeight: 600, color: "#0a7c42" }}>{fmt(s.net_sales)}</td>
                      <td style={{ padding: "8px 6px" }}>{fmt(s.cash_amount)}</td>
                      <td style={{ padding: "8px 6px" }}>{fmt(s.twqr_amount)}</td>
                      <td style={{ padding: "8px 6px" }}>{fmt(s.uber_eat_amount)}</td>
                      <td style={{ padding: "8px 6px", color: "#b45309" }}>{fmt(s.cash_to_deposit)}</td>
                      <td style={{ padding: "8px 6px" }}>{s.image_url && <button onClick={() => setSelectedImage(s.image_url)} style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #ddd", background: "transparent", cursor: "pointer", fontSize: 11 }}>📷</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== 存款紀錄 ==================== */}
        {!loading && tab === "deposits" && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 700 }}>
              <thead><tr style={{ background: "#faf8f5", borderBottom: "1px solid #e8e6e1" }}>
                {["日期", "門市", "匯款人", "金額", "應存", "差異", "狀態", "📷"].map(h => <th key={h} style={{ padding: "8px 6px", textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {deposits.map(d => (
                  <tr key={d.id} style={{ borderBottom: "1px solid #f0eeea" }}>
                    <td style={{ padding: "8px 6px" }}>{d.deposit_date}</td>
                    <td style={{ padding: "8px 6px", fontWeight: 500 }}>{d.stores?.name}</td>
                    <td style={{ padding: "8px 6px" }}>{d.depositor_name || "-"}</td>
                    <td style={{ padding: "8px 6px", fontWeight: 600 }}>{fmt(d.amount)}</td>
                    <td style={{ padding: "8px 6px" }}>{fmt(d.expected_cash)}</td>
                    <td style={{ padding: "8px 6px", color: Math.abs(d.difference) <= 500 ? "#0a7c42" : "#b91c1c" }}>{d.difference >= 0 ? "+" : ""}{fmt(d.difference)}</td>
                    <td style={{ padding: "8px 6px" }}><Badge status={d.status} /></td>
                    <td style={{ padding: "8px 6px" }}>{d.image_url && <button onClick={() => setSelectedImage(d.image_url)} style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #ddd", background: "transparent", cursor: "pointer", fontSize: 11 }}>📷</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ==================== 員工管理 ==================== */}
        {!loading && tab === "employees" && (
          <div>
            <button onClick={() => { setShowAddForm(!showAddForm); setNewBindCode(null); }} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #ddd", background: showAddForm ? "#f0f0f0" : "#1a1a1a", color: showAddForm ? "#666" : "#fff", fontSize: 13, cursor: "pointer", marginBottom: 12 }}>{showAddForm ? "✕ 取消" : "＋ 新增員工"}</button>
            {showAddForm && (
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", padding: 18, marginBottom: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div><label style={{ fontSize: 12, color: "#888" }}>姓名 *</label><input value={newEmp.name} onChange={e => setNewEmp({ ...newEmp, name: e.target.value })} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }} /></div>
                  <div><label style={{ fontSize: 12, color: "#888" }}>電話</label><input value={newEmp.phone} onChange={e => setNewEmp({ ...newEmp, phone: e.target.value })} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }} /></div>
                  <div><label style={{ fontSize: 12, color: "#888" }}>門市</label><select value={newEmp.store_id} onChange={e => setNewEmp({ ...newEmp, store_id: e.target.value })} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }}><option value="">總部</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                  <div><label style={{ fontSize: 12, color: "#888" }}>角色</label><select value={newEmp.role} onChange={e => setNewEmp({ ...newEmp, role: e.target.value })} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }}><option value="staff">👤 員工</option><option value="manager">🏠 管理</option><option value="admin">👑 總部</option></select></div>
                </div>
                <button onClick={addEmployee} disabled={!newEmp.name} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: newEmp.name ? "#0a7c42" : "#ccc", color: "#fff", fontSize: 13, cursor: "pointer" }}>建立 + 產生綁定碼</button>
                {newBindCode && <div style={{ marginTop: 10, padding: 14, background: "#e6f9f0", borderRadius: 8 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#0a7c42" }}>✅ 綁定碼：<span style={{ fontSize: 22, letterSpacing: 4 }}>{newBindCode}</span></div><div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>員工在 LINE 輸入：綁定 {newBindCode}</div></div>}
              </div>
            )}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e6e1", overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "#faf8f5", borderBottom: "1px solid #e8e6e1" }}>
                  {["姓名", "角色", "門市", "LINE", "綁定碼", "操作"].map(h => <th key={h} style={{ padding: "8px", textAlign: "left", fontWeight: 500, color: "#666" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {employees.map(e => (
                    <tr key={e.id} style={{ borderBottom: "1px solid #f0eeea", opacity: e.is_active ? 1 : 0.4 }}>
                      <td style={{ padding: "8px", fontWeight: 500 }}>{e.name}</td>
                      <td style={{ padding: "8px" }}><RoleBadge role={e.role} /></td>
                      <td style={{ padding: "8px" }}>{e.stores?.name || "總部"}</td>
                      <td style={{ padding: "8px" }}>{e.line_uid ? <span style={{ color: "#0a7c42" }}>✅</span> : "未綁定"}</td>
                      <td style={{ padding: "8px", fontFamily: "monospace" }}>{e.bind_code || "-"}</td>
                      <td style={{ padding: "8px" }}>{!e.line_uid && <button onClick={() => regenerateCode(e.id)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #ddd", background: "transparent", cursor: "pointer", fontSize: 11 }}>🔄 綁定碼</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div onClick={() => setSelectedImage(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, cursor: "pointer", padding: 20 }}>
          <img src={selectedImage} alt="" style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 12, objectFit: "contain" }} />
        </div>
      )}
    </div>
  );
}
