"use client";
// 法規對帳：每位員工每月每週的「例假/休息日/連續工作日」合規檢查
// 對照勞基法 36 條（一例一休）+ 39 條（特休/國假出勤加給）+ 40 條（例假緊急出勤）
// 純前端計算，唯讀，月底人工檢核用

const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, marginBottom: 8 };
const badge = { display: "inline-block", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600, marginRight: 4 };
const flagRed = { ...badge, background: "#fee2e2", color: "#b91c1c" };
const flagOrange = { ...badge, background: "#fed7aa", color: "#9a3412" };
const flagYellow = { ...badge, background: "#fef3c7", color: "#92400e" };
const flagGreen = { ...badge, background: "#dcfce7", color: "#166534" };

// 取得日期所在週（週一為起點）的 ISO 字串
function weekKey(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay(); // 0=Sun, 1=Mon...6=Sat
  const offset = dow === 0 ? -6 : 1 - dow; // 推回上週一
  const mon = new Date(d.getTime() + offset * 86400000);
  return mon.toLocaleDateString("sv-SE");
}

function dailyRateOf(emp) {
  if (emp.monthly_salary) return Math.round(Number(emp.monthly_salary) / 30);
  if (emp.hourly_rate) return Math.round(Number(emp.hourly_rate) * 8);
  return 0;
}

export default function LaborAudit({ scheds, att, emps, sf, month }) {
  const empsFiltered = (emps || []).filter(e => e.is_active && (!sf || e.store_id === sf));
  if (empsFiltered.length === 0) {
    return <div style={{ padding: 12, color: "#666", fontSize: 12 }}>無員工資料</div>;
  }

  // 該月有 clock_in 的 (employee_id, date) 集合
  const clockInSet = new Set();
  for (const a of att || []) {
    if (a.type !== "clock_in" || a.is_amendment) continue;
    if (!a.timestamp) continue;
    const d = new Date(a.timestamp).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
    if (!d.startsWith(month)) continue;
    clockInSet.add(a.employee_id + "|" + d);
  }

  // 每員工的本月排班
  const schedByEmp = {};
  for (const s of scheds || []) {
    if (!s.date || !s.date.startsWith(month)) continue;
    (schedByEmp[s.employee_id] ||= []).push(s);
  }

  const issues = [];
  for (const emp of empsFiltered) {
    const empScheds = (schedByEmp[emp.id] || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    if (empScheds.length === 0) continue;

    // 按週分組（Mon-Sun）
    const weeks = {};
    for (const s of empScheds) {
      const wk = weekKey(s.date);
      (weeks[wk] ||= []).push(s);
    }

    const empFlags = [];
    const moneyFlags = [];

    // 每週合規檢查
    for (const [wkStart, wkScheds] of Object.entries(weeks)) {
      const types = wkScheds.reduce((m, s) => {
        m[s.day_type] = (m[s.day_type] || 0) + 1;
        return m;
      }, {});
      const workish = (types.work || 0) + (types.national_holiday || 0);
      const hasRegOff = (types.regular_off || 0) > 0;
      const hasRestDay = (types.rest_day || 0) > 0;
      // 只有當該週至少排了 5 天以上才檢查（避免月初月末殘缺週誤報）
      const totalScheduled = wkScheds.length;
      if (totalScheduled >= 5) {
        if (!hasRegOff && workish >= 6) {
          empFlags.push({ level: "red", text: `${wkStart} 該週無例假日（違反勞基法 36 條）` });
        } else if (!hasRegOff) {
          empFlags.push({ level: "yellow", text: `${wkStart} 該週未指定例假日` });
        }
        if (!hasRestDay && workish >= 6) {
          empFlags.push({ level: "red", text: `${wkStart} 該週無休息日且工作日 ≥6 天（違反 36 條）` });
        } else if (!hasRestDay) {
          empFlags.push({ level: "yellow", text: `${wkStart} 該週未指定休息日` });
        }
      }
    }

    // 連續工作天檢查（跨週）
    let curr = 0, maxConsec = 0, consecStart = "";
    for (const s of empScheds) {
      if (s.day_type === "work" || s.day_type === "national_holiday") {
        if (curr === 0) consecStart = s.date;
        curr++;
        maxConsec = Math.max(maxConsec, curr);
      } else {
        curr = 0;
      }
    }
    if (maxConsec >= 7) {
      empFlags.push({ level: "red", text: `🚨 連續工作 ${maxConsec} 天（${consecStart} 起）違反一例一休` });
    }

    // 金額警示：clock_in 在 regular_off 或 paid_leave(annual) 日
    const dailyRate = dailyRateOf(emp);
    for (const s of empScheds) {
      const isAttDay = clockInSet.has(emp.id + "|" + s.date);
      if (!isAttDay) continue;
      if (s.day_type === "regular_off") {
        moneyFlags.push({
          date: s.date,
          text: `例假日緊急出勤 — 應加給 $${dailyRate.toLocaleString()}（勞基法 40 條）`,
        });
      } else if (s.day_type === "paid_leave" && s.leave_type === "annual") {
        moneyFlags.push({
          date: s.date,
          text: `特休出勤 — 應加給 $${dailyRate.toLocaleString()}（勞基法 39 條）`,
        });
      }
    }

    if (empFlags.length > 0 || moneyFlags.length > 0) {
      issues.push({ emp, empFlags, moneyFlags });
    }
  }

  if (issues.length === 0) {
    return (
      <div style={{ padding: 12, background: "#dcfce7", borderRadius: 8, color: "#166534", fontSize: 13 }}>
        ✅ {empsFiltered.length} 位員工本月排班均符合勞基法 36/39/40 條（一例一休、特休出勤、例假緊急出勤）
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 10, padding: 10, background: "#fef3c7", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
        🔍 法規對帳：{issues.length} / {empsFiltered.length} 位員工有需要檢視的項目。所有判斷皆為唯讀，不會自動修改資料。
      </div>
      {issues.map(({ emp, empFlags, moneyFlags }) => (
        <div key={emp.id} style={card}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            👤 {emp.name}
            {emp.weekly_regular_off && (
              <span style={{ ...flagGreen, marginLeft: 8 }}>
                週模板：例假={emp.weekly_regular_off} / 休息日={emp.weekly_rest_day || "未設"}
              </span>
            )}
            {!emp.weekly_regular_off && (
              <span style={{ ...flagYellow, marginLeft: 8 }}>未設週模板</span>
            )}
          </div>
          {empFlags.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              {empFlags.map((f, i) => (
                <div key={i} style={{ fontSize: 12, marginBottom: 3 }}>
                  <span style={f.level === "red" ? flagRed : f.level === "orange" ? flagOrange : flagYellow}>
                    {f.level === "red" ? "違規" : f.level === "orange" ? "警告" : "提醒"}
                  </span>
                  {f.text}
                </div>
              ))}
            </div>
          )}
          {moneyFlags.length > 0 && (
            <div style={{ borderTop: empFlags.length > 0 ? "1px dashed #e5e7eb" : "none", paddingTop: empFlags.length > 0 ? 6 : 0 }}>
              {moneyFlags.map((f, i) => (
                <div key={i} style={{ fontSize: 12, marginBottom: 3, color: "#1d4ed8" }}>
                  <span style={{ ...badge, background: "#dbeafe", color: "#1d4ed8" }}>💰 {f.date}</span>
                  {f.text}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
