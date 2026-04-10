import crypto from "crypto";
import { replyText, replyWithQuickReply, downloadImageAsBase64, lineConfig, pushText, lineClient } from "@/lib/line";
import { supabase } from "@/lib/supabase";
import { analyzeDailySettlement, analyzeDepositSlip, analyzeUberEatsReceipt, analyzeVoucher, analyzeLineCreditReceipt } from "@/lib/anthropic";

function verifySignature(body, signature) {
  const hash = crypto.createHmac("SHA256", lineConfig.channelSecret).update(body).digest("base64");
  return hash === signature;
}
function fmt(n) { return "$" + Number(n || 0).toLocaleString(); }

const MENU_STAFF = [
  { type: "action", action: { type: "message", label: "📍 上班打卡", text: "上班打卡" } },
  { type: "action", action: { type: "message", label: "📍 下班打卡", text: "下班打卡" } },
  { type: "action", action: { type: "message", label: "💰 日結回報", text: "日結回報" } },
  { type: "action", action: { type: "message", label: "🏦 存款回報", text: "存款回報" } },
  { type: "action", action: { type: "message", label: "📅 我的班表", text: "我的班表" } },
  { type: "action", action: { type: "message", label: "🙋 請假申請", text: "請假申請" } },
];
const MENU_ADMIN = [
  { type: "action", action: { type: "message", label: "📊 全店營收", text: "今日營收" } },
  { type: "action", action: { type: "message", label: "💰 日結回報", text: "日結回報" } },
  { type: "action", action: { type: "message", label: "🏦 存款回報", text: "存款回報" } },
  { type: "action", action: { type: "message", label: "📍 上班打卡", text: "上班打卡" } },
  { type: "action", action: { type: "message", label: "📍 下班打卡", text: "下班打卡" } },
  { type: "action", action: { type: "message", label: "📅 我的班表", text: "我的班表" } },
];
function getMenu(role) { return role === "admin" ? MENU_ADMIN : MENU_STAFF; }
function getRoleLabel(role) { return role === "admin" ? "👑 總部" : role === "manager" ? "🏠 管理" : "👤 員工"; }

// ===== 狀態管理 =====
async function getUserState(uid) { const { data } = await supabase.from("user_states").select("*").eq("line_uid", uid).single(); return data; }
async function setUserState(uid, flow, flowData = {}) { await supabase.from("user_states").upsert({ line_uid: uid, current_flow: flow, flow_data: flowData, updated_at: new Date().toISOString() }); }
async function clearUserState(uid) { await supabase.from("user_states").delete().eq("line_uid", uid); }
async function getEmployee(uid) { const { data } = await supabase.from("employees").select("*, stores(*)").eq("line_uid", uid).eq("is_active", true).single(); return data; }

// ===== 綁定 =====
async function handleBinding(rt, userId, code) {
  const { data: emp } = await supabase.from("employees").select("*, stores(name)").eq("bind_code", code).eq("is_active", true).single();
  if (!emp) return replyText(rt, "❌ 綁定碼無效。格式：綁定 123456");
  if (emp.bind_code_expires && new Date(emp.bind_code_expires) < new Date()) return replyText(rt, "❌ 綁定碼已過期。");
  if (emp.line_uid && emp.line_uid !== userId) return replyText(rt, "❌ 已被其他人綁定。");
  await supabase.from("employees").update({ line_uid: userId, bind_code: null, bind_code_expires: null }).eq("id", emp.id);
  return replyWithQuickReply(rt, `✅ 綁定成功！\n\n👤 ${emp.name}\n${getRoleLabel(emp.role)}\n🏠 ${emp.stores?.name || "總部"}`, getMenu(emp.role));
}

