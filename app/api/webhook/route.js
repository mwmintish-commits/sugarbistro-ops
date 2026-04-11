import crypto from "crypto";
import { replyText, replyWithQuickReply, downloadImageAsBase64, lineConfig, pushText, lineClient } from "@/lib/line";
import { supabase } from "@/lib/supabase";
import { analyzeDailySettlement, analyzeDepositSlip, analyzeUberEatsReceipt, analyzeVoucher, analyzeLineCreditReceipt, analyzeExpenseReceipt } from "@/lib/anthropic";

function verifySignature(body, signature) {
  return crypto.createHmac("SHA256", lineConfig.channelSecret).update(body).digest("base64") === signature;
}
function fmt(n) { return "$" + Number(n || 0).toLocaleString(); }
const DAYS = ["日","一","二","三","四","五","六"];

const MI = (label, text) => ({ type: "action", action: { type: "message", label, text } });
const MU = (label, url) => ({ type: "action", action: { type: "uri", label, uri: url } });
const SITE = process.env.SITE_URL || "https://sugarbistro-ops.zeabur.app";
const MENU_BASE = [MI("📍 上班打卡", "上班打卡"), MI("📍 下班打卡", "下班打卡"), MI("📅 我的班表", "我的班表"), MI("🙋 請假/預休", "請假申請"), MI("🏖 我的假勤", "我的假勤"), MI("💰 日結回報", "日結回報"), MI("🏦 存款回報", "存款回報")];
const MENU_SM = [...MENU_BASE, MI("📦 月結單據", "月結單據"), MI("💰 零用金", "零用金"), MU("🔗 後台", SITE)];
const MENU_MGR = [...MENU_SM, MI("🏢 總部代付", "總部代付"), MI("📊 今日營收", "今日營收")];
const MENU_ADMIN = [MU("🔗 管理後台", SITE), MI("📊 今日營收", "今日營收"), MI("💰 日結回報", "日結回報"), MI("🏦 存款回報", "存款回報"), MI("📦 月結單據", "月結單據"), MI("💰 零用金", "零用金"), MI("🏢 總部代付", "總部代付"), MI("📅 我的班表", "我的班表")];
function getMenu(role) { if (role === "admin") return MENU_ADMIN; if (role === "manager") return MENU_MGR; if (role === "store_manager") return MENU_SM; return MENU_BASE; }
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
async function getEmployee(uid) { const { data } = await supabase.from("employees").select("*, stores(*)").eq("line_uid", uid).eq("is_active", true).single(); return data; }

async function handleBinding(rt, userId, code) {
  const { data: emp } = await supabase.from("employees").select("*, stores(name)").eq("bind_code", code).eq("is_active", true).single();
  if (!emp) return replyText(rt, "❌ 綁定碼無效。格式：綁定 123456");
  if (emp.bind_code_expires && new Date(emp.bind_code_expires) < new Date()) return replyText(rt, "❌ 已過期。");
  await supabase.from("employees").update({ line_uid: userId, bind_code: null, bind_code_expires: null }).eq("id", emp.id);
  return replyWithQuickReply(rt, `✅ 綁定成功！\n${getRoleLabel(emp.role)} ${emp.name}\n🏠 ${emp.stores?.name || "總部"}`, getMenu(emp.role));
}

// ===== 打卡 =====
async function handleClockAction(rt, emp, type) {
  const token = crypto.randomBytes(24).toString("hex");
  await supabase.from("clockin_tokens").insert({ token, employee_id: emp.id, type, store_id: emp.store_id, expires_at: new Date(Date.now() + 600000).toISOString() });
  const url = `${process.env.SITE_URL || "https://sugarbistro-ops.zeabur.app"}/clockin?token=${token}`;
  const label = type === "clock_in" ? "上班" : "下班";
  return lineClient.replyMessage({ replyToken: rt, messages: [{ type: "template", altText: `${label}打卡`, template: { type: "buttons", title: `📍 ${label}打卡`, text: `👤 ${emp.name}\n點擊下方按鈕`, actions: [{ type: "uri", label: `開始${label}打卡`, uri: url }] } }] });
}

