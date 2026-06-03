import crypto from "crypto";
import { replyText, replyWithQuickReply, downloadImageAsBase64, lineConfig, pushText, lineClient } from "@/lib/line";
import { supabase } from "@/lib/supabase";
import { analyzeDailySettlement, analyzeDepositSlip, analyzeUberEatsReceipt, analyzeVoucher, analyzeLineCreditReceipt, analyzeExpenseReceipt } from "@/lib/anthropic";

function verifySignature(body, signature) {
  return crypto.createHmac("SHA256", lineConfig.channelSecret).update(body).digest("base64") === signature;
}
function fmt(n) { return "$" + Number(n || 0).toLocaleString(); }
// 正職勞健保自付額（INSURANCE_TIERS）
const LABOR_SELF = [738,758,795,833,870,908,955,1002,1050,1098,1145,1145,1145,1145,1145,1145,1145,1145,1145,1145];
const HEALTH_SELF = [458,470,493,516,540,563,592,622,651,681,710,748,785,822,859,896,943,990,1036,1083];
// 兼職勞健保自付額（INSURANCE_TIERS_PT，第 1 級 11100 起）
const LABOR_SELF_PT = [278,314,338,397,414,433,448,478,502,527,552,579,602,633,662,692,717,738,758,795];
const HEALTH_SELF_PT = [172,194,209,246,256,268,277,296,310,326,341,358,372,392,410,428,443,458,470,493];
const DAYS = ["日","一","二","三","四","五","六"];

const MI = (label, text) => ({ type: "action", action: { type: "message", label, text } });
const MU = (label, url) => ({ type: "action", action: { type: "uri", label, uri: url } });
const SITE = process.env.SITE_URL || "https://sugarbistro-ops.zeabur.app";
const MENU_BASE = [];
const MENU_SM = [];
const MENU_MGR = [];
const MENU_ADMIN = [];
function getMenu(role) { return []; }
function getRoleLabel(role) { return role === "admin" ? "👑 總部" : role === "manager" ? "🏠 管理" : role === "store_manager" ? "🏪 主管" : "👤 員工"; }

async function getUserState(uid) { 
  const { data } = await supabase.from("user_states").select("*").eq("line_uid", uid).single(); 
  if (data && data.updated_at) {
    const age = Date.now() - new Date(data.updated_at).getTime();
    if (age > 5 * 60 * 1000) { await supabase.from("user_states").delete().eq("line_uid", uid); return null; }
  }
  return data; 
}
async function setUserState(uid, flow, flowData = {}) { await supabase.from("user_states").upsert({ line_uid: uid, current_flow: flow, flow_data: flowData, updated_at: new Date().toISOString() }, { onConflict: "line_uid" }); }
async function clearUserState(uid) { await supabase.from("user_states").delete().eq("line_uid", uid); }
async function getEmployee(uid) { const { data } = await supabase.from("employees").select("*, stores!store_id(*)").eq("line_uid", uid).eq("is_active", true).single(); return data; }

async function handleBinding(rt, userId, code) {
  const { data: emp } = await supabase.from("employees").select("*, stores!store_id(name)").eq("bind_code", code).eq("is_active", true).single();
  if (!emp) return replyText(rt, "❌ 綁定碼無效。格式：綁定 123456");
  if (emp.bind_code_expires && new Date(emp.bind_code_expires) < new Date()) return replyText(rt, "❌ 已過期。");
  await supabase.from("employees").update({ line_uid: userId, bind_code: null, bind_code_expires: null }).eq("id", emp.id);
  return replyWithQuickReply(rt, `✅ 綁定成功！\n${getRoleLabel(emp.role)} ${emp.name}\n🏠 ${emp.stores?.name || "總部"}`, getMenu(emp.role));
}

// ===== 打卡 =====
async function handleClockAction(rt, emp, type) {
  // 只擋「後台標記未啟用」的新人（待審核），已啟用的員工不擋
  if (!emp.is_active) {
    const url = `${process.env.SITE_URL || "https://sugarbistro-ops.zeabur.app"}/onboarding?bind_code=${emp.bind_code}`;
    return replyText(rt, "❌ 帳號尚未啟用，請聯繫主管核准\n\n如未完成報到：\n👉 " + url);
  }
  const token = crypto.randomBytes(24).toString("hex");
  await supabase.from("clockin_tokens").insert({ token, employee_id: emp.id, type, store_id: emp.store_id, expires_at: new Date(Date.now() + 600000).toISOString() });
  const url = `${process.env.SITE_URL || "https://sugarbistro-ops.zeabur.app"}/clockin?token=${token}`;
  const label = type === "clock_in" ? "上班" : "下班";
  return lineClient.replyMessage({ replyToken: rt, messages: [{ type: "template", altText: `${label}打卡`, template: { type: "buttons", title: `📍 ${label}打卡`, text: `👤 ${emp.name}\n點擊下方按鈕`, actions: [{ type: "uri", label: `開始${label}打卡`, uri: url }] } }] });
}

// ===== 班表查詢 =====
async function querySchedule(rt, emp) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const end = new Date(Date.now() + 14 * 86400000).toLocaleDateString("sv-SE");
  // 員工只能看已發布的班表 + 預假
  const { data } = await supabase.from("schedules").select("*, shifts(name, start_time, end_time), stores!store_id(name)").eq("employee_id", emp.id).gte("date", today).lte("date", end).or("published.eq.true,leave_type.eq.advance").order("date");
  const { data: hols } = await supabase.from("holidays").select("date, name").eq("is_active", true).gte("date", today).lte("date", end);
  const holMap = {};
  for (const h of hols || []) holMap[h.date] = h.name;

  if (!data?.length) return replyText(rt, "📅 未來 14 天沒有排班。");
  const leaveMap = { advance:"預假", holiday_comp:"國定補假", annual:"特休", sick:"病假", personal:"事假", menstrual:"生理假", off:"例假", rest:"休息日", comp_time:"補休", marriage:"婚假", funeral:"喪假", paternity:"陪產假", family_care:"家庭照顧假", maternity:"產假", official:"公假", work_injury:"公傷假" };
  let msg = "📅 " + emp.name + " 的班表（14天）\n━━━━━━━━━━━━━━\n";
  let lastWeek = "";
  for (const s of data) {
    const day = DAYS[new Date(s.date).getDay()];
    const isToday = s.date === today;
    const wk = s.date.slice(0, 7) + "-W" + Math.ceil(new Date(s.date).getDate() / 7);
    if (wk !== lastWeek) { if (lastWeek) msg += "──────────\n"; lastWeek = wk; }
    const hol = holMap[s.date] ? " 🔴" + holMap[s.date] : "";
    if (s.type === "leave") {
      msg += (isToday ? "👉 " : "") + s.date.slice(5) + "(" + day + ") 🏖" + (leaveMap[s.leave_type] || s.leave_type) + hol + "\n";
    } else {
      msg += (isToday ? "👉 " : "") + s.date.slice(5) + "(" + day + ") " + (s.shifts?.name || "") + " " + (s.shifts?.start_time?.slice(0, 5) || "") + "~" + (s.shifts?.end_time?.slice(0, 5) || "") + hol + "\n";
    }
  }
  return replyText(rt, msg);
}

// ===== 請假申請流程 =====
async function startLeaveRequest(rt, emp) {
  const today = new Date().toLocaleDateString("sv-SE");
  const { data: compAvail } = await supabase.from("overtime_records")
    .select("comp_hours").eq("employee_id", emp.id).eq("status", "approved")
    .eq("comp_type", "comp").eq("comp_used", false).eq("comp_converted", false)
    .gte("comp_expiry_date", today);
  const compH = (compAvail || []).reduce((s, r) => s + Number(r.comp_hours || 0), 0);

  const items = [
    { type: "action", action: { type: "message", label: "📌 預假", text: "假別:advance" } },
    { type: "action", action: { type: "message", label: "🏖 特休", text: "假別:annual" } },
    { type: "action", action: { type: "message", label: "🤒 病假", text: "假別:sick" } },
    { type: "action", action: { type: "message", label: "📋 事假", text: "假別:personal" } },
    { type: "action", action: { type: "message", label: "🌸 生理假", text: "假別:menstrual" } },
    { type: "action", action: { type: "message", label: "💒 婚假", text: "假別:marriage" } },
    { type: "action", action: { type: "message", label: "🕯 喪假", text: "假別:funeral" } },
    { type: "action", action: { type: "message", label: "👶 陪產假", text: "假別:paternity" } },
    { type: "action", action: { type: "message", label: "🏠 家庭照顧", text: "假別:family_care" } },
  ];
  if (compH > 0) {
    items.push({ type: "action", action: { type: "message", label: "🔄 補休(" + compH + "hr)", text: "假別:comp_time" } });
  }

  await setUserState(emp.line_uid, "leave_select_type", { employee_id: emp.id, employee_name: emp.name, store_id: emp.store_id });
  return replyWithQuickReply(rt, `🙋 請假申請\n👤 ${emp.name}\n\n📌 預假＝排班前卡假（不扣時數）\n🏖 其他假＝需有排班才能申請\n\n請選擇：`, items);
}