// ===== 打卡：產生 Token 並發送連結 =====
async function handleClockAction(rt, employee, type) {
  const token = crypto.randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10分鐘有效

  await supabase.from("clockin_tokens").insert({
    token, employee_id: employee.id, type,
    store_id: employee.store_id, expires_at: expires.toISOString(),
  });

  // 取得網站 URL（從環境變數或預設）
  const baseUrl = process.env.SITE_URL || process.env.VERCEL_URL || "https://sugarbistro-ops.zeabur.app";
  const url = `${baseUrl}/clockin?token=${token}`;

  const typeLabel = type === "clock_in" ? "上班" : "下班";
  return lineClient.replyMessage({
    replyToken: rt,
    messages: [{
      type: "template",
      altText: `${typeLabel}打卡`,
      template: {
        type: "buttons",
        title: `📍 ${typeLabel}打卡`,
        text: `👤 ${employee.name}\n請點擊下方按鈕完成打卡\n（需開啟定位和相機）`,
        actions: [{
          type: "uri",
          label: `開始${typeLabel}打卡`,
          uri: url,
        }],
      },
    }],
  });
}

// ===== 查詢班表 =====
async function querySchedule(rt, employee) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const weekEnd = new Date(Date.now() + 7 * 86400000).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });

  const { data } = await supabase.from("schedules")
    .select("*, shifts(name, start_time, end_time), stores(name)")
    .eq("employee_id", employee.id)
    .gte("date", today).lte("date", weekEnd)
    .order("date");

  if (!data || data.length === 0) return replyText(rt, "📅 未來 7 天沒有排班。");

  let msg = `📅 ${employee.name} 的班表\n━━━━━━━━━━━━━━\n`;
  for (const s of data) {
    const day = ["日", "一", "二", "三", "四", "五", "六"][new Date(s.date).getDay()];
    const isToday = s.date === today;
    msg += `${isToday ? "👉 " : ""}${s.date}（${day}）\n`;
    msg += `　${s.shifts?.name} ${s.shifts?.start_time?.slice(0, 5)}~${s.shifts?.end_time?.slice(0, 5)}`;
    msg += `｜${s.stores?.name}\n`;
  }
  return replyText(rt, msg);
}

// ===== 門市比對 =====
async function matchStore(name) {
  if (!name) return null;
  const { data: stores } = await supabase.from("stores").select("*").eq("is_active", true);
  if (!stores) return null;
  for (const s of stores) {
    if (s.name.includes("台北") && name.includes("台北")) return s;
    if (s.name.includes("屏東") && name.includes("屏東")) return s;
    if (s.name.includes("左營") && (name.includes("左營") || name.includes("新光"))) return s;
    if (s.name.toLowerCase().includes("skm") && name.toLowerCase().includes("skm")) return s;
    if (s.name.includes(name) || name.includes(s.name)) return s;
  }
  return null;
}

async function uploadImage(base64, folder, filename) {
  const buffer = Buffer.from(base64, "base64");
  const path = `${folder}/${filename}.jpg`;
  await supabase.storage.from("receipts").upload(path, buffer, { contentType: "image/jpeg", upsert: true });
  const { data } = supabase.storage.from("receipts").getPublicUrl(path);
  return data.publicUrl;
}

// ===== 餐券重複檢查 =====
async function checkDuplicateSerials(serialNumbers, voucherType) {
  if (!serialNumbers || serialNumbers.length === 0) return { duplicates: [], newSerials: serialNumbers || [] };
  const { data: existing } = await supabase.from("voucher_serials").select("serial_number, date, stores(name)").eq("voucher_type", voucherType).in("serial_number", serialNumbers);
  const duplicates = existing || [];
  const duplicateNums = duplicates.map(d => d.serial_number);
  const newSerials = serialNumbers.filter(s => !duplicateNums.includes(s));
  return { duplicates, newSerials };
}

// ===== 日結步驟定義 =====
const RECEIPT_STEPS = [
  { flow: "receipt_ubereats", field: "uber_eat_amount", label: "UberEats", icon: "🛵" },
  { flow: "receipt_meal_voucher", field: "meal_voucher_amount", label: "餐券", icon: "🎫" },
  { flow: "receipt_line_credit", field: "line_credit_amount", label: "LINE儲值金", icon: "📱" },
  { flow: "receipt_drink_voucher", field: "drink_voucher_amount", label: "飲料券", icon: "🎫" },
];
function getNextReceiptStep(data, currentFlow) {
  let found = currentFlow === null;
  for (const step of RECEIPT_STEPS) {
    if (found && Number(data[step.field] || 0) > 0) return step;
    if (step.flow === currentFlow) found = true;
  }
  return null;
}
function getReceiptPrompt(step, data) {
  const amount = fmt(data[step.field]);
  const map = {
    receipt_ubereats: `🛵 UberEats ${amount}\n請拍照上傳對帳單（含流水號）\n輸入「跳過」略過`,
    receipt_meal_voucher: `🎫 餐券 ${amount}\n請拍照上傳餐券（含流水號）\n系統自動檢查重複\n輸入「跳過」略過`,
    receipt_line_credit: `📱 LINE儲值金 ${amount}\n請拍照上傳單據\n輸入「跳過」略過`,
    receipt_drink_voucher: `🎫 飲料券 ${amount}\n請拍照上傳飲料券（含流水號）\n系統自動檢查重複\n輸入「跳過」略過`,
  };
  return map[step.flow] || "";
}