// ===== 班表查詢 =====
async function querySchedule(rt, emp) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const end = new Date(Date.now() + 7 * 86400000).toLocaleDateString("sv-SE");
  const { data } = await supabase.from("schedules").select("*, shifts(name, start_time, end_time), stores(name)").eq("employee_id", emp.id).gte("date", today).lte("date", end).order("date");
  if (!data?.length) return replyText(rt, "📅 未來 7 天沒有排班。");
  const leaveMap = { annual:"特休", sick:"病假", personal:"事假", menstrual:"生理假", off:"例假", rest:"休息日" };
  let msg = `📅 ${emp.name} 的班表\n━━━━━━━━━━━━━━\n`;
  for (const s of data) {
    const day = DAYS[new Date(s.date).getDay()];
    const isToday = s.date === today;
    if (s.type === "leave") {
      msg += `${isToday?"👉 ":""}${s.date}（${day}）🏖 ${leaveMap[s.leave_type]||s.leave_type}${s.half_day?`（${s.half_day==="am"?"上午":"下午"}）`:""}\n`;
    } else {
      msg += `${isToday?"👉 ":""}${s.date}（${day}）${s.shifts?.name||""} ${s.shifts?.start_time?.slice(0,5)||""}~${s.shifts?.end_time?.slice(0,5)||""}\n`;
    }
  }
  return replyText(rt, msg);
}

// ===== 請假申請流程 =====
async function startLeaveRequest(rt, emp) {
  await setUserState(emp.line_uid, "leave_select_type", { employee_id: emp.id, employee_name: emp.name });
  return replyWithQuickReply(rt, `🙋 請假/預休申請\n👤 ${emp.name}\n\n請選擇假別：`, [
    { type: "action", action: { type: "message", label: "🏖 特休", text: "假別:annual" } },
    { type: "action", action: { type: "message", label: "🤒 病假", text: "假別:sick" } },
    { type: "action", action: { type: "message", label: "📋 事假", text: "假別:personal" } },
    { type: "action", action: { type: "message", label: "🌸 生理假", text: "假別:menstrual" } },
  ]);
}

async function handleLeaveType(rt, uid, typeCode, state) {
  const typeMap = { annual:"特休", sick:"病假", personal:"事假", menstrual:"生理假" };
  await setUserState(uid, "leave_select_day_type", { ...state.flow_data, leave_type: typeCode, leave_label: typeMap[typeCode] });
  return replyWithQuickReply(rt, `假別：${typeMap[typeCode]}\n\n請選擇：`, [
    { type: "action", action: { type: "message", label: "📅 全日", text: "天數:full" } },
    { type: "action", action: { type: "message", label: "🌅 上午半天", text: "天數:am" } },
    { type: "action", action: { type: "message", label: "🌇 下午半天", text: "天數:pm" } },
  ]);
}

async function handleLeaveDayType(rt, uid, dayType, state) {
  const halfDay = dayType === "full" ? null : dayType;
  await setUserState(uid, "leave_select_date", { ...state.flow_data, half_day: halfDay });
  return replyText(rt, `請輸入休假日期\n\n格式：YYYY-MM-DD\n例如：2026-04-15\n\n或輸入日期區間（全日才適用）：\n2026-04-15~2026-04-17`);
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
    `📋 預休假確認\n━━━━━━━━━━━━━━\n👤 ${d.employee_name}\n🏖 ${d.leave_label}\n📅 ${startDate}${endDate !== startDate ? ` ~ ${endDate}（${dayCount}天）` : ""}${d.half_day ? `\n⏰ ${d.half_day === "am" ? "上午" : "下午"}半天` : ""}\n\n確認送出申請？`,
    [
      { type: "action", action: { type: "message", label: "✅ 確認送出", text: "確認請假" } },
      { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
    ]
  );
}