async function handleLeaveType(rt, uid, typeCode, state) {
  const typeMap = { advance:"預假", annual:"特休", sick:"病假", personal:"事假", menstrual:"生理假", comp_time:"補休", marriage:"婚假", funeral:"喪假", paternity:"陪產假", family_care:"家庭照顧假", maternity:"產假", official:"公假", work_injury:"公傷假" };

  if (typeCode === "advance") {
    await setUserState(uid, "advance_select_mode", { ...state.flow_data, leave_type: "advance", leave_label: "預假" });
    return replyWithQuickReply(rt, `📌 預假設定\n\n選擇方式：`, [
      { type: "action", action: { type: "message", label: "📅 單次預假", text: "預假模式:單次" } },
      { type: "action", action: { type: "message", label: "🔁 每週固定", text: "預假模式:每週" } },
      { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
    ]);
  }

  // 其他假別
  await setUserState(uid, "leave_select_day_type", { ...state.flow_data, leave_type: typeCode, leave_label: typeMap[typeCode] });
  return replyWithQuickReply(rt, `假別：${typeMap[typeCode]}\n\n請選擇：`, [
    { type: "action", action: { type: "message", label: "📅 全日", text: "天數:full" } },
    { type: "action", action: { type: "message", label: "🌅 上午半天", text: "天數:am" } },
    { type: "action", action: { type: "message", label: "🌇 下午半天", text: "天數:pm" } },
  ]);
}

async function handleAdvanceMode(rt, uid, mode, state) {
  const d = state.flow_data;
  if (mode === "單次") {
    await setUserState(uid, "advance_select_time", d);
    return replyWithQuickReply(rt, `📅 單次預假\n\n請選擇時段：`, [
      { type: "action", action: { type: "message", label: "整天無法", text: "預假:全天" } },
      { type: "action", action: { type: "message", label: "18:00前無法", text: "預假:18前" } },
      { type: "action", action: { type: "message", label: "16:00前無法", text: "預假:16前" } },
      { type: "action", action: { type: "message", label: "14:00前無法", text: "預假:14前" } },
      { type: "action", action: { type: "message", label: "12:00後無法", text: "預假:12後" } },
      { type: "action", action: { type: "message", label: "14:00後無法", text: "預假:14後" } },
    ]);
  }
  // 每週固定
  await setUserState(uid, "advance_weekly_days", { ...d, selected_days: [] });
  const dayNames = ["日","一","二","三","四","五","六"];
  return replyWithQuickReply(rt, `🔁 每週固定預假\n\n請點選每週無法上班的日子\n（可多選，選完按「✅完成」）：`, [
    ...dayNames.map((n,i) => ({ type:"action", action:{ type:"message", label:"週"+n, text:"預假週:"+i }})),
    { type:"action", action:{ type:"message", label:"🔙 取消", text:"取消" }},
  ]);
}

async function handleAdvanceWeekday(rt, uid, dayIdx, state) {
  const d = state.flow_data;
  const selected = [...(d.selected_days||[])];
  const idx = Number(dayIdx);
  if (!selected.includes(idx)) selected.push(idx);
  selected.sort();
  await setUserState(uid, "advance_weekly_days", { ...d, selected_days: selected });
  const dayNames = ["日","一","二","三","四","五","六"];
  const selectedText = selected.map(i => "週" + dayNames[i]).join("、");
  const remaining = dayNames.map((n,i) => ({ i, n })).filter(x => !selected.includes(x.i));
  const items = remaining.map(x => ({ type:"action", action:{ type:"message", label:"週"+x.n, text:"預假週:"+x.i }}));
  items.push({ type:"action", action:{ type:"message", label:"✅ 完成（"+selectedText+"）", text:"預假週完成" }});
  return replyWithQuickReply(rt, `已選：${selectedText}\n\n還有其他天嗎？`, items);
}

async function handleAdvanceWeeklyDone(rt, uid, state) {
  const d = state.flow_data;
  if (!d.selected_days?.length) return replyText(rt, "❌ 請至少選擇一天");
  await setUserState(uid, "advance_weekly_time", d);
  const dayNames = ["日","一","二","三","四","五","六"];
  const selectedText = d.selected_days.map(i => "週" + dayNames[i]).join("、");
  return replyWithQuickReply(rt, `🔁 每週 ${selectedText}\n\n這些天的時段？`, [
    { type:"action", action:{ type:"message", label:"整天無法", text:"週時段:全天" }},
    { type:"action", action:{ type:"message", label:"18:00前無法", text:"週時段:18前" }},
    { type:"action", action:{ type:"message", label:"16:00前無法", text:"週時段:16前" }},
    { type:"action", action:{ type:"message", label:"14:00前無法", text:"週時段:14前" }},
    { type:"action", action:{ type:"message", label:"12:00後無法", text:"週時段:12後" }},
    { type:"action", action:{ type:"message", label:"14:00後無法", text:"週時段:14後" }},
  ]);
}

async function handleAdvanceWeeklyTime(rt, uid, timeText, state) {
  const d = state.flow_data;
  const timeNote = timeText === "全天" ? "整天無法上班" : timeText;
  // 產生當月+下月的日期
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const dates = [];
  const dayNames = ["日","一","二","三","四","五","六"];
  for (let offset = 0; offset < 60; offset++) {
    const dt = new Date(today); dt.setDate(dt.getDate() + offset);
    if (d.selected_days.includes(dt.getDay())) {
      dates.push(dt.toLocaleDateString("sv-SE"));
    }
  }
  const selectedText = d.selected_days.map(i => "週" + dayNames[i]).join("、");
  await setUserState(uid, "advance_weekly_confirm", { ...d, advance_time: timeNote, dates });
  return replyWithQuickReply(rt,
    `📌 每週固定預假確認\n━━━━━━━━━━━━━━\n👤 ${d.employee_name}\n📅 每週 ${selectedText}\n⏰ ${timeNote}\n\n將套用 ${dates.length} 天：\n${dates.slice(0,8).map(dt => dt.slice(5) + "(" + dayNames[new Date(dt).getDay()] + ")").join("、")}${dates.length>8?"...等":""}`,
    [
      { type:"action", action:{ type:"message", label:"✅ 確認登記", text:"確認週預假" }},
      { type:"action", action:{ type:"message", label:"🔙 取消", text:"取消" }},
    ]
  );
}

async function handleAdvanceTime(rt, uid, timeText, state) {
  const d = state.flow_data;
  const timeNote = timeText === "全天" ? "整天無法上班" : timeText;
  await setUserState(uid, "advance_select_date", { ...d, advance_time: timeNote });
  return lineClient.replyMessage({ replyToken: rt, messages: [{ type: "text", text: `📌 預假：${timeNote}\n\n請選擇日期：`, quickReply: { items: [
    { type: "action", action: { type: "datetimepicker", label: "📅 選擇日期", data: "action=advance_date", mode: "date" } },
    { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
  ]}}]});
}

async function handleLeaveDayType(rt, uid, dayType, state) {
  const halfDay = dayType === "full" ? null : dayType;
  await setUserState(uid, "leave_select_date", { ...state.flow_data, half_day: halfDay });
  // 用 LINE datetimepicker 選日期
  return lineClient.replyMessage({ replyToken: rt, messages: [{ type: "text", text: `🏖 ${state.flow_data.leave_label}${halfDay ? "（" + (halfDay === "am" ? "上午" : "下午") + "）" : ""}\n\n請選擇日期：`, quickReply: { items: [
    { type: "action", action: { type: "datetimepicker", label: "📅 選擇日期", data: "action=leave_date", mode: "date" } },
    { type: "action", action: { type: "datetimepicker", label: "📅 結束日期（多天）", data: "action=leave_end_date", mode: "date" } },
    { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
  ]}}]});
}

async function handleLeaveDate(rt, uid, dateText, state) {
  const d = state.flow_data;
  let startDate, endDate;
  if (dateText.includes("~")) {
    [startDate, endDate] = dateText.split("~").map(s => s.trim());
  } else {
    startDate = endDate = dateText.trim();
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return replyText(rt, "❌ 日期格式不正確，請用 YYYY-MM-DD");

  await setUserState(uid, "leave_confirm", { ...d, start_date: startDate, end_date: endDate });
  const dayCount = Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1;
  return replyWithQuickReply(rt,
    `📋 請假確認\n━━━━━━━━━━━━━━\n👤 ${d.employee_name}\n🏖 ${d.leave_label}\n📅 ${startDate}${endDate !== startDate ? ` ~ ${endDate}（${dayCount}天）` : ""}${d.half_day ? `\n⏰ ${d.half_day === "am" ? "上午" : "下午"}半天` : ""}\n\n確認送出申請？`,
    [
      { type: "action", action: { type: "message", label: "✅ 確認送出", text: "確認請假" } },
      { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
    ]
  );
}

async function confirmLeave(rt, uid, state) {
  const d = state.flow_data;

  // 預假：自動核准，寫入 schedules
  if (d.leave_type === "advance") {
    const startDate = d.start_date;
    await supabase.from("schedules").insert({
      employee_id: d.employee_id, date: startDate, type: "leave",
      leave_type: "advance", notes: d.advance_time || "預假",
    });
    await clearUserState(uid);
    // 通知主管
    const { data: mgrs } = await supabase.from("employees").select("line_uid")
      .in("role", ["admin", "store_manager"]).eq("is_active", true);
    for (const m of mgrs || []) {
      if (m.line_uid && m.line_uid !== uid) await pushText(m.line_uid, `📌 預假通知\n👤 ${d.employee_name}\n📅 ${startDate}\n⏰ ${d.advance_time || "整天"}`).catch(() => {});
    }
    return replyWithQuickReply(rt, `✅ 預假已登記\n\n📅 ${startDate}\n⏰ ${d.advance_time || "整天"}\n\n排班時會自動避開此日`, getMenu("staff"));
  }

  // 其他假：送出申請
  const res = await fetch(`${process.env.SITE_URL || "https://sugarbistro-ops.zeabur.app"}/api/admin/leaves`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", employee_id: d.employee_id, leave_type: d.leave_type, start_date: d.start_date, end_date: d.end_date, half_day: d.half_day }),
  });
  await clearUserState(uid);
  return replyWithQuickReply(rt, `✅ 請假申請已送出！\n\n🏖 ${d.leave_label}\n📅 ${d.start_date}${d.end_date !== d.start_date ? ` ~ ${d.end_date}` : ""}${d.half_day ? `（${d.half_day === "am" ? "上午" : "下午"}）` : ""}\n\n⏳ 等待主管核准`, getMenu("staff"));
}

// ===== 加班事前申請流程 =====
async function startOTRequest(rt, emp) {
  await setUserState(emp.line_uid, "ot_select_date", { employee_id: emp.id, employee_name: emp.name, store_id: emp.store_id });
  return replyWithQuickReply(rt, `⏱ 加班申請\n👤 ${emp.name}\n\n📌 事前申請可避免事後追補\n📌 主管核准後，下班打卡自動成立\n\n選擇加班日期：`, [
    { type: "action", action: { type: "message", label: "📅 今日", text: "加班日:今日" } },
    { type: "action", action: { type: "message", label: "📅 明日", text: "加班日:明日" } },
    { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
  ]);
}

async function handleOTDate(rt, uid, dateCode, state) {
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const target = new Date(today);
  if (dateCode === "明日") target.setDate(target.getDate() + 1);
  const dateStr = target.toLocaleDateString("sv-SE");

  // 檢查當日是否有排班
  const { data: sch } = await supabase.from("schedules")
    .select("*, shifts(name, start_time, end_time)")
    .eq("employee_id", state.flow_data.employee_id)
    .eq("date", dateStr).eq("type", "shift").maybeSingle();
  if (!sch || !sch.shifts) {
    await clearUserState(uid);
    return replyText(rt, `❌ ${dateStr} 無排班，無法申請加班。\n請先確認排班表，或聯繫主管。`);
  }

  await setUserState(uid, "ot_select_minutes", { ...state.flow_data, date: dateStr, shift_end: sch.shifts.end_time });
  return replyWithQuickReply(rt, `📅 ${dateStr}（排班 ${sch.shifts.start_time?.slice(0,5)}~${sch.shifts.end_time?.slice(0,5)}）\n\n預估加班時數：`, [
    { type: "action", action: { type: "message", label: "30 分", text: "加班時數:30" } },
    { type: "action", action: { type: "message", label: "60 分", text: "加班時數:60" } },
    { type: "action", action: { type: "message", label: "90 分", text: "加班時數:90" } },
    { type: "action", action: { type: "message", label: "120 分", text: "加班時數:120" } },
    { type: "action", action: { type: "message", label: "180 分", text: "加班時數:180" } },
    { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
  ]);
}

async function handleOTMinutes(rt, uid, mins, state) {
  await setUserState(uid, "ot_select_pref", { ...state.flow_data, requested_minutes: Number(mins) });
  return replyWithQuickReply(rt, `⏱ 預估加班 ${mins} 分鐘\n\n選擇結算方式：`, [
    { type: "action", action: { type: "message", label: "💵 加班費", text: "加班方式:pay" } },
    { type: "action", action: { type: "message", label: "🔄 補休", text: "加班方式:comp" } },
    { type: "action", action: { type: "message", label: "🤝 由主管決定", text: "加班方式:auto" } },
    { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
  ]);
}

async function handleOTPref(rt, uid, pref, state) {
  await setUserState(uid, "ot_input_reason", { ...state.flow_data, comp_pref: pref });
  return replyText(rt, `請輸入加班原因（簡述，例：客流暴增、月底盤點、新品上市備料）：`);
}

async function confirmOTRequest(rt, uid, reason, state) {
  const d = state.flow_data;
  const prefLabel = { pay: "💵 加班費", comp: "🔄 補休", auto: "🤝 由主管決定" }[d.comp_pref] || "?";

  // 寫入 overtime_records (status=requested, is_pre_approved=true)
  const { data: rec, error } = await supabase.from("overtime_records").insert({
    employee_id: d.employee_id, store_id: d.store_id, date: d.date,
    requested_minutes: d.requested_minutes, request_reason: reason,
    request_comp_pref: d.comp_pref, is_pre_approved: true,
    status: "requested", overtime_minutes: 0, amount: 0, rate: 0,
    requested_at: new Date().toISOString(),
  }).select().single();
  if (error) {
    await clearUserState(uid);
    return replyText(rt, "❌ 申請失敗：" + error.message);
  }

  await clearUserState(uid);

  // 推店長/區經理
  try {
    const { getStoreManagers } = await import("@/lib/notify");
    const recipients = await getStoreManagers(supabase, d.store_id);
    const { data: st } = await supabase.from("stores").select("name").eq("id", d.store_id).single();
    const msg = `📩 加班申請待核准\n👤 ${d.employee_name}（${st?.name || ""}）\n📅 ${d.date}\n⏱ 預估 ${d.requested_minutes} 分鐘\n💼 ${prefLabel}\n📝 ${reason}\n\n核准請輸入：加班核准:${rec.id.slice(0,8)}\n退回請輸入：加班退回:${rec.id.slice(0,8)}`;
    for (const r of recipients) await pushText(r.line_uid, msg).catch(() => {});
  } catch {}

  return replyText(rt, `✅ 加班申請已送出\n\n📅 ${d.date}\n⏱ ${d.requested_minutes} 分鐘\n💼 ${prefLabel}\n📝 ${reason}\n\n⏳ 等待主管核准（核准後下班打卡自動成立）`);
}

async function handleOTReview(rt, emp, otIdShort, decision) {
  // 只有主管/區經理/admin 可核准
  if (!["store_manager", "manager", "admin"].includes(emp.role)) {
    return replyText(rt, "❌ 你沒有核准加班的權限");
  }
  // 用前 8 碼 prefix 找
  const { data: rec } = await supabase.from("overtime_records")
    .select("*, employees(name, line_uid), stores(name)")
    .ilike("id", otIdShort + "%").eq("status", "requested").single();
  if (!rec) return replyText(rt, "❌ 找不到對應的加班申請（或已處理）");

  // store_manager 只能核准自己店的
  if (emp.role === "store_manager" && rec.store_id !== emp.store_id) {
    return replyText(rt, "❌ 你只能核准本店的加班申請");
  }

  let updates = { status: decision === "approve" ? "approved" : "rejected", reviewed_by: emp.id, reviewed_at: new Date().toISOString() };

  if (decision === "approve") {
    // 套用申請者偏好；auto 預設先設 pay，等實際打卡再決定
    const pref = rec.request_comp_pref === "comp" ? "comp" : "pay";
    updates.comp_type = pref === "comp" ? "comp" : "pending";
  }

  await supabase.from("overtime_records").update(updates).eq("id", rec.id);

  const tag = decision === "approve" ? "✅ 已核准" : "❌ 已退回";
  // 通知員工
  if (rec.employees?.line_uid) {
    await pushText(rec.employees.line_uid,
      `${tag} 加班申請\n📅 ${rec.date}\n⏱ ${rec.requested_minutes} 分鐘\n📝 ${rec.request_reason || ""}` +
      (decision === "approve" ? `\n\n下班打卡時將自動成立加班記錄` : `\n\n如有疑問請聯繫主管`)
    ).catch(() => {});
  }

  return replyText(rt, `${tag}\n👤 ${rec.employees?.name}（${rec.stores?.name || ""}）\n📅 ${rec.date} ⏱ ${rec.requested_minutes}min`);
}

// ===== 日結/存款/營收（保持原有功能，精簡版）=====
async function matchStore(name) {
  if (!name) return null;
  const { data: stores } = await supabase.from("stores").select("*").eq("is_active", true);
  if (!stores) return null;
  for (const s of stores) {
    if (s.name.includes("台北") && name.includes("台北")) return s;
    if (s.name.includes("屏東") && name.includes("屏東")) return s;
    if (s.name.includes("左營") && (name.includes("左營") || name.includes("新光"))) return s;
    if (s.name.toLowerCase().includes("skm") && name.toLowerCase().includes("skm")) return s;
  }
  return null;
}
async function uploadImage(b64, folder, fn) {
  const buf = Buffer.from(b64, "base64");
  // 檔名只用英數避免中文 URL 問題
  const safeFn = fn.replace(/[^a-zA-Z0-9_-]/g, "");
  const path = `${folder}/${safeFn}.jpg`;
  await supabase.storage.from("receipts").upload(path, buf, { contentType: "image/jpeg", upsert: true });
  return supabase.storage.from("receipts").getPublicUrl(path).data.publicUrl;
}
async function checkDuplicateSerials(sns, vt) {
  if (!sns?.length) return { duplicates: [], newSerials: sns || [] };
  const { data: ex } = await supabase.from("voucher_serials").select("serial_number, date, stores!store_id(name)").eq("voucher_type", vt).in("serial_number", sns);
  const dups = ex || []; const dupNums = dups.map(d => d.serial_number);
  return { duplicates: dups, newSerials: sns.filter(s => !dupNums.includes(s)) };
}

const RECEIPT_STEPS = [
  { flow: "receipt_ubereats", field: "uber_eat_amount" },
  { flow: "receipt_meal_voucher", field: "meal_voucher_amount" },
  { flow: "receipt_line_credit", field: "line_credit_amount" },
  { flow: "receipt_drink_voucher", field: "drink_voucher_amount" },
];
function getNextStep(data, cur) {
  let found = cur === null;
  for (const s of RECEIPT_STEPS) { if (found && Number(data[s.field]||0) > 0) return s; if (s.flow === cur) found = true; }
  return null;
}
function stepPrompt(step, data) {
  const m = { receipt_ubereats:`🛵 UberEats ${fmt(data.uber_eat_amount)}\n上傳對帳單`, receipt_meal_voucher:`🎫 餐券 ${fmt(data.meal_voucher_amount)}\n上傳餐券（含流水號）`, receipt_line_credit:`📱 LINE儲值金 ${fmt(data.line_credit_amount)}\n上傳單據`, receipt_drink_voucher:`🎫 飲料券 ${fmt(data.drink_voucher_amount)}\n上傳飲料券` };
  return (m[step.flow]||"") + "\n\n📸 請拍照上傳";
}

async function startSettlement(rt, emp) {
  if (emp.store_id && emp.stores) {
    await setUserState(emp.line_uid, "settlement_photo", { employee_name: emp.name, employee_id: emp.id, store_id: emp.store_id, store_name: emp.stores.name });
    return replyText(rt, `💰 日結回報\n👤 ${emp.name}\n🏠 ${emp.stores.name}\n\n📸 拍照上傳 POS 日結單`);
  }
  const { data: stores } = await supabase.from("stores").select("*").eq("is_active", true);
  await setUserState(emp.line_uid, "settlement_select_store", { employee_name: emp.name, employee_id: emp.id });
  return replyWithQuickReply(rt, `💰 日結回報\n👤 ${emp.name}\n\n選擇門市：`, (stores||[]).map(s => ({ type: "action", action: { type: "message", label: s.name, text: `日結門市:${s.name}` } })));
}
async function handleStoreSelect(rt, uid, name, state) {
  const store = await matchStore(name); if (!store) return replyText(rt, "❌ 找不到門市");
  await setUserState(uid, "settlement_photo", { ...state.flow_data, store_id: store.id, store_name: store.name });
  const uploadUrl = `${SITE}/upload?type=settlement&store_id=${store.id}&store_name=${encodeURIComponent(store.name)}&employee_id=${state.flow_data.employee_id}&employee_name=${encodeURIComponent(state.flow_data.employee_name)}`;
  return lineClient.replyMessage({ replyToken: rt, messages: [{ type: "text", text: `🏠 ${store.name}｜👤 ${state.flow_data.employee_name}\n\n📸 直接拍照上傳 POS 日結單\n\n或用網頁上傳多張：`, quickReply: { items: [
    { type: "action", action: { type: "uri", label: "📤 網頁上傳（可多張）", uri: uploadUrl } },
    { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
  ]}}]});
}
async function handleSettlementImg(event, emp, state) {
  const uid = event.source.userId;
  await replyText(event.replyToken, "📸 AI 辨識中...");
  try {
    const b64 = await downloadImageAsBase64(event.message.id);
    const r = await analyzeDailySettlement(b64); if (!r) { await pushText(uid, "❌ 辨識失敗"); return; }
    const rawDt = r.period_end?.split(" ")[0] || new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Taipei"});
    // 防止民國年未轉換：如果年份<2024，可能是民國年，加1911
    let dt = rawDt;
    const dtYear = parseInt(dt.split("-")[0]);
    if (dtYear > 100 && dtYear < 200) dt = (dtYear + 1911) + dt.slice(3); // 115 → 2026
    else if (dtYear < 2024) dt = new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Taipei"}); // fallback今天
    const ctd = r.cash_amount||0; // 應存=現金全額（零用金預留在櫃位，不從應存扣除）
    const img = await uploadImage(b64, "settlements", `${state.flow_data.store_id}_${dt}_${Date.now()}`);
    const sd = { ...state.flow_data, date:dt, period_start:r.period_start, period_end:r.period_end, cashier_name:r.cashier_name||state.flow_data.employee_name, net_sales:r.net_sales||0, discount_total:r.discount_total||0, cash_amount:r.cash_amount||0, line_pay_amount:r.line_pay_amount||0, twqr_amount:r.twqr_amount||0, uber_eat_amount:r.uber_eat_amount||0, easy_card_amount:r.easy_card_amount||0, remittance_amount:r.remittance_amount||0, meal_voucher_amount:r.meal_voucher_amount||0, line_credit_amount:r.line_credit_amount||0, drink_voucher_amount:r.drink_voucher_amount||0, invoice_count:r.invoice_count||0, invoice_start:r.invoice_start, invoice_end:r.invoice_end, void_invoice_count:r.void_invoice_count||0, void_invoice_amount:r.void_invoice_amount||0, void_invoice_numbers:r.void_invoice_numbers||"", cash_in_register:r.cash_in_register||r.cash_amount||0, petty_cash_reserved:r.petty_cash_reserved||0, void_item_count:r.void_item_count||0, void_item_amount:r.void_item_amount||0, cash_to_deposit:ctd, image_url:img, ai_raw_data:r, receipts:[], audit_results:[] };
    await pushText(uid, `📊 ${sd.store_name} ${dt}\n淨額${fmt(r.net_sales)}｜現金${fmt(r.cash_amount)}\nTWQR${fmt(r.twqr_amount)}｜匯款${fmt(r.remittance_amount||0)}\nUber${fmt(r.uber_eat_amount)}｜餐券${fmt(r.meal_voucher_amount)}\n飲料券${fmt(r.drink_voucher_amount||0)}｜LINE儲值${fmt(r.line_credit_amount||0)}\n發票${r.invoice_count||0}張${r.void_invoice_count?" 作廢"+r.void_invoice_count+"張":""}\n應存${fmt(ctd)}`);
    const ns = getNextStep(sd, null);
    if (ns) { await setUserState(uid, ns.flow, sd); await pushText(uid, `✅ POS已辨識\n\n${stepPrompt(ns,sd)}`); }
    else {
      // 存為草稿 + 送出確認連結
      const{data:draft}=await supabase.from("daily_settlements").upsert({store_id:sd.store_id,date:dt,period_start:sd.period_start,period_end:sd.period_end,cashier_name:sd.cashier_name,net_sales:sd.net_sales,discount_total:sd.discount_total,cash_amount:sd.cash_amount,line_pay_amount:sd.line_pay_amount,twqr_amount:sd.twqr_amount,uber_eat_amount:sd.uber_eat_amount,easy_card_amount:sd.easy_card_amount,remittance_amount:sd.remittance_amount||0,meal_voucher_amount:sd.meal_voucher_amount,line_credit_amount:sd.line_credit_amount,drink_voucher_amount:sd.drink_voucher_amount,invoice_count:sd.invoice_count,invoice_start:sd.invoice_start,invoice_end:sd.invoice_end,void_invoice_count:sd.void_invoice_count,void_invoice_amount:sd.void_invoice_amount,void_invoice_numbers:sd.void_invoice_numbers||"",cash_in_register:sd.cash_in_register,petty_cash_reserved:sd.petty_cash_reserved,void_item_count:sd.void_item_count||0,void_item_amount:sd.void_item_amount||0,cash_to_deposit:sd.cash_to_deposit,image_url:sd.image_url,ai_raw_data:sd.ai_raw_data,submitted_by:sd.employee_id,submitted_at:new Date().toISOString(),status:"draft"},{onConflict:"store_id,date"}).select().single();
      const reviewUrl = `${SITE}/settlement-review?id=${draft?.id||""}`;
      await setUserState(uid, "settlement_confirm", sd);
      await pushText(uid, `✅ AI辨識完成\n\n📝 核對修正：\n${reviewUrl}\n\n或直接確認：`);
      await lineClient.pushMessage({ to:uid, messages:[{type:"text",text:"選擇操作：",quickReply:{items:[{type:"action",action:{type:"uri",label:"📝 開網頁核對",uri:reviewUrl}},{type:"action",action:{type:"message",label:"✅ 數字正確，直接送出",text:"確認日結"}},{type:"action",action:{type:"message",label:"📸 重拍",text:"重新拍照"}},{type:"action",action:{type:"message",label:"🔙 取消",text:"取消"}}]}}] });
    }
  } catch(e) { await pushText(uid, "❌ "+e.message); }
}
async function handleReceiptImg(event, state) {
  const uid = event.source.userId, flow = state.current_flow;
  await replyText(event.replyToken, "📸 稽核中...");
  try {
    const b64 = await downloadImageAsBase64(event.message.id), data = state.flow_data;
    let ai, msg="", serials=[];
    if (flow==="receipt_ubereats") { ai=await analyzeUberEatsReceipt(b64); serials=ai?.serial_numbers||[]; const diff=Math.abs((data.uber_eat_amount||0)-(ai?.total_amount||0)); msg=diff<=50?`✅ UberEats吻合`:`⚠️ UberEats差異${fmt(diff)}`; }
    else if (flow==="receipt_meal_voucher") { ai=await analyzeVoucher(b64,"meal"); serials=ai?.serial_numbers||[]; const{duplicates,newSerials}=await checkDuplicateSerials(serials,"meal"); msg=duplicates.length?`🚨 重複餐券${duplicates.length}張`:`✅ 餐券${serials.length}張通過`; serials=newSerials; }
    else if (flow==="receipt_line_credit") { ai=await analyzeLineCreditReceipt(b64); msg=`✅ LINE儲值金已記錄`; }
    else if (flow==="receipt_drink_voucher") { ai=await analyzeVoucher(b64,"drink"); serials=ai?.serial_numbers||[]; const{duplicates,newSerials}=await checkDuplicateSerials(serials,"drink"); msg=duplicates.length?`🚨 重複飲料券${duplicates.length}張`:`✅ 飲料券${serials.length}張通過`; serials=newSerials; }
    const type=flow.replace("receipt_",""), imgUrl=await uploadImage(b64,"receipts_detail",`${type}_${Date.now()}`);
    data.receipts=data.receipts||[]; data.receipts.push({type,image_url:imgUrl,ai_raw_data:ai,serial_numbers:serials});
    data.audit_results=data.audit_results||[]; data.audit_results.push({type,message:msg,has_issue:msg.includes("🚨")||msg.includes("⚠️")});
    // 累計張數
    const stepCount = data.receipts.filter(r=>r.type===type).length;
    await setUserState(uid, flow, data);
    await pushText(uid, msg + `\n（本項第 ${stepCount} 張）`);
    // 問是否還有更多
    const typeLabel = {ubereats:"UberEats",meal_voucher:"餐券",line_credit:"LINE儲值金",drink_voucher:"飲料券"}[type]||type;
    await lineClient.pushMessage({to:uid,messages:[{type:"text",text:`還有更多${typeLabel}照片嗎？`,quickReply:{items:[
      {type:"action",action:{type:"message",label:"📸 繼續拍下一張",text:"繼續拍照"}},
      {type:"action",action:{type:"message",label:`✅ ${typeLabel}完成`,text:"單據完成"}},
    ]}}]});
  } catch(e) { await pushText(uid, "❌ "+e.message); }
}
async function skipStep(uid, state) {
  // 檢查該步驟是否有金額 → 有金額不能跳過
  const data=state.flow_data;
  const stepField = RECEIPT_STEPS.find(s=>s.flow===state.current_flow);
  if (stepField && Number(data[stepField.field]||0) > 0) {
    return "❌ " + ({receipt_ubereats:"UberEats",receipt_meal_voucher:"餐券",receipt_line_credit:"LINE儲值金",receipt_drink_voucher:"飲料券"}[state.current_flow]||"此項") + "有 " + fmt(data[stepField.field]) + "，必須上傳單據稽核\n\n📸 請拍照上傳";
  }
  data.audit_results=data.audit_results||[]; data.audit_results.push({type:state.current_flow.replace("receipt_",""),message:"⏭️跳過（金額$0）",has_issue:false});
  const ns=getNextStep(data,state.current_flow);
  if(ns){await setUserState(uid,ns.flow,data);return stepPrompt(ns,data);}
  // 完成 → 存草稿 + 送網頁核對
  const d=data;const dt=d.date;
  const{data:draft}=await supabase.from("daily_settlements").upsert({store_id:d.store_id,date:dt,net_sales:d.net_sales,cash_amount:d.cash_amount,twqr_amount:d.twqr_amount,uber_eat_amount:d.uber_eat_amount,meal_voucher_amount:d.meal_voucher_amount,drink_voucher_amount:d.drink_voucher_amount,line_credit_amount:d.line_credit_amount,remittance_amount:d.remittance_amount||0,cash_to_deposit:d.cash_to_deposit,image_url:d.image_url,ai_raw_data:d.ai_raw_data,submitted_by:d.employee_id,status:"draft"},{onConflict:"store_id,date"}).select().single();
  const reviewUrl=`${SITE}/settlement-review?id=${draft?.id||""}`;
  await setUserState(uid,"settlement_confirm",data);
  await lineClient.pushMessage({to:uid,messages:[{type:"text",text:"選擇操作：",quickReply:{items:[{type:"action",action:{type:"uri",label:"📝 開網頁核對",uri:reviewUrl}},{type:"action",action:{type:"message",label:"✅ 直接送出",text:"確認日結"}},{type:"action",action:{type:"message",label:"🔙 取消",text:"取消"}}]}}]});
  return null;
}
async function confirmSettlement(uid, emp) {
  const state=await getUserState(uid); if(!state||state.current_flow!=="settlement_confirm") return false;
  const d=state.flow_data;
  if(!d.image_url){await pushText(uid,"❌ 日結必須上傳照片才能送出");return false;}
  const{data:stl,error}=await supabase.from("daily_settlements").upsert({store_id:d.store_id,date:d.date,period_start:d.period_start,period_end:d.period_end,cashier_name:d.cashier_name,net_sales:d.net_sales,discount_total:d.discount_total,cash_amount:d.cash_amount,line_pay_amount:d.line_pay_amount,twqr_amount:d.twqr_amount,uber_eat_amount:d.uber_eat_amount,easy_card_amount:d.easy_card_amount,remittance_amount:d.remittance_amount||0,meal_voucher_amount:d.meal_voucher_amount,line_credit_amount:d.line_credit_amount,drink_voucher_amount:d.drink_voucher_amount,invoice_count:d.invoice_count,invoice_start:d.invoice_start,invoice_end:d.invoice_end,void_invoice_count:d.void_invoice_count,void_invoice_amount:d.void_invoice_amount,void_invoice_numbers:d.void_invoice_numbers||"",cash_in_register:d.cash_in_register,petty_cash_reserved:d.petty_cash_reserved,void_item_count:d.void_item_count||0,void_item_amount:d.void_item_amount||0,cash_to_deposit:d.cash_to_deposit,image_url:d.image_url,ai_raw_data:d.ai_raw_data,submitted_by:d.employee_id,submitted_at:new Date().toISOString(),status:"confirmed"},{onConflict:"store_id,date"}).select().single();
  if(error){console.error(error);return false;}
  if(d.receipts?.length&&stl){for(const r of d.receipts){await supabase.from("settlement_receipts").insert({settlement_id:stl.id,receipt_type:r.type,image_url:r.image_url,serial_numbers:r.serial_numbers,ai_raw_data:r.ai_raw_data});if((r.type==="meal_voucher"||r.type==="drink_voucher")&&r.serial_numbers?.length){for(const sn of r.serial_numbers){await supabase.from("voucher_serials").insert({serial_number:sn,voucher_type:r.type==="meal_voucher"?"meal":"drink",store_id:d.store_id,settlement_id:stl.id,date:d.date});}}}}
  const{data:adm}=await supabase.from("employees").select("line_uid").eq("role","admin").eq("is_active",true);
  if(adm)for(const a of adm)if(a.line_uid&&a.line_uid!==uid)await pushText(a.line_uid,`📊 日結 ${d.store_name} ${d.date}\n淨額${fmt(d.net_sales)}`).catch(()=>{});
  await clearUserState(uid);return true;
}

// ===== 存款 =====
async function startDeposit(rt,emp){
  const uploadUrl=`${SITE}/upload?type=deposit&store_id=${emp.store_id}&store_name=${encodeURIComponent(emp.stores?.name||"")}&employee_id=${emp.id}&employee_name=${encodeURIComponent(emp.name)}`;
  if(emp.store_id&&emp.stores){await setUserState(emp.line_uid,"deposit_photo",{employee_name:emp.name,employee_id:emp.id,store_id:emp.store_id,store_name:emp.stores.name});return lineClient.replyMessage({replyToken:rt,messages:[{type:"text",text:`🏦 存款回報\n👤 ${emp.name}\n🏠 ${emp.stores.name}\n\n📸 直接拍照上傳存款單\n或用網頁上傳多張：`,quickReply:{items:[{type:"action",action:{type:"uri",label:"📤 網頁上傳",uri:uploadUrl}},{type:"action",action:{type:"message",label:"🔙 取消",text:"取消"}}]}}]});}const{data:stores}=await supabase.from("stores").select("*").eq("is_active",true);await setUserState(emp.line_uid,"deposit_select_store",{employee_name:emp.name,employee_id:emp.id});return replyWithQuickReply(rt,`🏦 存款回報\n👤 ${emp.name}`,stores.map(s=>({type:"action",action:{type:"message",label:s.name,text:`存款門市:${s.name}`}})));}
async function handleDepStore(rt,uid,name,state){const store=await matchStore(name);if(!store)return replyText(rt,"❌");const{data:last}=await supabase.from("deposits").select("deposit_date").eq("store_id",store.id).order("deposit_date",{ascending:false}).limit(1).single();await setUserState(uid,"deposit_photo",{...state.flow_data,store_id:store.id,store_name:store.name,period_start:last?new Date(new Date(last.deposit_date).getTime()+86400000).toISOString().split("T")[0]:null});const uploadUrl=`${SITE}/upload?type=deposit&store_id=${store.id}&store_name=${encodeURIComponent(store.name)}&employee_id=${state.flow_data.employee_id}&employee_name=${encodeURIComponent(state.flow_data.employee_name)}`;return lineClient.replyMessage({replyToken:rt,messages:[{type:"text",text:`🏦 ${store.name}\n\n📸 直接拍照上傳存款單\n或用網頁上傳多張：`,quickReply:{items:[{type:"action",action:{type:"uri",label:"📤 網頁上傳",uri:uploadUrl}},{type:"action",action:{type:"message",label:"🔙 取消",text:"取消"}}]}}]});}
async function handleDepImg(event,emp,state){const uid=event.source.userId;await replyText(event.replyToken,"🏦 辨識中...");try{const b64=await downloadImageAsBase64(event.message.id);const r=await analyzeDepositSlip(b64);if(!r){await pushText(uid,"❌ 辨識失敗");return;}const d=state.flow_data,depDate=r.deposit_date||new Date().toISOString().split("T")[0],pStart=d.period_start||new Date(Date.now()-7*86400000).toISOString().split("T")[0];const img=await uploadImage(b64,"deposits",`${d.store_id}_${depDate}_${Date.now()}`);
  // 存為待確認，顯示資訊讓員工核對
  await setUserState(uid,"deposit_confirm",{...d,deposit_date:depDate,amount:r.deposit_amount||0,bank_name:r.bank_name,bank_branch:r.bank_branch,account_number:r.account_number,roc_date:r.roc_date,period_start:pStart,period_end:depDate,image_url:img,ai_raw_data:r});
  await pushText(uid,`🏦 存款辨識結果\n━━━━━━━━━━━━━━\n🏠 ${d.store_name}\n💰 存款金額：${fmt(r.deposit_amount||0)}\n🏦 ${r.bank_name||""} ${r.bank_branch||""}\n📅 存款日期：${depDate}\n📅 對帳區間：${pStart} ~ ${depDate}\n\n請確認以上資訊：`);
  await lineClient.pushMessage({to:uid,messages:[{type:"text",text:"選擇操作：",quickReply:{items:[
    {type:"action",action:{type:"message",label:"✅ 確認送出",text:"確認存款"}},
    {type:"action",action:{type:"message",label:"📅 修改區間",text:"修改存款區間"}},
    {type:"action",action:{type:"message",label:"💰 修改金額",text:"修改存款金額"}},
    {type:"action",action:{type:"message",label:"📸 重拍",text:"重新拍照"}},
    {type:"action",action:{type:"message",label:"🔙 取消",text:"取消"}},
  ]}}]});
  }catch(e){await pushText(uid,"❌ "+e.message);}}
async function confirmDeposit(rt,uid,state,emp){
  const d=state.flow_data;
  const{data:stls}=await supabase.from("daily_settlements").select("cash_to_deposit,cash_amount").eq("store_id",d.store_id).gte("date",d.period_start).lte("date",d.period_end);
  const exp=(stls||[]).reduce((s,r)=>s+Number(r.cash_amount||0),0);
  const amt=Number(d.amount)||0,diff=amt-exp,abs=Math.abs(diff);
  let st,em,tx;if(abs<=500){st="matched";em="✅";tx="吻合";}else if(abs<=2000){st="minor_diff";em="⚠️";tx="小差異";}else{st="anomaly";em="🚨";tx="異常";}
  await supabase.from("deposits").insert({store_id:d.store_id,deposit_date:d.deposit_date,amount:amt,bank_name:d.bank_name,bank_branch:d.bank_branch,account_number:d.account_number,depositor_name:d.employee_name,roc_date:d.roc_date,period_start:d.period_start,period_end:d.period_end,expected_cash:exp,difference:diff,status:st,image_url:d.image_url,ai_raw_data:d.ai_raw_data,submitted_by:d.employee_id});
  if(st!=="matched"){const{data:adm}=await supabase.from("employees").select("line_uid").eq("role","admin").eq("is_active",true);if(adm)for(const a of adm)if(a.line_uid&&a.line_uid!==uid)await pushText(a.line_uid,`${em} 存款${tx} ${d.store_name}｜${d.employee_name}\n${fmt(amt)} vs ${fmt(exp)}（${d.period_start}~${d.period_end}）`).catch(()=>{});}
  await clearUserState(uid);
  return replyWithQuickReply(rt,`✅ 存款已登記\n\n🏠 ${d.store_name}\n💰 ${fmt(amt)} vs 應存 ${fmt(exp)}\n📅 ${d.period_start} ~ ${d.period_end}\n${em} ${tx}`,getMenu(emp?.role||"staff"));
}

async function queryRevenue(rt){const today=new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Taipei"});const{data}=await supabase.from("daily_settlements").select("*, stores!store_id(name)").eq("date",today);if(!data?.length)return replyText(rt,`📊 ${today} 無日結`);let msg=`📊 ${today}\n`,tot=0;for(const s of data){msg+=`🔹${s.stores?.name} ${fmt(s.net_sales)}\n`;tot+=Number(s.net_sales||0);}msg+=`💰 合計${fmt(tot)}`;return replyText(rt,msg);}

// ===== 主事件 =====
async function handleEvent(event) {
  const userId = event.source.userId, emp = await getEmployee(userId), state = await getUserState(userId);

  // 圖片訊息：webhook 不處理（serverless 10s timeout 風險），請走網頁 /upload
  if (event.type === "message" && event.message.type === "image") {
    return;
  }

  // Postback 事件（LINE 日期選擇器回傳）
  if (event.type === "postback") {
    const pb = event.postback;
    const rt = event.replyToken;

    // 休息日加班同意書（不需要 state）
    if (pb.data?.startsWith("action=rest_consent_")) {
      const params = new URLSearchParams(pb.data);
      const action = params.get("action");
      const sid = params.get("schedule_id");
      const accepted = action === "rest_consent_accept";
      const newStatus = accepted ? "agreed" : "declined";
      const { data: sch } = await supabase.from("schedules")
        .update({ rest_consent: newStatus, rest_consent_at: new Date().toISOString(),
                  status: accepted ? "scheduled" : "cancelled" })
        .eq("id", sid).select("*, employees(name), shifts(start_time, end_time)").single();
      // 通知主管
      const { data: mgrs } = await supabase.from("employees").select("line_uid")
        .in("role", ["store_manager", "manager", "admin"]).eq("is_active", true);
      const tag = accepted ? "✅ 已同意" : "❌ 已拒絕";
      const sh = sch?.shifts;
      const shiftStr = sh ? `${(sh.start_time||"").slice(0,5)}~${(sh.end_time||"").slice(0,5)}` : "";
      for (const m of mgrs || []) {
        if (m.line_uid && m.line_uid !== userId) {
          await pushText(m.line_uid, `${tag} 休息日加班\n👤 ${sch?.employees?.name || ""}\n📅 ${sch?.date || ""} ${shiftStr}` + (accepted ? "" : "\n⚠️ 請重新安排此日排班")).catch(() => {});
        }
      }
      return replyText(rt, accepted
        ? `✅ 已同意 ${sch?.date || ""} 休息日加班\n依法將以加班費階梯計薪`
        : `❌ 已拒絕 ${sch?.date || ""} 休息日加班\n排班已取消，主管已收到通知`);
    }

    if (!state) return;

    // 補打卡：選日期
    if (pb.data === "action=amend_date" && state.current_flow === "amend_date") {
      const date = pb.params?.date;
      if (!date) return replyText(rt, "❌ 請選擇日期");
      await setUserState(userId, "amend_type", { ...state.flow_data, date });
      return replyWithQuickReply(rt, "📅 " + date + "\n請選擇打卡類型：", [
        { type: "action", action: { type: "message", label: "🌅 上班", text: "補登:clock_in" } },
        { type: "action", action: { type: "message", label: "🌙 下班", text: "補登:clock_out" } },
        { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
      ]);
    }
    // 補打卡：選時間
    if (pb.data === "action=amend_time" && state.current_flow === "amend_time") {
      const time = pb.params?.time;
      if (!time) return replyText(rt, "❌ 請選擇時間");
      await setUserState(userId, "amend_reason", { ...state.flow_data, amended_time: time });
      return replyWithQuickReply(rt,
        "🕐 " + time + "\n請選擇或輸入補打卡原因：",
        [
          { type: "action", action: { type: "message", label: "忘記打卡", text: "忘記打卡" } },
          { type: "action", action: { type: "message", label: "手機沒電", text: "手機沒電" } },
          { type: "action", action: { type: "message", label: "GPS 失效", text: "GPS 失效" } },
          { type: "action", action: { type: "message", label: "系統異常", text: "系統異常" } },
          { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
        ]
      );
    }

    // 預假日期選擇
    if (pb.data === "action=advance_date" && state.current_flow === "advance_select_date") {
      const date = pb.params?.date;
      if (!date) return replyText(rt, "❌ 請選擇日期");
      const d = state.flow_data;
      await setUserState(userId, "leave_confirm", { ...d, leave_type: "advance", start_date: date, end_date: date });
      return replyWithQuickReply(rt,
        `📌 預假確認\n━━━━━━━━━━━━━━\n👤 ${d.employee_name}\n📅 ${date}\n⏰ ${d.advance_time || "整天"}\n\n確認登記？`,
        [
          { type: "action", action: { type: "message", label: "✅ 確認", text: "確認請假" } },
          { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
        ]
      );
    }

    // 請假開始日期
    if (pb.data === "action=leave_date" && state.current_flow === "leave_select_date") {
      const date = pb.params?.date;
      if (!date) return replyText(rt, "❌ 請選擇日期");
      await setUserState(userId, "leave_select_date", { ...state.flow_data, start_date_temp: date });
      return handleLeaveDate(rt, userId, date, state);
    }

    // 請假結束日期（多天）
    if (pb.data === "action=leave_end_date" && state.current_flow === "leave_select_date") {
      const date = pb.params?.date;
      if (!date) return replyText(rt, "❌ 請選擇日期");
      const start = state.flow_data.start_date_temp;
      if (!start) return replyText(rt, "❌ 請先選擇開始日期");
      return handleLeaveDate(rt, userId, start + "~" + date, state);
    }

    return;
  }

  if (event.type !== "message" || event.message.type !== "text") return;
  const text = event.message.text.trim(), rt = event.replyToken;

  if (text.startsWith("綁定")) { const code = text.replace(/^綁定\s*/, "").trim(); return code ? handleBinding(rt, userId, code) : replyText(rt, "格式：綁定 123456"); }

  // 新人報到（不需要綁定就能用）
  if (text === "新人報到") {
    await setUserState(userId, "onboard_name", {});
    return replyText(rt, "🍯 歡迎加入小食糖！\n\n請輸入你的姓名（全名）：");
  }
  if (state?.current_flow === "onboard_name") {
    await setUserState(userId, "onboard_store", { name: text, line_uid: userId });
    const { data: stores } = await supabase.from("stores").select("*").eq("is_active", true);
    return replyWithQuickReply(rt, `👤 ${text}，你好！\n\n請選擇你的門市：`,
      (stores || []).map(s => ({ type: "action", action: { type: "message", label: s.name, text: `報到門市:${s.name}` } }))
    );
  }
  if (state?.current_flow === "onboard_store" && (text.startsWith("報到門市:") || text.length <= 20)) {
    const storeName = text.startsWith("報到門市:") ? text.replace("報到門市:", "") : text;
    const store = await matchStore(storeName);
    if (!store) {
      const { data: stores } = await supabase.from("stores").select("name").eq("is_active", true);
      return replyText(rt, `❌ 找不到門市「${storeName}」\n\n可用門市：\n${(stores||[]).map(s=>"・"+s.name).join("\n")}\n\n請重新輸入或點選按鈕`);
    }
    const d = state.flow_data;
    const token = crypto.randomBytes(16).toString("hex");
    await supabase.from("onboarding_records").insert({
      line_uid: userId, name: d.name, store_id: store?.id, store_name: store?.name || storeName, token,
    });
    await clearUserState(userId);
    const url = `${process.env.SITE_URL || "https://sugarbistro-ops.zeabur.app"}/onboarding?token=${token}`;
    return lineClient.replyMessage({ replyToken: rt, messages: [
      { type: "text", text: `✅ 新人報到登記\n\n👤 ${d.name}\n🏠 ${store?.name || storeName}\n\n接下來請閱讀員工守則並完成電子簽署：` },
      { type: "template", altText: "員工守則簽署", template: { type: "buttons", title: "📋 員工行為規範與工作守則", text: "請閱讀完整內容並簽署確認", actions: [{ type: "uri", label: "開始閱讀並簽署", uri: url }] } },
    ]});
  }

  if (!emp) return replyText(rt, "🍯 歡迎！\n\n新員工請輸入「新人報到」\n已有帳號請輸入「綁定 你的6位數綁定碼」");

  // 打卡 / 面板（Rich Menu 按鈕對應）— 必須優先處理，避免被未知訊息阻擋
  if (text === "上班打卡") return handleClockAction(rt, emp, "clock_in");
  if (text === "下班打卡") return handleClockAction(rt, emp, "clock_out");
  if (text === "面板" || text === "我的面板" || text === "📱 面板") {
    const SITE = process.env.SITE_URL || "https://sugarbistro-ops.zeabur.app";
    const panelUrl = `${SITE}/me?eid=${emp.id}`;
    return lineClient.replyMessage({ replyToken: rt, messages: [{
      type: "template", altText: "開啟我的面板",
      template: {
        type: "buttons",
        title: `🍯 ${emp.name} 的面板`,
        text: `${getRoleLabel(emp.role)}｜${emp.stores?.name || "總部"}`,
        actions: [{ type: "uri", label: "📱 開啟面板", uri: panelUrl }],
      }
    }]});
  }
  // 其他訊息不回應（保留 a8d0f48 的策略）
  return;
  if (text === "取消" || text === "選單" || text === "主選單" || text === "menu") { await clearUserState(userId); return replyWithQuickReply(rt, "🍯 " + getRoleLabel(emp.role) + " " + emp.name, getMenu(emp.role).slice(0, 13)); }

  // （以下原打卡 handler 已移到上方）

  // ✦13 補打卡申請
  if (text === "補打卡") {
    await setUserState(userId, "amend_date", { employee_id: emp.id, store_id: emp.store_id });
    return lineClient.replyMessage({ replyToken: rt, messages: [{
      type: "text", text: "🔧 補打卡申請\n\n請選擇要補的日期：",
      quickReply: { items: [
        { type: "action", action: { type: "datetimepicker", label: "📅 選擇日期", data: "action=amend_date", mode: "date" } },
        { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
      ]}
    }]});
  }
  if (text.startsWith("補登:") && state?.current_flow === "amend_type") {
    const amendType = text.replace("補登:", "");
    await setUserState(userId, "amend_time", { ...state.flow_data, type: amendType });
    return lineClient.replyMessage({ replyToken: rt, messages: [{
      type: "text", text: "請選擇實際" + (amendType === "clock_in" ? "上班" : "下班") + "時間：",
      quickReply: { items: [
        { type: "action", action: { type: "datetimepicker", label: "🕐 選擇時間", data: "action=amend_time", mode: "time" } },
        { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
      ]}
    }]});
  }
  if (state?.current_flow === "amend_reason") {
    const d = state.flow_data;
    await supabase.from("clock_amendments").insert({
      employee_id: d.employee_id, store_id: d.store_id,
      date: d.date, type: d.type, amended_time: d.amended_time, reason: text,
    });
    await clearUserState(userId);
    const { data: mgrs } = await supabase.from("employees")
      .select("line_uid").eq("store_id", d.store_id)
      .in("role", ["store_manager", "manager", "admin"]).eq("is_active", true);
    for (const m of mgrs || []) {
      if (m.line_uid) {
        await pushText(m.line_uid,
          "🔧 補打卡申請\n👤 " + emp.name + "\n📅 " + d.date +
          " " + (d.type === "clock_in" ? "上班" : "下班") + " " + d.amended_time +
          "\n📝 " + text
        ).catch(() => {});
      }
    }
    return replyWithQuickReply(rt,
      "✅ 補打卡申請已送出\n\n📅 " + d.date + " " +
      (d.type === "clock_in" ? "上班" : "下班") + " " + d.amended_time +
      "\n📝 " + text + "\n\n⏳ 等待主管核准",
      getMenu(emp.role)
    );
  }
  if (state?.current_flow === "amend_reason") {
    const d = state.flow_data;
    await supabase.from("clock_amendments").insert({
      employee_id: d.employee_id, store_id: d.store_id,
      date: d.date, type: d.type, amended_time: d.amended_time, reason: text,
    });
    await clearUserState(userId);
    // 通知主管
    const { data: mgrs } = await supabase.from("employees")
      .select("line_uid").eq("store_id", d.store_id)
      .in("role", ["store_manager", "manager", "admin"]).eq("is_active", true);
    for (const m of mgrs || []) {
      if (m.line_uid) {
        await pushText(m.line_uid,
          "🔧 補打卡申請\n👤 " + emp.name + "\n📅 " + d.date +
          " " + (d.type === "clock_in" ? "上班" : "下班") + " " + d.amended_time +
          "\n📝 " + text
        ).catch(() => {});
      }
    }
    return replyWithQuickReply(rt,
      "✅ 補打卡申請已送出\n\n📅 " + d.date + " " +
      (d.type === "clock_in" ? "上班" : "下班") + " " + d.amended_time +
      "\n📝 " + text + "\n\n⏳ 等待主管核准",
      getMenu(emp.role)
    );
  }

  // ✦17 調班申請
  if (text === "調班申請") {
    const { data: coworkers } = await supabase.from("employees")
      .select("id, name").eq("store_id", emp.store_id).eq("is_active", true).neq("id", emp.id);
    if (!coworkers?.length) return replyText(rt, "❌ 本店目前無其他同事可調班");
    await setUserState(userId, "swap_select_target", { requester_id: emp.id, requester_name: emp.name });
    return replyWithQuickReply(rt, "🔄 調班申請\n\n選擇要調班的對象：",
      coworkers.slice(0, 8).map(c => ({ type: "action", action: { type: "message", label: c.name, text: "調班對象:" + c.id } }))
    );
  }
  if (text.startsWith("調班對象:") && state?.current_flow === "swap_select_target") {
    const targetId = text.replace("調班對象:", "");
    const { data: target } = await supabase.from("employees").select("name").eq("id", targetId).single();
    await setUserState(userId, "swap_select_date", { ...state.flow_data, target_id: targetId, target_name: target?.name });
    return replyText(rt, "🔄 與 " + (target?.name || "") + " 調班\n\n請輸入你要調出的日期（YYYY-MM-DD）：");
  }
  if (state?.current_flow === "swap_select_date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return replyText(rt, "格式錯誤，請輸入 YYYY-MM-DD：");
    await setUserState(userId, "swap_select_date_b", { ...state.flow_data, date_a: text });
    return replyText(rt, "請輸入對方要調給你的日期（YYYY-MM-DD）：");
  }
  if (state?.current_flow === "swap_select_date_b") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return replyText(rt, "格式錯誤，請輸入 YYYY-MM-DD：");
    const d = state.flow_data;
    await supabase.from("swap_requests").insert({
      requester_id: d.requester_id, target_id: d.target_id,
      date_a: d.date_a, date_b: text,
    });
    await clearUserState(userId);
    // 通知主管
    const { data: mgrs } = await supabase.from("employees").select("line_uid")
      .eq("store_id", emp.store_id).in("role", ["store_manager", "manager", "admin"]).eq("is_active", true);
    for (const m of mgrs || []) {
      if (m.line_uid) await pushText(m.line_uid, "🔄 調班申請\n" + d.requester_name + " ↔ " + d.target_name + "\n📅 " + d.date_a + " ↔ " + text + "\n⏳ 待核准").catch(() => {});
    }
    return replyText(rt, "✅ 調班申請已送出\n\n🔄 " + d.requester_name + " ↔ " + d.target_name + "\n📅 " + d.date_a + " ↔ " + text + "\n\n⏳ 等待主管核准");
  }

  if (text === "我的班表") return querySchedule(rt, emp);
  if (text === "我的假勤" || text === "假勤") {
    try {
      const yr = new Date().getFullYear();
      const r = await fetch(`${SITE}/api/admin/leave-balances?employee_id=${emp.id}&year=${yr}`).then(r => r.json());
      const b = r.data || {};
      // 補休到期提醒
      const today2 = new Date().toLocaleDateString("sv-SE");
      const nw = new Date(Date.now() + 14 * 86400000).toLocaleDateString("sv-SE");
      const { data: expComp } = await supabase.from("overtime_records")
        .select("comp_hours, comp_expiry_date").eq("employee_id", emp.id)
        .eq("comp_type", "comp").eq("comp_used", false).eq("comp_converted", false)
        .lte("comp_expiry_date", nw).gte("comp_expiry_date", today2);
      let compMsg = "";
      if (expComp?.length) compMsg = "\n⚠️ 即將到期：" + expComp.map(c => c.comp_hours + "hr(" + c.comp_expiry_date.slice(5) + ")").join("、");
      return replyText(rt, "🏖 " + emp.name + " " + yr + "年假勤\n━━━━━━━━━━━━━━\n📅 特休：" + (b.annual_total||0) + "天（已用" + (b.annual_used||0) + " / 剩" + (b.annual_remaining||0) + "天）\n🏥 病假：已用" + (b.sick_used||0) + " / 30天\n📋 事假：已用" + (b.personal_used||0) + " / 14天" + (b.comp_available > 0 ? "\n🔄 補休：可用" + b.comp_available + "hr" : "") + compMsg);
    } catch(e) { return replyText(rt, "查詢失敗"); }
  }

  // ✦37 薪資查詢
  if (text === "我的薪資" || text === "薪資查詢") {
    const mk = new Date().toLocaleDateString("sv-SE").slice(0, 7);
    const { data: clocks } = await supabase.from("attendances").select("type")
      .eq("employee_id", emp.id).eq("type", "clock_in").gte("date", mk + "-01").lte("date", mk + "-31");
    const wd = (clocks || []).length;
    const base = emp.monthly_salary ? Number(emp.monthly_salary) : (emp.hourly_rate ? Number(emp.hourly_rate) * wd * 8 : 0);
    const { data: ot } = await supabase.from("overtime_records").select("amount")
      .eq("employee_id", emp.id).eq("status", "approved").in("comp_type", ["pay"])
      .gte("date", mk + "-01").lte("date", mk + "-31");
    const otPay = (ot || []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const isPT = emp.employment_type === "parttime";
    const ls = emp.labor_tier ? (isPT ? LABOR_SELF_PT : LABOR_SELF)[emp.labor_tier - 1] || 0 : 0;
    const hs = emp.health_tier ? (isPT ? HEALTH_SELF_PT : HEALTH_SELF)[emp.health_tier - 1] || 0 : 0;
    const net = base + otPay - ls - hs;
    return replyText(rt, "💰 " + emp.name + " " + mk + " 預估薪資\n━━━━━━━━━━━━━━\n📅 出勤 " + wd + " 天\n💵 底薪 " + fmt(base) + (otPay > 0 ? "\n⏱ 加班費 +" + fmt(otPay) : "") + (ls > 0 ? "\n🛡 勞保 -" + fmt(ls) : "") + (hs > 0 ? "\n🏥 健保 -" + fmt(hs) : "") + "\n━━━━━━━━━━━━━━\n💰 預估實發 " + fmt(net) + "\n\n⚠️ 此為預估，實際以月底結算為準");
  }

  // 加班申請流程
  if (text === "加班申請") return startOTRequest(rt, emp);
  if (text.startsWith("加班日:") && state?.current_flow === "ot_select_date") return handleOTDate(rt, userId, text.replace("加班日:", ""), state);
  if (text.startsWith("加班時數:") && state?.current_flow === "ot_select_minutes") return handleOTMinutes(rt, userId, text.replace("加班時數:", ""), state);
  if (text.startsWith("加班方式:") && state?.current_flow === "ot_select_pref") return handleOTPref(rt, userId, text.replace("加班方式:", ""), state);
  if (state?.current_flow === "ot_input_reason" && text && text !== "取消") return confirmOTRequest(rt, userId, text, state);
  if (text.startsWith("加班核准:")) return handleOTReview(rt, emp, text.replace("加班核准:", "").trim(), "approve");
  if (text.startsWith("加班退回:")) return handleOTReview(rt, emp, text.replace("加班退回:", "").trim(), "reject");

  // 請假流程
  if (text === "請假申請" || text === "預休假") return startLeaveRequest(rt, emp);
  if (text.startsWith("假別:") && state?.current_flow === "leave_select_type") return handleLeaveType(rt, userId, text.replace("假別:", ""), state);
  if (text.startsWith("預假模式:") && state?.current_flow === "advance_select_mode") return handleAdvanceMode(rt, userId, text.replace("預假模式:", ""), state);
  if (text.startsWith("預假:") && state?.current_flow === "advance_select_time") return handleAdvanceTime(rt, userId, text.replace("預假:", ""), state);
  if (text.startsWith("預假週:") && state?.current_flow === "advance_weekly_days") return handleAdvanceWeekday(rt, userId, text.replace("預假週:", ""), state);
  if (text === "預假週完成" && state?.current_flow === "advance_weekly_days") return handleAdvanceWeeklyDone(rt, userId, state);
  if (text.startsWith("週時段:") && state?.current_flow === "advance_weekly_time") return handleAdvanceWeeklyTime(rt, userId, text.replace("週時段:", ""), state);
  if (text === "確認週預假" && state?.current_flow === "advance_weekly_confirm") {
    const d = state.flow_data;
    for (const date of d.dates || []) {
      await supabase.from("schedules").upsert({ employee_id: d.employee_id, date, type: "leave", leave_type: "advance", notes: d.advance_time || "預假" }, { onConflict: "employee_id,date" });
    }
    await clearUserState(userId);
    const dayNames = ["日","一","二","三","四","五","六"];
    const { data: mgrs } = await supabase.from("employees").select("line_uid").in("role",["admin","store_manager"]).eq("is_active",true);
    for (const m of mgrs||[]) if(m.line_uid&&m.line_uid!==userId) await pushText(m.line_uid, `📌 每週預假\n👤 ${d.employee_name}\n📅 每週${d.selected_days.map(i=>"週"+dayNames[i]).join("、")}\n⏰ ${d.advance_time}\n📋 共${d.dates.length}天`).catch(()=>{});
    return replyWithQuickReply(rt, `✅ 每週預假已登記！\n\n📅 共 ${d.dates.length} 天\n⏰ ${d.advance_time}\n\n排班時會自動避開`, getMenu(emp.role));
  }
  if (text.startsWith("天數:") && state?.current_flow === "leave_select_day_type") return handleLeaveDayType(rt, userId, text.replace("天數:", ""), state);
  if (state?.current_flow === "leave_select_date") return handleLeaveDate(rt, userId, text, state);
  if (text === "確認請假" && state?.current_flow === "leave_confirm") return confirmLeave(rt, userId, state);

  // 日結
  if (text.startsWith("日結門市:") && state?.current_flow === "settlement_select_store") return handleStoreSelect(rt, userId, text.replace("日結門市:", ""), state);
  if (text === "日結回報") return startSettlement(rt, emp);
  if (text === "確認日結") { const ok = await confirmSettlement(userId, emp); return ok ? replyWithQuickReply(rt, "✅ 已儲存！", getMenu(emp.role)) : replyText(rt, "❌ 失敗"); }
  if (text === "重新拍照") {
    if (state?.current_flow?.includes("settlement") && state?.flow_data?.store_id) { await setUserState(userId, "settlement_photo", { employee_name: state.flow_data.employee_name, employee_id: state.flow_data.employee_id, store_id: state.flow_data.store_id, store_name: state.flow_data.store_name }); return replyText(rt, "📸 重新拍照"); }
    if (state?.current_flow?.includes("expense") && state?.flow_data?.store_id) { await setUserState(userId, "expense_photo", state.flow_data); return replyText(rt, "📸 請重新拍照上傳單據"); }
  }
  if (text === "跳過" && state?.current_flow?.startsWith("receipt_")) { const m = await skipStep(userId, state); return m ? replyText(rt, m) : undefined; }
  if (text === "繼續拍照" && state?.current_flow?.startsWith("receipt_")) { return replyText(rt, "📸 請繼續拍照上傳"); }
  if (text === "單據完成" && state?.current_flow?.startsWith("receipt_")) {
    const data = state.flow_data;
    const ns = getNextStep(data, state.current_flow);
    if (ns) { await setUserState(userId, ns.flow, data); return replyText(rt, stepPrompt(ns, data)); }
    // 全部完成 → 存草稿 + 網頁核對
    const d = data, dt = d.date;
    const{data:draft}=await supabase.from("daily_settlements").upsert({store_id:d.store_id,date:dt,net_sales:d.net_sales,cash_amount:d.cash_amount,twqr_amount:d.twqr_amount,uber_eat_amount:d.uber_eat_amount,meal_voucher_amount:d.meal_voucher_amount,drink_voucher_amount:d.drink_voucher_amount,line_credit_amount:d.line_credit_amount,remittance_amount:d.remittance_amount||0,cash_to_deposit:d.cash_to_deposit,image_url:d.image_url,ai_raw_data:d.ai_raw_data,submitted_by:d.employee_id,status:"draft"},{onConflict:"store_id,date"}).select().single();
    const reviewUrl = `${SITE}/settlement-review?id=${draft?.id||""}`;
    await setUserState(userId, "settlement_confirm", data);
    const auditSummary = (data.audit_results||[]).map(a=>a.message).join("\n");
    await pushText(userId, `✅ 所有單據稽核完成\n${auditSummary}\n\n📝 核對修正：\n${reviewUrl}`);
    return lineClient.pushMessage({to:userId,messages:[{type:"text",text:"選擇操作：",quickReply:{items:[{type:"action",action:{type:"uri",label:"📝 開網頁核對",uri:reviewUrl}},{type:"action",action:{type:"message",label:"✅ 直接送出",text:"確認日結"}},{type:"action",action:{type:"message",label:"🔙 取消",text:"取消"}}]}}]});
  }

  // 存款
  if (text.startsWith("存款門市:") && state?.current_flow === "deposit_select_store") return handleDepStore(rt, userId, text.replace("存款門市:", ""), state);
  if (text === "存款回報") return startDeposit(rt, emp);
  if (text === "確認存款" && state?.current_flow === "deposit_confirm") return confirmDeposit(rt, userId, state, emp);
  if (text === "修改存款區間" && state?.current_flow === "deposit_confirm") {
    return replyText(rt, "請輸入對帳區間\n\n格式：YYYY-MM-DD~YYYY-MM-DD\n例如：2026-04-07~2026-04-13");
  }
  if (text === "修改存款金額" && state?.current_flow === "deposit_confirm") {
    return replyText(rt, "請輸入正確存款金額（純數字）：");
  }
  if (state?.current_flow === "deposit_confirm" && text.includes("~")) {
    const [s,e] = text.split("~").map(x=>x.trim());
    if (/^\d{4}-\d{2}-\d{2}$/.test(s) && /^\d{4}-\d{2}-\d{2}$/.test(e)) {
      await setUserState(userId, "deposit_confirm", { ...state.flow_data, period_start: s, period_end: e });
      return replyWithQuickReply(rt, `✅ 區間已修改：${s} ~ ${e}\n\n確認送出？`, [
        { type:"action", action:{ type:"message", label:"✅ 確認送出", text:"確認存款" }},
        { type:"action", action:{ type:"message", label:"🔙 取消", text:"取消" }},
      ]);
    }
  }
  if (state?.current_flow === "deposit_confirm" && /^\d+$/.test(text)) {
    await setUserState(userId, "deposit_confirm", { ...state.flow_data, amount: Number(text) });
    return replyWithQuickReply(rt, `✅ 金額已修改：${fmt(Number(text))}\n\n確認送出？`, [
      { type:"action", action:{ type:"message", label:"✅ 確認送出", text:"確認存款" }},
      { type:"action", action:{ type:"message", label:"🔙 取消", text:"取消" }},
    ]);
  }
  if (text === "今日營收") return queryRevenue(rt);

  // 盤點
  if (text === "盤點" || text === "進貨") {
    const store = emp.store_id && emp.stores ? emp.stores : null;
    if (!store) return replyText(rt, "❌ 請先綁定門市");
    const url = `${SITE}/worklog?eid=${emp.id}&sid=${emp.store_id}&name=${encodeURIComponent(emp.name)}`;
    return lineClient.replyMessage({ replyToken: rt, messages: [{ type: "text", text: `📋 盤點和進貨已整合到工作日誌中\n\n點下方開啟：`, quickReply: { items: [{ type: "action", action: { type: "uri", label: "📋 開啟工作日誌", uri: url } }] } }] });
  }

  // 報廢登記（直接導向工作日誌的閉店分頁並自動開啟報廢表單）
  if (text === "報廢" || text === "報廢登記") {
    const store = emp.store_id && emp.stores ? emp.stores : null;
    if (!store) return replyText(rt, "❌ 請先綁定門市");
    const url = `${SITE}/worklog?eid=${emp.id}&sid=${emp.store_id}&name=${encodeURIComponent(emp.name)}&tab=closing&waste=1`;
    return lineClient.replyMessage({ replyToken: rt, messages: [{ type: "text", text: `🗑 食材報廢登記\n🏠 ${store.name}｜👤 ${emp.name}\n\n4 區（冷藏/冷凍/常溫/展示櫃）巡邏，丟棄時拍照佐證`, quickReply: { items: [{ type: "action", action: { type: "uri", label: "🗑 開啟報廢登記", uri: url } }] } }] });
  }

  // 工作日誌
  if (text === "工作日誌" || text === "日誌") {
    const store = emp.store_id && emp.stores ? emp.stores : null;
    if (!store) return replyText(rt, "❌ 請先綁定門市");
    const url = `${SITE}/worklog?eid=${emp.id}&sid=${emp.store_id}&name=${encodeURIComponent(emp.name)}`;
    return lineClient.replyMessage({ replyToken: rt, messages: [{ type: "text", text: `📋 工作日誌\n🏠 ${store.name}｜👤 ${emp.name}\n\n含工作清單、盤點、進貨、清潔`, quickReply: { items: [{ type: "action", action: { type: "uri", label: "📋 開啟工作日誌", uri: url } }] } }] });
  }

  // 銷售回報（拍 POS 品項銷售統計）
  if (text === "銷售回報") {
    const store = emp.store_id && emp.stores ? emp.stores : null;
    if (!store) return replyText(rt, "❌ 請先綁定門市");
    await setUserState(emp.line_uid, "sales_photo", { employee_id: emp.id, employee_name: emp.name, store_id: emp.store_id, store_name: store.name });
    return replyText(rt, `📊 POS 銷售回報\n🏠 ${store.name}\n\n請截圖或拍照 iCHEF「品項銷售統計」\n（報表中心 → 品項銷售統計 → 今日）\n\n📸 拍照上傳`);
  }

  // 月結單據
  if (text === "月結單據") {
    if (emp.store_id && emp.stores) {
      await setUserState(userId, "expense_photo", { employee_id: emp.id, employee_name: emp.name, expense_type: "vendor", store_id: emp.store_id, store_name: emp.stores.name });
      const u = `${SITE}/upload?type=expense&expense_type=vendor&store_id=${emp.store_id}&store_name=${encodeURIComponent(emp.stores.name)}&employee_id=${emp.id}&employee_name=${encodeURIComponent(emp.name)}`;
      return lineClient.replyMessage({ replyToken: rt, messages: [{ type: "text", text: `📦 月結廠商單據\n👤 ${emp.name}\n🏠 ${emp.stores.name}\n\n📸 直接拍照，或網頁批次上傳：`, quickReply: { items: [{ type: "action", action: { type: "uri", label: "📤 多張上傳/Excel", uri: u } }] } }] });
    }
    const { data: stores } = await supabase.from("stores").select("*").eq("is_active", true);
    await setUserState(userId, "expense_select_store", { employee_id: emp.id, employee_name: emp.name, expense_type: "vendor" });
    return replyWithQuickReply(rt, "📦 月結廠商單據\n👤 " + emp.name + "\n\n選擇門市：", stores.map(s => ({ type: "action", action: { type: "message", label: s.name, text: `費用門市:${s.name}` } })));
  }
  if (text === "零用金") {
    if (emp.store_id && emp.stores) {
      await setUserState(userId, "expense_photo", { employee_id: emp.id, employee_name: emp.name, expense_type: "petty_cash", store_id: emp.store_id, store_name: emp.stores.name });
      const u = `${SITE}/upload?type=expense&expense_type=petty_cash&store_id=${emp.store_id}&store_name=${encodeURIComponent(emp.stores.name)}&employee_id=${emp.id}&employee_name=${encodeURIComponent(emp.name)}`;
      return lineClient.replyMessage({ replyToken: rt, messages: [{ type: "text", text: `💰 零用金回報\n👤 ${emp.name}\n🏠 ${emp.stores.name}\n\n📸 直接拍照，或網頁批次上傳：`, quickReply: { items: [{ type: "action", action: { type: "uri", label: "📤 多張上傳/Excel", uri: u } }] } }] });
    }
    const { data: stores } = await supabase.from("stores").select("*").eq("is_active", true);
    await setUserState(userId, "expense_select_store", { employee_id: emp.id, employee_name: emp.name, expense_type: "petty_cash" });
    return replyWithQuickReply(rt, "💰 零用金回報\n👤 " + emp.name + "\n\n選擇門市：", stores.map(s => ({ type: "action", action: { type: "message", label: s.name, text: `費用門市:${s.name}` } })));
  }
  if (text === "總部代付") {
    if (emp.store_id && emp.stores) {
      await setUserState(userId, "expense_photo", { employee_id: emp.id, employee_name: emp.name, expense_type: "hq_advance", store_id: emp.store_id, store_name: emp.stores.name });
      const u = `${SITE}/upload?type=expense&expense_type=hq_advance&store_id=${emp.store_id}&store_name=${encodeURIComponent(emp.stores.name)}&employee_id=${emp.id}&employee_name=${encodeURIComponent(emp.name)}`;
      return lineClient.replyMessage({ replyToken: rt, messages: [{ type: "text", text: `🏢 總部代付\n👤 ${emp.name}\n🏠 ${emp.stores.name}\n\n📸 直接拍照，或網頁批次上傳：`, quickReply: { items: [{ type: "action", action: { type: "uri", label: "📤 多張上傳/Excel", uri: u } }] } }] });
    }
    const { data: stores } = await supabase.from("stores").select("*").eq("is_active", true);
    await setUserState(userId, "expense_select_store", { employee_id: emp.id, employee_name: emp.name, expense_type: "hq_advance" });
    return replyWithQuickReply(rt, "🏢 總部代付回報\n👤 " + emp.name + "\n\n選擇歸屬：", [
      { type: "action", action: { type: "message", label: "🏢 總部（全店均攤）", text: "費用門市:總部" } },
      ...stores.map(s => ({ type: "action", action: { type: "message", label: s.name, text: `費用門市:${s.name}` } }))
    ]);
  }
  if (text.startsWith("費用門市:") && state?.current_flow === "expense_select_store") {
    const storeName = text.replace("費用門市:", "");
    let storeId = null, storeLabel = "";
    if (storeName === "總部") {
      storeId = "__hq__";
      storeLabel = "總部（全店均攤）";
    } else {
      const store = await matchStore(storeName);
      if (!store) return replyText(rt, "❌ 找不到門市");
      storeId = store.id;
      storeLabel = store.name;
    }
    await setUserState(userId, "expense_photo", { ...state.flow_data, store_id: storeId, store_name: storeLabel });
    const label = state.flow_data.expense_type === "vendor" ? "廠商送貨單" : state.flow_data.expense_type === "hq_advance" ? "總部代付單據" : "零用金收據";
    const uploadUrl = `${SITE}/upload?type=expense&expense_type=${state.flow_data.expense_type}&store_id=${storeId}&store_name=${encodeURIComponent(storeLabel)}&employee_id=${state.flow_data.employee_id}&employee_name=${encodeURIComponent(state.flow_data.employee_name)}`;
    return lineClient.replyMessage({ replyToken: rt, messages: [{ type: "text", text: `🏠 ${storeLabel}\n\n📸 直接拍照上傳${label}\n或用網頁批次上傳：`, quickReply: { items: [
      { type: "action", action: { type: "uri", label: "📤 網頁上傳（多張/Excel）", uri: uploadUrl } },
    ]}}]});
  }
  // 修改金額
  if (text === "修改金額" && state?.current_flow === "expense_confirm") {
    await setUserState(userId, "expense_edit_amount", state.flow_data);
    return replyText(rt, "請輸入正確金額（純數字）：");
  }
  if (state?.current_flow === "expense_edit_amount") {
    const amt = Number(text);
    if (isNaN(amt) || amt <= 0) return replyText(rt, "請輸入正確的數字金額：");
    const updated = { ...state.flow_data, amount: amt };
    await setUserState(userId, "expense_confirm", updated);
    if (state.flow_data.draft_id) await supabase.from("expenses").update({ amount: amt }).eq("id", state.flow_data.draft_id);
    return replyWithQuickReply(rt, "已修改金額為 " + fmt(amt) + "\n確認送出？", [
      { type: "action", action: { type: "message", label: "✅ 確認", text: "確認費用" } },
      { type: "action", action: { type: "message", label: "✏️ 改廠商", text: "修改廠商" } },
      { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
    ]);
  }
  // 修改廠商
  if (text === "修改廠商" && state?.current_flow === "expense_confirm") {
    await setUserState(userId, "expense_edit_vendor", state.flow_data);
    return replyText(rt, "請輸入正確廠商名稱：");
  }
  if (state?.current_flow === "expense_edit_vendor") {
    const updated = { ...state.flow_data, vendor_name: text };
    await setUserState(userId, "expense_confirm", updated);
    if (state.flow_data.draft_id) await supabase.from("expenses").update({ vendor_name: text }).eq("id", state.flow_data.draft_id);
    return replyWithQuickReply(rt, "已修改廠商為「" + text + "」\n確認送出？", [
      { type: "action", action: { type: "message", label: "✅ 確認", text: "確認費用" } },
      { type: "action", action: { type: "message", label: "✏️ 改金額", text: "修改金額" } },
      { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
    ]);
  }
  // 修改日期
  if (text === "修改日期" && state?.current_flow === "expense_confirm") {
    await setUserState(userId, "expense_edit_date", state.flow_data);
    return replyText(rt, "請輸入正確日期（格式 YYYY-MM-DD，如 2026-04-14）：");
  }
  if (state?.current_flow === "expense_edit_date") {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(text)) return replyText(rt, "格式錯誤，請輸入 YYYY-MM-DD（如 2026-04-14）：");
    const updated = { ...state.flow_data, date: text };
    await setUserState(userId, "expense_confirm", updated);
    if (state.flow_data.draft_id) await supabase.from("expenses").update({ date: text, month_key: text.slice(0, 7) }).eq("id", state.flow_data.draft_id);
    return replyWithQuickReply(rt, "已修改日期為 " + text + "\n確認送出？", [
      { type: "action", action: { type: "message", label: "✅ 確認", text: "確認費用" } },
      { type: "action", action: { type: "message", label: "✏️ 其他修改", text: "修改金額" } },
      { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
    ]);
  }
  // 修改分類
  if (text === "修改分類" && state?.current_flow === "expense_confirm") {
    return replyWithQuickReply(rt, "選擇正確的費用分類：", [
      "食材原料", "包材耗材", "飲料原料", "清潔用品", "設備維修", "租金", "水電費", "瓦斯費", "電信費", "廣告行銷", "印刷費", "其他"
    ].map(c => ({ type: "action", action: { type: "message", label: c, text: "分類:" + c } })));
  }
  if (text.startsWith("分類:") && state?.current_flow === "expense_confirm") {
    const cat = text.replace("分類:", "");
    const updated = { ...state.flow_data, category_suggestion: cat };
    await setUserState(userId, "expense_confirm", updated);
    if (state.flow_data.draft_id) await supabase.from("expenses").update({ category_suggestion: cat }).eq("id", state.flow_data.draft_id);
    return replyWithQuickReply(rt, "已修改分類為「" + cat + "」\n確認送出？", [
      { type: "action", action: { type: "message", label: "✅ 確認", text: "確認費用" } },
      { type: "action", action: { type: "message", label: "✏️ 其他修改", text: "修改金額" } },
      { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
    ]);
  }
  if (text === "確認費用" && state?.current_flow === "expense_confirm") {
    const d = state.flow_data;

    // 阻擋已核准的重複發票號碼
    if (d.invoice_number) {
      let dupQ = supabase.from("expenses")
        .select("id, date, vendor_name, status")
        .eq("invoice_number", d.invoice_number)
        .in("status", ["pending", "approved"]);
      if (d.draft_id) dupQ = dupQ.neq("id", d.draft_id);
      const { data: dup } = await dupQ.limit(1).single();
      if (dup) {
        await clearUserState(userId);
        const statusText = dup.status === "approved" ? "已核准" : "審核中";
        return replyWithQuickReply(rt,
          "❌ 無法送出\n\n🧾 發票 " + d.invoice_number + " 已存在且" + statusText +
          "\n（" + dup.date + " " + (dup.vendor_name || "") + "）\n\n此單據已在系統中，無法重複請款。",
          getMenu(emp.role)
        );
      }
    }

    const cats = await supabase.from("expense_categories").select("*").eq("is_active", true);
    const catList = cats.data || [];
    // 先精確匹配，再用關鍵字匹配
    let cat = catList.find(c => (c.category_name || c.name) === d.category_suggestion);
    if (!cat && (d.vendor_name || d.description)) {
      const searchText = (d.vendor_name || "") + (d.description || "");
      cat = catList.find(c => (c.keywords || "").split(",").some(kw => kw && searchText.includes(kw)));
    }
    const pnlGroup = cat?.pnl_group || "";
    const pnlItem = cat?.pnl_item || "";
    const baseDate = d.date || new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });

    if (d.is_prepaid && d.prepaid_months > 1) {
      // 預付費用：分攤到多個月份
      const monthlyAmt = Math.round(d.amount / d.prepaid_months);
      const startMonth = d.prepaid_start || baseDate.slice(0, 7);
      const [sy, sm] = startMonth.split("-").map(Number);
      const records = [];
      for (let i = 0; i < d.prepaid_months; i++) {
        const m = sm + i;
        const y = sy + Math.floor((m - 1) / 12);
        const mm = ((m - 1) % 12) + 1;
        const mk = y + "-" + String(mm).padStart(2, "0");
        records.push({
          store_id: d.store_id, category_id: cat?.id, expense_type: d.expense_type,
          date: baseDate, amount: monthlyAmt, vendor_name: d.vendor_name,
          description: (d.description || "") + "（預付" + d.prepaid_months + "個月 " + (i + 1) + "/" + d.prepaid_months + "）",
          image_url: d.image_url, ai_raw_data: d.ai_raw_data, submitted_by: d.employee_id, submitted_by_name: d.employee_name,
          month_key: mk, category_suggestion: d.category_suggestion,
          invoice_number: d.invoice_number,
        });
      }
      await supabase.from("expenses").insert(records);
      await clearUserState(userId);
      const { data: admins } = await supabase.from("employees").select("line_uid").eq("role", "admin").eq("is_active", true);
      if (admins) for (const a of admins) if (a.line_uid && a.line_uid !== userId) await pushText(a.line_uid, `📦 預付費用\n${d.store_name}｜${d.employee_name}\n${d.vendor_name || ""} ${fmt(d.amount)}（分${d.prepaid_months}個月 每月${fmt(monthlyAmt)}）`).catch(() => {});
      return replyWithQuickReply(rt, `✅ 預付費用已儲存！\n${d.vendor_name || ""} ${fmt(d.amount)}\n📆 分攤${d.prepaid_months}個月（每月${fmt(monthlyAmt)}）`, getMenu(emp.role));
    }

    // 強制上傳單據
    if (!d.image_url) {
      return replyText(rt, "❌ 必須上傳單據照片才能送出費用申請");
    }
    // 金額必填
    if (!d.amount || Number(d.amount) <= 0) {
      return replyWithQuickReply(rt, "❌ 金額不能為 0，請先填寫金額：", [
        { type: "action", action: { type: "message", label: "✏️ 填金額", text: "修改金額" } },
      ]);
    }

    // 如果有 draft_id，更新草稿為 pending；否則新增
    if (d.draft_id) {
      const isHq2 = d.store_id === "__hq__";
      await supabase.from("expenses").update({
        store_id: isHq2 ? null : d.store_id,
        category_id: cat?.id, expense_type: d.expense_type,
        date: baseDate, amount: d.amount, vendor_name: d.vendor_name || "",
        description: d.description || "", image_url: d.image_url,
        month_key: baseDate.slice(0, 7), category_suggestion: d.category_suggestion,
        invoice_number: d.invoice_number, status: "pending",
      }).eq("id", d.draft_id);
    } else {
      await supabase.from("expenses").insert({
        store_id: d.store_id === "__hq__" ? null : d.store_id,
        category_id: cat?.id, expense_type: d.expense_type,
        date: baseDate, amount: d.amount, vendor_name: d.vendor_name, description: d.description,
        image_url: d.image_url, submitted_by: d.employee_id,
        month_key: baseDate.slice(0, 7), category_suggestion: d.category_suggestion,
        invoice_number: d.invoice_number, status: "pending",
      });
    }
    await clearUserState(userId);
    const { data: admins } = await supabase.from("employees").select("line_uid").eq("role", "admin").eq("is_active", true);
    if (admins) for (const a of admins) if (a.line_uid && a.line_uid !== userId) await pushText(a.line_uid, `📦 ${d.expense_type === "vendor" ? "月結單據" : d.expense_type === "hq_advance" ? "總部代付" : "零用金"}\n${d.store_name}｜${d.employee_name}\n${d.vendor_name || ""} ${fmt(d.amount)}\n📋 ${d.category_suggestion}`).catch(() => {});
    return replyWithQuickReply(rt, `✅ 已儲存！\n${d.vendor_name || ""} ${fmt(d.amount)}`, getMenu(emp.role));
  }

  // 選單（顯示角色功能）
  if (text === "選單") {
    return replyWithQuickReply(rt, `🍯 ${getRoleLabel(emp.role)} ${emp.name}\n🏠 ${emp.stores?.name || "總部"}`, getMenu(emp.role).slice(0, 13));
  }

  // 我的面板 / 面板：推送個人 LIFF 風格面板連結
  if (text === "面板" || text === "我的面板" || text === "📱 面板") {
    const panelUrl = `${SITE}/me?eid=${emp.id}`;
    return lineClient.replyMessage({ replyToken: rt, messages: [{
      type: "template", altText: "開啟我的面板",
      template: {
        type: "buttons",
        title: `🍯 ${emp.name} 的面板`,
        text: `${getRoleLabel(emp.role)}｜${emp.stores?.name || "總部"}`,
        actions: [{ type: "uri", label: "📱 開啟面板", uri: panelUrl }],
      }
    }]});
  }

  return replyWithQuickReply(rt, `🍯 ${getRoleLabel(emp.role)} ${emp.name}\n🏠 ${emp.stores?.name || "總部"}`, getMenu(emp.role).slice(0, 13));
}

export async function POST(request) {
  try {
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const body = await request.clone().json();
      if (body.action === "push_text" && body.line_uid && body.text) {
        await pushText(body.line_uid, body.text);
        return Response.json({ success: true });
      }
    }
    const body = await request.text(); const sig = request.headers.get("x-line-signature"); if (!verifySignature(body, sig)) return new Response("Invalid", { status: 401 }); const { events } = JSON.parse(body); await Promise.all(events.map(handleEvent)); return new Response("OK");
  } catch (e) { console.error(e); return new Response("Error", { status: 500 }); }
}
export async function GET() { return new Response("🍯 Running!"); }