// ===== 日結：開始 =====
async function startSettlement(rt, emp) {
  const { data: stores } = await supabase.from("stores").select("*").eq("is_active", true);
  const items = (stores || []).map(s => ({ type: "action", action: { type: "message", label: s.name, text: `日結門市:${s.name}` } }));
  await setUserState(emp.line_uid, "settlement_select_store", { employee_name: emp.name, employee_id: emp.id });
  return replyWithQuickReply(rt, `💰 日結回報\n👤 ${emp.name}\n\n請選擇門市：`, items);
}

async function handleStoreSelection(rt, uid, storeName, state) {
  const store = await matchStore(storeName);
  if (!store) return replyText(rt, "❌ 找不到門市。");
  await setUserState(uid, "settlement_photo", { ...state.flow_data, store_id: store.id, store_name: store.name });
  return replyText(rt, `🏠 ${store.name}｜👤 ${state.flow_data.employee_name}\n\n📸 請拍照上傳 POS 日結單`);
}

async function handleSettlementImage(event, emp, state) {
  const uid = event.source.userId;
  await replyText(event.replyToken, "📸 AI 辨識中，約 10 秒...");
  try {
    const base64 = await downloadImageAsBase64(event.message.id);
    const r = await analyzeDailySettlement(base64);
    if (!r) { await pushText(uid, "❌ 辨識失敗，請重新拍照。"); return; }
    const dateStr = r.period_end ? r.period_end.split(" ")[0] : new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
    const cashToDeposit = (r.cash_in_register || r.cash_amount || 0) - (r.petty_cash_reserved || 0);
    const imageUrl = await uploadImage(base64, "settlements", `${state.flow_data.store_name}_${dateStr}_${Date.now()}`);
    const sd = { ...state.flow_data, date: dateStr, period_start: r.period_start, period_end: r.period_end, cashier_name: r.cashier_name || state.flow_data.employee_name, net_sales: r.net_sales||0, discount_total: r.discount_total||0, cash_amount: r.cash_amount||0, line_pay_amount: r.line_pay_amount||0, twqr_amount: r.twqr_amount||0, uber_eat_amount: r.uber_eat_amount||0, easy_card_amount: r.easy_card_amount||0, meal_voucher_amount: r.meal_voucher_amount||0, line_credit_amount: r.line_credit_amount||0, drink_voucher_amount: r.drink_voucher_amount||0, invoice_count: r.invoice_count||0, invoice_start: r.invoice_start, invoice_end: r.invoice_end, void_invoice_count: r.void_invoice_count||0, void_invoice_amount: r.void_invoice_amount||0, cash_in_register: r.cash_in_register||r.cash_amount||0, petty_cash_reserved: r.petty_cash_reserved||0, cash_to_deposit: cashToDeposit, bonus_item_count: r.bonus_item_count||0, bonus_item_amount: r.bonus_item_amount||0, image_url: imageUrl, ai_raw_data: r, receipts: [], audit_results: [] };
    const msg = `📊 日結辨識\n━━━━━━━━━━━━━━\n🏠 ${sd.store_name}｜${dateStr}\n💰 淨額 ${fmt(r.net_sales)}\n━━━━━━━━━━━━━━\n💵現金 ${fmt(r.cash_amount)}｜📱TWQR ${fmt(r.twqr_amount)}\n🛵UberEat ${fmt(r.uber_eat_amount)}｜🎫餐券 ${fmt(r.meal_voucher_amount)}\n📱LINE儲值 ${fmt(r.line_credit_amount)}｜🎫飲料券 ${fmt(r.drink_voucher_amount)}\n━━━━━━━━━━━━━━\n🧾發票 ${r.invoice_count||0}張｜🏦應存 ${fmt(cashToDeposit)}`;
    await pushText(uid, msg);
    const nextStep = getNextReceiptStep(sd, null);
    if (nextStep) { await setUserState(uid, nextStep.flow, sd); await pushText(uid, `✅ POS單已辨識\n\n${getReceiptPrompt(nextStep, sd)}`); }
    else { await setUserState(uid, "settlement_confirm", sd); await sendFinalConfirm(uid, sd); }
  } catch (e) { console.error(e); await pushText(uid, "❌ 錯誤：" + e.message); }
}