async function confirmLeave(rt, uid, state) {
  const d = state.flow_data;
  const res = await fetch(`${process.env.SITE_URL || "https://sugarbistro-ops.zeabur.app"}/api/admin/leaves`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", employee_id: d.employee_id, leave_type: d.leave_type, start_date: d.start_date, end_date: d.end_date, half_day: d.half_day }),
  });
  await clearUserState(uid);
  return replyWithQuickReply(rt, `✅ 預休假申請已送出！\n\n🏖 ${d.leave_label}\n📅 ${d.start_date}${d.end_date !== d.start_date ? ` ~ ${d.end_date}` : ""}${d.half_day ? `（${d.half_day === "am" ? "上午" : "下午"}）` : ""}\n\n⏳ 等待主管核准`, getMenu("staff"));
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
  const path = `${folder}/${fn}.jpg`;
  await supabase.storage.from("receipts").upload(path, buf, { contentType: "image/jpeg", upsert: true });
  return supabase.storage.from("receipts").getPublicUrl(path).data.publicUrl;
}
async function checkDuplicateSerials(sns, vt) {
  if (!sns?.length) return { duplicates: [], newSerials: sns || [] };
  const { data: ex } = await supabase.from("voucher_serials").select("serial_number, date, stores(name)").eq("voucher_type", vt).in("serial_number", sns);
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
  return (m[step.flow]||"") + "\n輸入「跳過」略過";
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
  return replyText(rt, `🏠 ${store.name}｜👤 ${state.flow_data.employee_name}\n\n📸 拍照上傳 POS 日結單`);
}
async function handleSettlementImg(event, emp, state) {
  const uid = event.source.userId;
  await replyText(event.replyToken, "📸 AI 辨識中...");
  try {
    const b64 = await downloadImageAsBase64(event.message.id);
    const r = await analyzeDailySettlement(b64); if (!r) { await pushText(uid, "❌ 辨識失敗"); return; }
    const dt = r.period_end?.split(" ")[0] || new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Taipei"});
    const ctd = (r.cash_in_register||r.cash_amount||0) - (r.petty_cash_reserved||0);
    const img = await uploadImage(b64, "settlements", `${state.flow_data.store_name}_${dt}_${Date.now()}`);
    const sd = { ...state.flow_data, date:dt, period_start:r.period_start, period_end:r.period_end, cashier_name:r.cashier_name||state.flow_data.employee_name, net_sales:r.net_sales||0, discount_total:r.discount_total||0, cash_amount:r.cash_amount||0, line_pay_amount:r.line_pay_amount||0, twqr_amount:r.twqr_amount||0, uber_eat_amount:r.uber_eat_amount||0, easy_card_amount:r.easy_card_amount||0, meal_voucher_amount:r.meal_voucher_amount||0, line_credit_amount:r.line_credit_amount||0, drink_voucher_amount:r.drink_voucher_amount||0, invoice_count:r.invoice_count||0, invoice_start:r.invoice_start, invoice_end:r.invoice_end, void_invoice_count:r.void_invoice_count||0, void_invoice_amount:r.void_invoice_amount||0, cash_in_register:r.cash_in_register||r.cash_amount||0, petty_cash_reserved:r.petty_cash_reserved||0, cash_to_deposit:ctd, image_url:img, ai_raw_data:r, receipts:[], audit_results:[] };
    await pushText(uid, `📊 ${sd.store_name} ${dt}\n淨額${fmt(r.net_sales)}｜現金${fmt(r.cash_amount)}｜TWQR${fmt(r.twqr_amount)}\nUberEat${fmt(r.uber_eat_amount)}｜餐券${fmt(r.meal_voucher_amount)}\n應存${fmt(ctd)}`);
    const ns = getNextStep(sd, null);
    if (ns) { await setUserState(uid, ns.flow, sd); await pushText(uid, `✅ POS已辨識\n\n${stepPrompt(ns,sd)}`); }
    else { await setUserState(uid, "settlement_confirm", sd); await pushText(uid, "確認送出？"); await lineClient.pushMessage({ to:uid, messages:[{type:"text",text:"確認？",quickReply:{items:[{type:"action",action:{type:"message",label:"✅確認",text:"確認日結"}},{type:"action",action:{type:"message",label:"🔙取消",text:"取消"}}]}}] }); }
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
    await pushText(uid, msg);
    const ns=getNextStep(data,flow);
    if(ns){await setUserState(uid,ns.flow,data);await pushText(uid,stepPrompt(ns,data));}
    else{await setUserState(uid,"settlement_confirm",data);await lineClient.pushMessage({to:uid,messages:[{type:"text",text:"所有單據完成，確認送出？",quickReply:{items:[{type:"action",action:{type:"message",label:"✅確認",text:"確認日結"}},{type:"action",action:{type:"message",label:"🔙取消",text:"取消"}}]}}]});}
  } catch(e) { await pushText(uid, "❌ "+e.message); }
}
async function skipStep(uid, state) {
  const data=state.flow_data; data.audit_results=data.audit_results||[]; data.audit_results.push({type:state.current_flow.replace("receipt_",""),message:"⏭️跳過",has_issue:true});
  const ns=getNextStep(data,state.current_flow);
  if(ns){await setUserState(uid,ns.flow,data);return stepPrompt(ns,data);}
  await setUserState(uid,"settlement_confirm",data);
  await lineClient.pushMessage({to:uid,messages:[{type:"text",text:"確認送出？",quickReply:{items:[{type:"action",action:{type:"message",label:"✅確認",text:"確認日結"}},{type:"action",action:{type:"message",label:"🔙取消",text:"取消"}}]}}]});
  return null;
}
async function confirmSettlement(uid, emp) {
  const state=await getUserState(uid); if(!state||state.current_flow!=="settlement_confirm") return false;
  const d=state.flow_data;
  const{data:stl,error}=await supabase.from("daily_settlements").upsert({store_id:d.store_id,date:d.date,period_start:d.period_start,period_end:d.period_end,cashier_name:d.cashier_name,net_sales:d.net_sales,discount_total:d.discount_total,cash_amount:d.cash_amount,line_pay_amount:d.line_pay_amount,twqr_amount:d.twqr_amount,uber_eat_amount:d.uber_eat_amount,easy_card_amount:d.easy_card_amount,meal_voucher_amount:d.meal_voucher_amount,line_credit_amount:d.line_credit_amount,drink_voucher_amount:d.drink_voucher_amount,invoice_count:d.invoice_count,invoice_start:d.invoice_start,invoice_end:d.invoice_end,void_invoice_count:d.void_invoice_count,void_invoice_amount:d.void_invoice_amount,cash_in_register:d.cash_in_register,petty_cash_reserved:d.petty_cash_reserved,cash_to_deposit:d.cash_to_deposit,image_url:d.image_url,ai_raw_data:d.ai_raw_data,submitted_by:d.employee_id,submitted_at:new Date().toISOString()},{onConflict:"store_id,date"}).select().single();
  if(error){console.error(error);return false;}
  if(d.receipts?.length&&stl){for(const r of d.receipts){await supabase.from("settlement_receipts").insert({settlement_id:stl.id,receipt_type:r.type,image_url:r.image_url,serial_numbers:r.serial_numbers,ai_raw_data:r.ai_raw_data}).catch(()=>{});if((r.type==="meal_voucher"||r.type==="drink_voucher")&&r.serial_numbers?.length){for(const sn of r.serial_numbers){await supabase.from("voucher_serials").insert({serial_number:sn,voucher_type:r.type==="meal_voucher"?"meal":"drink",store_id:d.store_id,settlement_id:stl.id,date:d.date}).catch(()=>{});}}}}
  const{data:adm}=await supabase.from("employees").select("line_uid").eq("role","admin").eq("is_active",true);
  if(adm)for(const a of adm)if(a.line_uid&&a.line_uid!==uid)await pushText(a.line_uid,`📊 日結 ${d.store_name} ${d.date}\n淨額${fmt(d.net_sales)}`).catch(()=>{});
  await clearUserState(uid);return true;
}