async function handleReceiptImage(event, state) {
  const uid = event.source.userId;
  const flow = state.current_flow;
  await replyText(event.replyToken, "📸 辨識稽核中...");
  try {
    const base64 = await downloadImageAsBase64(event.message.id);
    const data = state.flow_data;
    let ai = null, auditMsg = "", serials = [];
    if (flow === "receipt_ubereats") {
      ai = await analyzeUberEatsReceipt(base64); serials = ai?.serial_numbers||[];
      const diff = Math.abs((data.uber_eat_amount||0)-(ai?.total_amount||0));
      auditMsg = diff<=50 ? `✅ UberEats 吻合 POS:${fmt(data.uber_eat_amount)} 單據:${fmt(ai?.total_amount)}` : `⚠️ UberEats 差異 POS:${fmt(data.uber_eat_amount)} 單據:${fmt(ai?.total_amount)} 差${fmt(diff)}`;
      if (serials.length) auditMsg += `\n📋 ${serials.join(", ")}`;
    } else if (flow === "receipt_meal_voucher") {
      ai = await analyzeVoucher(base64, "meal"); serials = ai?.serial_numbers||[];
      const { duplicates, newSerials } = await checkDuplicateSerials(serials, "meal");
      auditMsg = duplicates.length ? `🚨 重複餐券！${duplicates.map(d=>`❌${d.serial_number}(${d.date}${d.stores?.name||""})`).join(" ")}` : `✅ 餐券通過 ${serials.length}張`;
      auditMsg += ` 面額${fmt(ai?.total_amount)}(POS:${fmt(data.meal_voucher_amount)})`;
      serials = newSerials;
    } else if (flow === "receipt_line_credit") {
      ai = await analyzeLineCreditReceipt(base64); serials = ai?.serial_numbers||[];
      auditMsg = `✅ LINE儲值金 ${fmt(ai?.total_amount)}(POS:${fmt(data.line_credit_amount)})`;
    } else if (flow === "receipt_drink_voucher") {
      ai = await analyzeVoucher(base64, "drink"); serials = ai?.serial_numbers||[];
      const { duplicates, newSerials } = await checkDuplicateSerials(serials, "drink");
      auditMsg = duplicates.length ? `🚨 重複飲料券！${duplicates.map(d=>`❌${d.serial_number}(${d.date})`).join(" ")}` : `✅ 飲料券通過 ${serials.length}張`;
      auditMsg += ` 面額${fmt(ai?.total_amount)}(POS:${fmt(data.drink_voucher_amount)})`;
      serials = newSerials;
    }
    const type = flow.replace("receipt_", "");
    const imgUrl = await uploadImage(base64, "receipts_detail", `${type}_${Date.now()}`);
    data.receipts = data.receipts||[]; data.receipts.push({ type, image_url: imgUrl, ai_raw_data: ai, serial_numbers: serials });
    data.audit_results = data.audit_results||[]; data.audit_results.push({ type, message: auditMsg, has_issue: auditMsg.includes("🚨")||auditMsg.includes("⚠️") });
    await pushText(uid, auditMsg);
    const next = getNextReceiptStep(data, flow);
    if (next) { await setUserState(uid, next.flow, data); await pushText(uid, getReceiptPrompt(next, data)); }
    else { await setUserState(uid, "settlement_confirm", data); await sendFinalConfirm(uid, data); }
  } catch (e) { console.error(e); await pushText(uid, "❌ 錯誤：" + e.message); }
}