// ===== 存款 =====
async function startDeposit(rt,emp){if(emp.store_id&&emp.stores){await setUserState(emp.line_uid,"deposit_photo",{employee_name:emp.name,employee_id:emp.id,store_id:emp.store_id,store_name:emp.stores.name});return replyText(rt,`🏦 存款回報\n👤 ${emp.name}\n🏠 ${emp.stores.name}\n\n📸 拍照上傳存款單`);}const{data:stores}=await supabase.from("stores").select("*").eq("is_active",true);await setUserState(emp.line_uid,"deposit_select_store",{employee_name:emp.name,employee_id:emp.id});return replyWithQuickReply(rt,`🏦 存款回報\n👤 ${emp.name}`,stores.map(s=>({type:"action",action:{type:"message",label:s.name,text:`存款門市:${s.name}`}})));}
async function handleDepStore(rt,uid,name,state){const store=await matchStore(name);if(!store)return replyText(rt,"❌");const{data:last}=await supabase.from("deposits").select("deposit_date").eq("store_id",store.id).order("deposit_date",{ascending:false}).limit(1).single();await setUserState(uid,"deposit_photo",{...state.flow_data,store_id:store.id,store_name:store.name,period_start:last?new Date(new Date(last.deposit_date).getTime()+86400000).toISOString().split("T")[0]:null});return replyText(rt,`🏦 ${store.name}\n📸 拍照上傳存款單`);}
async function handleDepImg(event,emp,state){const uid=event.source.userId;await replyText(event.replyToken,"🏦 辨識中...");try{const b64=await downloadImageAsBase64(event.message.id);const r=await analyzeDepositSlip(b64);if(!r){await pushText(uid,"❌");return;}const d=state.flow_data,depDate=r.deposit_date||new Date().toISOString().split("T")[0],pStart=d.period_start||new Date(Date.now()-7*86400000).toISOString().split("T")[0];const{data:stls}=await supabase.from("daily_settlements").select("cash_to_deposit,cash_amount,petty_cash_reserved").eq("store_id",d.store_id).gte("date",pStart).lte("date",depDate);const exp=(stls||[]).reduce((s,r)=>s+Number(r.cash_to_deposit||(Number(r.cash_amount||0)-Number(r.petty_cash_reserved||0))),0);const amt=r.deposit_amount||0,diff=amt-exp,abs=Math.abs(diff);let st,em,tx;if(abs<=500){st="matched";em="✅";tx="吻合";}else if(abs<=2000){st="minor_diff";em="⚠️";tx="小差異";}else{st="anomaly";em="🚨";tx="異常";}const img=await uploadImage(b64,"deposits",`${d.store_name}_${depDate}_${Date.now()}`);await supabase.from("deposits").insert({store_id:d.store_id,deposit_date:depDate,amount:amt,bank_name:r.bank_name,bank_branch:r.bank_branch,account_number:r.account_number,depositor_name:d.employee_name,roc_date:r.roc_date,period_start:pStart,period_end:depDate,expected_cash:exp,difference:diff,status:st,image_url:img,ai_raw_data:r,submitted_by:d.employee_id});await pushText(uid,`🏦 ${d.store_name}\n存款${fmt(amt)} vs 應存${fmt(exp)}\n${em} ${tx}`);if(st!=="matched"){const{data:adm}=await supabase.from("employees").select("line_uid").eq("role","admin").eq("is_active",true);if(adm)for(const a of adm)if(a.line_uid)await pushText(a.line_uid,`${em} 存款${tx} ${d.store_name}｜${d.employee_name}\n${fmt(amt)} vs ${fmt(exp)}`).catch(()=>{});}await clearUserState(uid);}catch(e){await pushText(uid,"❌ "+e.message);}}