async function skipReceiptStep(uid, state) {
  const data = state.flow_data;
  const step = RECEIPT_STEPS.find(s => s.flow === state.current_flow);
  data.audit_results = data.audit_results||[];
  data.audit_results.push({ type: step?.flow?.replace("receipt_","")||"?", message: "⏭️ 跳過", has_issue: true });
  const next = getNextReceiptStep(data, state.current_flow);
  if (next) { await setUserState(uid, next.flow, data); return getReceiptPrompt(next, data); }
  await setUserState(uid, "settlement_confirm", data); await sendFinalConfirm(uid, data); return null;
}

async function sendFinalConfirm(uid, d) {
  let msg = `📋 日結摘要\n━━━━━━━━━━━━━━\n🏠${d.store_name}｜${d.date}｜👤${d.employee_name}\n💰淨額${fmt(d.net_sales)}｜🏦應存${fmt(d.cash_to_deposit)}\n`;
  if (d.audit_results?.length) { msg += `\n━━ 稽核 ━━\n`; for (const a of d.audit_results) msg += `${a.has_issue?"⚠️":"✅"} ${a.type}\n`; }
  msg += `\n📎 ${(d.receipts||[]).length} 份單據`;
  await pushText(uid, msg);
  await lineClient.pushMessage({ to: uid, messages: [{ type: "text", text: "確認送出？", quickReply: { items: [
    { type: "action", action: { type: "message", label: "✅ 確認", text: "確認日結" } },
    { type: "action", action: { type: "message", label: "📸 重拍POS", text: "重新拍照" } },
    { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
  ]}}] });
}

async function confirmSettlement(uid, emp) {
  const state = await getUserState(uid); if (!state || state.current_flow !== "settlement_confirm") return false;
  const d = state.flow_data;
  const { data: stl, error } = await supabase.from("daily_settlements").upsert({ store_id:d.store_id, date:d.date, period_start:d.period_start, period_end:d.period_end, cashier_name:d.cashier_name, net_sales:d.net_sales, discount_total:d.discount_total, cash_amount:d.cash_amount, line_pay_amount:d.line_pay_amount, twqr_amount:d.twqr_amount, uber_eat_amount:d.uber_eat_amount, easy_card_amount:d.easy_card_amount, meal_voucher_amount:d.meal_voucher_amount, line_credit_amount:d.line_credit_amount, drink_voucher_amount:d.drink_voucher_amount, invoice_count:d.invoice_count, invoice_start:d.invoice_start, invoice_end:d.invoice_end, void_invoice_count:d.void_invoice_count, void_invoice_amount:d.void_invoice_amount, cash_in_register:d.cash_in_register, petty_cash_reserved:d.petty_cash_reserved, cash_to_deposit:d.cash_to_deposit, bonus_item_count:d.bonus_item_count, bonus_item_amount:d.bonus_item_amount, image_url:d.image_url, ai_raw_data:d.ai_raw_data, submitted_by:d.employee_id, submitted_at:new Date().toISOString() }, { onConflict:"store_id,date" }).select().single();
  if (error) { console.error(error); return false; }
  if (d.receipts?.length && stl) {
    for (const r of d.receipts) {
      await supabase.from("settlement_receipts").insert({ settlement_id:stl.id, receipt_type:r.type, image_url:r.image_url, serial_numbers:r.serial_numbers, ai_raw_data:r.ai_raw_data }).catch(()=>{});
      if ((r.type==="meal_voucher"||r.type==="drink_voucher") && r.serial_numbers?.length) {
        for (const sn of r.serial_numbers) { await supabase.from("voucher_serials").insert({ serial_number:sn, voucher_type:r.type==="meal_voucher"?"meal":"drink", store_id:d.store_id, settlement_id:stl.id, date:d.date }).catch(()=>{}); }
      }
    }
  }
  const hasIssue = d.audit_results?.some(a=>a.has_issue);
  const { data: admins } = await supabase.from("employees").select("line_uid").eq("role","admin").eq("is_active",true);
  if (admins) for (const a of admins) if (a.line_uid && a.line_uid!==uid) await pushText(a.line_uid, `📊 日結${d.store_name}${d.date}\n👤${d.employee_name} 淨額${fmt(d.net_sales)}${hasIssue?" ⚠️有異常":""}`).catch(()=>{});
  await clearUserState(uid); return true;
}

// ===== 存款 =====
async function startDeposit(rt, emp) {
  const { data: stores } = await supabase.from("stores").select("*").eq("is_active",true);
  const items = (stores||[]).map(s=>({ type:"action", action:{ type:"message", label:s.name, text:`存款門市:${s.name}` } }));
  await setUserState(emp.line_uid, "deposit_select_store", { employee_name:emp.name, employee_id:emp.id });
  return replyWithQuickReply(rt, `🏦 存款回報\n👤 ${emp.name}\n\n選擇門市：`, items);
}
async function handleDepositStore(rt, uid, name, state) {
  const store = await matchStore(name); if (!store) return replyText(rt, "❌ 找不到門市。");
  const { data: last } = await supabase.from("deposits").select("deposit_date").eq("store_id",store.id).order("deposit_date",{ascending:false}).limit(1).single();
  const start = last ? new Date(new Date(last.deposit_date).getTime()+86400000).toISOString().split("T")[0] : null;
  await setUserState(uid, "deposit_photo", { ...state.flow_data, store_id:store.id, store_name:store.name, period_start:start });
  return replyText(rt, `🏦 ${store.name}｜👤 ${state.flow_data.employee_name}\n\n📸 請拍照上傳存款單`);
}
async function handleDepositImage(event, emp, state) {
  const uid = event.source.userId;
  await replyText(event.replyToken, "🏦 AI 辨識中...");
  try {
    const base64 = await downloadImageAsBase64(event.message.id);
    const r = await analyzeDepositSlip(base64); if (!r) { await pushText(uid, "❌ 辨識失敗。"); return; }
    const d = state.flow_data, depDate = r.deposit_date||new Date().toISOString().split("T")[0];
    const pStart = d.period_start || new Date(Date.now()-7*86400000).toISOString().split("T")[0];
    const { data: stls } = await supabase.from("daily_settlements").select("date,cash_to_deposit,cash_amount,petty_cash_reserved").eq("store_id",d.store_id).gte("date",pStart).lte("date",depDate);
    const expected = (stls||[]).reduce((s,r)=>s+Number(r.cash_to_deposit||(Number(r.cash_amount||0)-Number(r.petty_cash_reserved||0))),0);
    const amt = r.deposit_amount||0, diff = amt-expected, abs = Math.abs(diff);
    let status,emoji,stxt; if(abs<=500){status="matched";emoji="✅";stxt="吻合";}else if(abs<=2000){status="minor_diff";emoji="⚠️";stxt="小差異";}else{status="anomaly";emoji="🚨";stxt="異常";}
    const imgUrl = await uploadImage(base64, "deposits", `${d.store_name}_${depDate}_${Date.now()}`);
    await supabase.from("deposits").insert({ store_id:d.store_id, deposit_date:depDate, amount:amt, bank_name:r.bank_name, bank_branch:r.bank_branch, account_number:r.account_number, depositor_name:d.employee_name, roc_date:r.roc_date, period_start:pStart, period_end:depDate, expected_cash:expected, difference:diff, status, image_url:imgUrl, ai_raw_data:r, submitted_by:d.employee_id });
    await pushText(uid, `🏦 核對結果\n${d.store_name}｜${d.employee_name}\n存款${fmt(amt)} vs 應存${fmt(expected)}\n差異${diff>=0?"+":""}${fmt(diff)}\n${emoji} ${stxt}`);
    if (status!=="matched") { const { data: adm } = await supabase.from("employees").select("line_uid").eq("role","admin").eq("is_active",true); if(adm) for(const a of adm) if(a.line_uid) await pushText(a.line_uid, `${emoji} 存款${stxt}\n${d.store_name}｜${d.employee_name}\n存款${fmt(amt)} vs 應存${fmt(expected)}`).catch(()=>{}); }
    await clearUserState(uid);
  } catch(e) { console.error(e); await pushText(uid, "❌ "+e.message); }
}

// ===== 營收 =====
async function queryRevenue(rt) {
  const today = new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Taipei"});
  const { data } = await supabase.from("daily_settlements").select("*, stores(name)").eq("date",today);
  if (!data?.length) return replyText(rt, `📊 ${today} 尚無日結。`);
  let msg=`📊 ${today} 速報\n━━━━━━━━━━━━━━\n`, total=0;
  for (const s of data) { msg+=`🔹${s.stores?.name} 淨額${fmt(s.net_sales)}\n`; total+=Number(s.net_sales||0); }
  msg+=`━━━━━━━━━━━━━━\n💰 合計${fmt(total)}`;
  return replyText(rt, msg);
}

// ===== 主事件 =====
async function handleEvent(event) {
  const userId = event.source.userId;
  const emp = await getEmployee(userId);
  const state = await getUserState(userId);

  if (event.type==="message" && event.message.type==="image") {
    if (!emp) return replyText(event.replyToken, "❌ 請先綁定。格式：綁定 123456");
    if (state?.current_flow==="settlement_photo") return handleSettlementImage(event, emp, state);
    if (state?.current_flow==="deposit_photo") return handleDepositImage(event, emp, state);
    if (state?.current_flow?.startsWith("receipt_")) return handleReceiptImage(event, state);
    return replyText(event.replyToken, "📷 請先選擇功能再拍照。");
  }
  if (event.type!=="message" || event.message.type!=="text") return;
  const text = event.message.text.trim(), rt = event.replyToken;

  if (text.startsWith("綁定")) { const code=text.replace(/^綁定\s*/,"").trim(); return code ? handleBinding(rt,userId,code) : replyText(rt,"格式：綁定 123456"); }
  if (!emp) return replyText(rt, "🍯 歡迎！請輸入：綁定 你的6位數綁定碼");
  if (text==="取消") { await clearUserState(userId); return replyWithQuickReply(rt, "已取消。", getMenu(emp.role)); }

  // 打卡
  if (text==="上班打卡") return handleClockAction(rt, emp, "clock_in");
  if (text==="下班打卡") return handleClockAction(rt, emp, "clock_out");
  if (text==="我的班表") return querySchedule(rt, emp);

  // 日結
  if (text.startsWith("日結門市:") && state?.current_flow==="settlement_select_store") return handleStoreSelection(rt, userId, text.replace("日結門市:",""), state);
  if (text==="日結回報") return startSettlement(rt, emp);
  if (text==="確認日結") { const ok=await confirmSettlement(userId,emp); return ok ? replyWithQuickReply(rt,"✅ 已儲存！辛苦了 👋",getMenu(emp.role)) : replyText(rt,"❌ 失敗"); }
  if (text==="重新拍照" && state?.flow_data?.store_id) { await setUserState(userId,"settlement_photo",{employee_name:state.flow_data.employee_name,employee_id:state.flow_data.employee_id,store_id:state.flow_data.store_id,store_name:state.flow_data.store_name}); return replyText(rt,"📸 請重新拍照"); }
  if (text==="跳過" && state?.current_flow?.startsWith("receipt_")) { const m=await skipReceiptStep(userId,state); return m ? replyText(rt,"⏭️ 已跳過\n\n"+m) : undefined; }

  // 存款
  if (text.startsWith("存款門市:") && state?.current_flow==="deposit_select_store") return handleDepositStore(rt, userId, text.replace("存款門市:",""), state);
  if (text==="存款回報") return startDeposit(rt, emp);
  if (text==="今日營收") return queryRevenue(rt);

  // 其他
  if (["今日SOP","請假申請","學習中心","支出登記"].includes(text)) return replyText(rt, `${text} 建置中`);

  return replyWithQuickReply(rt, `🍯 ${getRoleLabel(emp.role)} ${emp.name}\n🏠 ${emp.stores?.name||"總部"}`, getMenu(emp.role));
}

export async function POST(request) {
  try {
    const body = await request.text();
    const sig = request.headers.get("x-line-signature");
    if (!verifySignature(body,sig)) return new Response("Invalid",{status:401});
    const { events } = JSON.parse(body);
    await Promise.all(events.map(handleEvent));
    return new Response("OK",{status:200});
  } catch(e) { console.error("Webhook:",e); return new Response("Error",{status:500}); }
}
export async function GET() { return new Response("🍯 Running!",{status:200}); }