async function queryRevenue(rt){const today=new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Taipei"});const{data}=await supabase.from("daily_settlements").select("*, stores(name)").eq("date",today);if(!data?.length)return replyText(rt,`📊 ${today} 無日結`);let msg=`📊 ${today}\n`,tot=0;for(const s of data){msg+=`🔹${s.stores?.name} ${fmt(s.net_sales)}\n`;tot+=Number(s.net_sales||0);}msg+=`💰 合計${fmt(tot)}`;return replyText(rt,msg);}

// ===== 主事件 =====
async function handleEvent(event) {
  const userId = event.source.userId, emp = await getEmployee(userId), state = await getUserState(userId);

  if (event.type === "message" && event.message.type === "image") {
    if (!emp) return replyText(event.replyToken, "❌ 請先綁定");
    if (state?.current_flow === "settlement_photo") return handleSettlementImg(event, emp, state);
    if (state?.current_flow === "deposit_photo") return handleDepImg(event, emp, state);
    if (state?.current_flow?.startsWith("receipt_")) return handleReceiptImg(event, state);
    if (state?.current_flow === "expense_photo") {
      const uid2 = event.source.userId;
      await replyText(event.replyToken, "📸 AI 辨識單據中...");
      try {
        const b64 = await downloadImageAsBase64(event.message.id);
        const r = await analyzeExpenseReceipt(b64);
        if (!r) { await pushText(uid2, "❌ 辨識失敗，請重新拍照"); return; }
        const d = state.flow_data;
        const imgUrl = await uploadImage(b64, "expenses", `${d.expense_type}_${d.store_name}_${Date.now()}`);
        const expData = {
          ...d, amount: r.total_amount || 0, vendor_name: r.vendor_name,
          date: r.date, description: r.description || r.items?.map(i => i.name).join("、"),
          category_suggestion: r.category_suggestion || "其他",
          invoice_number: r.invoice_number || null,
          image_url: imgUrl, ai_raw_data: r,
          is_prepaid: r.is_prepaid || false,
          prepaid_months: r.prepaid_months || 1,
          prepaid_start: r.prepaid_start || (r.date || "").slice(0, 7)
        };

        // 檢查發票號碼重複
        let dupWarning = "";
        if (r.invoice_number) {
          const { data: dup } = await supabase.from("expenses")
            .select("id, date, vendor_name")
            .eq("invoice_number", r.invoice_number).limit(1).single();
          if (dup) {
            dupWarning = "\n\n⚠️ 發票號碼 " + r.invoice_number + " 已存在！\n（" + dup.date + " " + (dup.vendor_name || "") + "）\n可能重複請款，請確認";
          }
        }

        await setUserState(uid2, "expense_confirm", expData);
        const typeLabel = d.expense_type === "vendor" ? "📦 月結單據" : d.expense_type === "hq_advance" ? "🏢 總部代付" : "💰 零用金";
        let msg = typeLabel + "辨識結果\n━━━━━━━━━━━━━━";
        msg += "\n🏠 " + d.store_name;
        msg += "\n🏢 " + (r.vendor_name || "未知");
        msg += "\n📅 " + (r.date || "今日");
        msg += "\n💰 " + fmt(r.total_amount);
        msg += "\n📋 " + r.category_suggestion;
        if (r.invoice_number) msg += "\n🧾 " + r.invoice_number;
        if (r.items?.length) msg += "\n" + r.items.map(i => "　▸ " + i.name + " " + fmt(i.amount)).join("\n");
        if (r.is_prepaid && r.prepaid_months > 1) msg += "\n📆 預付" + r.prepaid_months + "月（每月" + fmt(Math.round(r.total_amount / r.prepaid_months)) + "）";
        msg += dupWarning;

        await pushText(uid2, msg);
        await lineClient.pushMessage({ to: uid2, messages: [{ type: "text", text: "請選擇操作：", quickReply: { items: [
          { type: "action", action: { type: "message", label: "✅ 確認送出", text: "確認費用" } },
          { type: "action", action: { type: "message", label: "✏️ 修改金額", text: "修改金額" } },
          { type: "action", action: { type: "message", label: "✏️ 修改廠商", text: "修改廠商" } },
          { type: "action", action: { type: "message", label: "📸 重拍", text: "重新拍照" } },
          { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
        ]}}]});
      } catch (e) { await pushText(uid2, "❌ " + e.message); }
      return;
    }
    return replyText(event.replyToken, "📷 請先選功能再拍照");
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
  if (text.startsWith("報到門市:") && state?.current_flow === "onboard_store") {
    const storeName = text.replace("報到門市:", "");
    const store = await matchStore(storeName);
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
  if (text === "取消" || text === "選單" || text === "主選單" || text === "menu") { await clearUserState(userId); return replyWithQuickReply(rt, "🍯 " + getRoleLabel(emp.role) + " " + emp.name, getMenu(emp.role).slice(0, 13)); }

  // 打卡
  if (text === "上班打卡") return handleClockAction(rt, emp, "clock_in");
  if (text === "下班打卡") return handleClockAction(rt, emp, "clock_out");
  if (text === "我的班表") return querySchedule(rt, emp);
  if (text === "我的假勤" || text === "假勤") {
    try {
      const r = await fetch(`${SITE}/api/admin/leave-balances?employee_id=${emp.id}&year=${new Date().getFullYear()}`).then(r => r.json());
      const b = r.data || {};
      return replyText(rt, `🏖 ${emp.name} ${new Date().getFullYear()}年假勤\n━━━━━━━━━━━━━━\n📅 特休：${b.annual_total || 0}天（已用${b.annual_used || 0} / 剩${b.annual_remaining || 0}天）\n🏥 病假：已用${b.sick_used || 0} / 30天\n📋 事假：已用${b.personal_used || 0} / 14天${b.overtime_comp_total > 0 ? "\n⏱ 加班補休：" + b.overtime_comp_total + "hr" : ""}`);
    } catch(e) { return replyText(rt, "查詢失敗"); }
  }

  // 請假流程
  if (text === "請假申請" || text === "預休假") return startLeaveRequest(rt, emp);
  if (text.startsWith("假別:") && state?.current_flow === "leave_select_type") return handleLeaveType(rt, userId, text.replace("假別:", ""), state);
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
  if (text === "跳過" && state?.current_flow?.startsWith("receipt_")) { const m = await skipStep(userId, state); return m ? replyText(rt, "⏭️\n\n" + m) : undefined; }

  // 存款
  if (text.startsWith("存款門市:") && state?.current_flow === "deposit_select_store") return handleDepStore(rt, userId, text.replace("存款門市:", ""), state);
  if (text === "存款回報") return startDeposit(rt, emp);
  if (text === "今日營收") return queryRevenue(rt);

  // 月結單據
  if (text === "月結單據") {
    if (emp.store_id && emp.stores) {
      await setUserState(userId, "expense_photo", { employee_id: emp.id, employee_name: emp.name, expense_type: "vendor", store_id: emp.store_id, store_name: emp.stores.name });
      return replyText(rt, `📦 月結廠商單據\n👤 ${emp.name}\n🏠 ${emp.stores.name}\n\n📸 請拍照上傳廠商送貨單`);
    }
    const { data: stores } = await supabase.from("stores").select("*").eq("is_active", true);
    await setUserState(userId, "expense_select_store", { employee_id: emp.id, employee_name: emp.name, expense_type: "vendor" });
    return replyWithQuickReply(rt, "📦 月結廠商單據\n👤 " + emp.name + "\n\n選擇門市：", stores.map(s => ({ type: "action", action: { type: "message", label: s.name, text: `費用門市:${s.name}` } })));
  }
  if (text === "零用金") {
    if (emp.store_id && emp.stores) {
      await setUserState(userId, "expense_photo", { employee_id: emp.id, employee_name: emp.name, expense_type: "petty_cash", store_id: emp.store_id, store_name: emp.stores.name });
      return replyText(rt, `💰 零用金回報\n👤 ${emp.name}\n🏠 ${emp.stores.name}\n\n📸 請拍照上傳零用金收據`);
    }
    const { data: stores } = await supabase.from("stores").select("*").eq("is_active", true);
    await setUserState(userId, "expense_select_store", { employee_id: emp.id, employee_name: emp.name, expense_type: "petty_cash" });
    return replyWithQuickReply(rt, "💰 零用金回報\n👤 " + emp.name + "\n\n選擇門市：", stores.map(s => ({ type: "action", action: { type: "message", label: s.name, text: `費用門市:${s.name}` } })));
  }
  if (text === "總部代付") {
    if (emp.store_id && emp.stores) {
      await setUserState(userId, "expense_photo", { employee_id: emp.id, employee_name: emp.name, expense_type: "hq_advance", store_id: emp.store_id, store_name: emp.stores.name });
      return replyText(rt, `🏢 總部代付回報\n👤 ${emp.name}\n🏠 ${emp.stores.name}\n\n📸 請拍照上傳總部代付單據`);
    }
    const { data: stores } = await supabase.from("stores").select("*").eq("is_active", true);
    await setUserState(userId, "expense_select_store", { employee_id: emp.id, employee_name: emp.name, expense_type: "hq_advance" });
    return replyWithQuickReply(rt, "🏢 總部代付回報\n👤 " + emp.name + "\n\n選擇門市：", stores.map(s => ({ type: "action", action: { type: "message", label: s.name, text: `費用門市:${s.name}` } })));
  }
  if (text.startsWith("費用門市:") && state?.current_flow === "expense_select_store") {
    const store = await matchStore(text.replace("費用門市:", ""));
    if (!store) return replyText(rt, "❌ 找不到門市");
    await setUserState(userId, "expense_photo", { ...state.flow_data, store_id: store.id, store_name: store.name });
    const label = state.flow_data.expense_type === "vendor" ? "廠商送貨單" : state.flow_data.expense_type === "hq_advance" ? "總部代付單據" : "零用金收據";
    return replyText(rt, `🏠 ${store.name}\n\n📸 請拍照上傳${label}`);
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
    return replyWithQuickReply(rt, "已修改金額為 " + fmt(amt) + "\n確認送出？", [
      { type: "action", action: { type: "message", label: "✅ 確認", text: "確認費用" } },
      { type: "action", action: { type: "message", label: "✏️ 修改廠商", text: "修改廠商" } },
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
    return replyWithQuickReply(rt, "已修改廠商為「" + text + "」\n確認送出？", [
      { type: "action", action: { type: "message", label: "✅ 確認", text: "確認費用" } },
      { type: "action", action: { type: "message", label: "✏️ 修改金額", text: "修改金額" } },
      { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
    ]);
  }
  if (text === "確認費用" && state?.current_flow === "expense_confirm") {
    const d = state.flow_data;

    // 阻擋已核准的重複發票號碼
    if (d.invoice_number) {
      const { data: dup } = await supabase.from("expenses")
        .select("id, date, vendor_name, status")
        .eq("invoice_number", d.invoice_number)
        .in("status", ["pending", "approved"])
        .limit(1).single();
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

    const cats = await supabase.from("expense_categories").select("id, name").eq("is_active", true);
    const cat = (cats.data || []).find(c => c.name === d.category_suggestion);
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

    await supabase.from("expenses").insert({
      store_id: d.store_id, category_id: cat?.id, expense_type: d.expense_type,
      date: baseDate, amount: d.amount, vendor_name: d.vendor_name, description: d.description,
      image_url: d.image_url, ai_raw_data: d.ai_raw_data, submitted_by: d.employee_id, submitted_by_name: d.employee_name,
      month_key: baseDate.slice(0, 7), category_suggestion: d.category_suggestion,
      invoice_number: d.invoice_number,
    });
    await clearUserState(userId);
    const { data: admins } = await supabase.from("employees").select("line_uid").eq("role", "admin").eq("is_active", true);
    if (admins) for (const a of admins) if (a.line_uid && a.line_uid !== userId) await pushText(a.line_uid, `📦 ${d.expense_type === "vendor" ? "月結單據" : d.expense_type === "hq_advance" ? "總部代付" : "零用金"}\n${d.store_name}｜${d.employee_name}\n${d.vendor_name || ""} ${fmt(d.amount)}\n📋 ${d.category_suggestion}`).catch(() => {});
    return replyWithQuickReply(rt, `✅ 已儲存！\n${d.vendor_name || ""} ${fmt(d.amount)}`, getMenu(emp.role));
  }

  // 選單（顯示角色功能）
  if (text === "選單") {
    return replyWithQuickReply(rt, `🍯 ${getRoleLabel(emp.role)} ${emp.name}\n🏠 ${emp.stores?.name || "總部"}`, getMenu(emp.role).slice(0, 13));
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
