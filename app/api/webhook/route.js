import crypto from "crypto";
import { replyText, replyWithQuickReply, downloadImageAsBase64, lineConfig, pushText, lineClient } from "@/lib/line";
import { supabase } from "@/lib/supabase";
import { analyzeDailySettlement, analyzeDepositSlip, analyzeUberEatsReceipt, analyzeVoucher, analyzeLineCreditReceipt } from "@/lib/anthropic";

function verifySignature(body, signature) {
  const hash = crypto.createHmac("SHA256", lineConfig.channelSecret).update(body).digest("base64");
  return hash === signature;
}

// ===== 角色選單 =====
const MENU_STAFF = [
  { type: "action", action: { type: "message", label: "📍 上班打卡", text: "上班打卡" } },
  { type: "action", action: { type: "message", label: "📍 下班打卡", text: "下班打卡" } },
  { type: "action", action: { type: "message", label: "💰 日結回報", text: "日結回報" } },
  { type: "action", action: { type: "message", label: "🏦 存款回報", text: "存款回報" } },
  { type: "action", action: { type: "message", label: "📅 我的班表", text: "我的班表" } },
  { type: "action", action: { type: "message", label: "🙋 請假申請", text: "請假申請" } },
];
const MENU_MANAGER = [...MENU_STAFF,
  { type: "action", action: { type: "message", label: "📊 門市營收", text: "今日營收" } },
];
const MENU_ADMIN = [
  { type: "action", action: { type: "message", label: "📊 全店營收", text: "今日營收" } },
  { type: "action", action: { type: "message", label: "💰 日結回報", text: "日結回報" } },
  { type: "action", action: { type: "message", label: "🏦 存款回報", text: "存款回報" } },
  { type: "action", action: { type: "message", label: "📍 上班打卡", text: "上班打卡" } },
  { type: "action", action: { type: "message", label: "📍 下班打卡", text: "下班打卡" } },
];
function getMenu(role) { return role === "admin" ? MENU_ADMIN : role === "manager" ? MENU_MANAGER : MENU_STAFF; }
function getRoleLabel(role) { return role === "admin" ? "👑 總部" : role === "manager" ? "🏠 管理" : "👤 員工"; }
function fmt(n) { return "$" + Number(n || 0).toLocaleString(); }

// ===== 狀態管理 =====
async function getUserState(uid) { const { data } = await supabase.from("user_states").select("*").eq("line_uid", uid).single(); return data; }
async function setUserState(uid, flow, flowData = {}) { await supabase.from("user_states").upsert({ line_uid: uid, current_flow: flow, flow_data: flowData, updated_at: new Date().toISOString() }); }
async function clearUserState(uid) { await supabase.from("user_states").delete().eq("line_uid", uid); }

// ===== 員工 =====
async function getEmployee(uid) { const { data } = await supabase.from("employees").select("*, stores(*)").eq("line_uid", uid).eq("is_active", true).single(); return data; }

// ===== 綁定 =====
async function handleBinding(rt, userId, code) {
  const { data: emp } = await supabase.from("employees").select("*, stores(name)").eq("bind_code", code).eq("is_active", true).single();
  if (!emp) return replyText(rt, "❌ 綁定碼無效，請確認後重新輸入。\n格式：綁定 123456");
  if (emp.bind_code_expires && new Date(emp.bind_code_expires) < new Date()) return replyText(rt, "❌ 綁定碼已過期，請聯繫主管。");
  if (emp.line_uid && emp.line_uid !== userId) return replyText(rt, "❌ 此帳號已被綁定，請聯繫主管。");
  await supabase.from("employees").update({ line_uid: userId, bind_code: null, bind_code_expires: null }).eq("id", emp.id);
  return replyWithQuickReply(rt, `✅ 綁定成功！\n\n👤 ${emp.name}\n${getRoleLabel(emp.role)}\n🏠 ${emp.stores?.name || "總部"}`, getMenu(emp.role));
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

// ===== 圖片上傳 =====
async function uploadImage(base64, folder, filename) {
  const buffer = Buffer.from(base64, "base64");
  const path = `${folder}/${filename}.jpg`;
  await supabase.storage.from("receipts").upload(path, buffer, { contentType: "image/jpeg", upsert: true });
  const { data } = supabase.storage.from("receipts").getPublicUrl(path);
  return data.publicUrl;
}

// ===== 餐券/飲料券重複檢查 =====
async function checkDuplicateSerials(serialNumbers, voucherType) {
  if (!serialNumbers || serialNumbers.length === 0) return { duplicates: [], newSerials: serialNumbers || [] };
  const { data: existing } = await supabase
    .from("voucher_serials")
    .select("serial_number, date, stores(name)")
    .eq("voucher_type", voucherType)
    .in("serial_number", serialNumbers);

  const duplicates = existing || [];
  const duplicateNums = duplicates.map(d => d.serial_number);
  const newSerials = serialNumbers.filter(s => !duplicateNums.includes(s));
  return { duplicates, newSerials };
}

// ===== 定義單據上傳步驟順序 =====
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
  if (step.flow === "receipt_ubereats") return `🛵 UberEats 金額：${amount}\n\n請拍照上傳 UberEats 對帳單\n（需包含訂單流水號）\n\n輸入「跳過」可略過`;
  if (step.flow === "receipt_meal_voucher") return `🎫 餐券金額：${amount}\n\n請拍照上傳今日收到的餐券\n（需包含券上流水號，系統會自動檢查是否重複使用）\n\n輸入「跳過」可略過`;
  if (step.flow === "receipt_line_credit") return `📱 LINE 儲值金：${amount}\n\n請拍照上傳 LINE 儲值金消費紀錄\n\n輸入「跳過」可略過`;
  if (step.flow === "receipt_drink_voucher") return `🎫 飲料券金額：${amount}\n\n請拍照上傳飲料券\n（需包含券上流水號，系統會自動檢查是否重複使用）\n\n輸入「跳過」可略過`;
  return "";
}

// ===== 日結 Step1: 選門市 =====
async function startSettlement(rt, employee) {
  const { data: stores } = await supabase.from("stores").select("*").eq("is_active", true);
  const items = (stores || []).map(s => ({ type: "action", action: { type: "message", label: s.name, text: `日結門市:${s.name}` } }));
  await setUserState(employee.line_uid, "settlement_select_store", { employee_name: employee.name, employee_id: employee.id });
  return replyWithQuickReply(rt, `💰 日結回報\n\n👤 結單人員：${employee.name}\n\n請選擇門市：`, items);
}

// ===== 日結 Step2: 收到門市 =====
async function handleStoreSelection(rt, uid, storeName, state) {
  const store = await matchStore(storeName);
  if (!store) return replyText(rt, "❌ 找不到門市，請重新選擇。");
  await setUserState(uid, "settlement_photo", { ...state.flow_data, store_id: store.id, store_name: store.name });
  return replyText(rt, `🏠 ${store.name}\n👤 ${state.flow_data.employee_name}\n\n📸 請拍照上傳 POS 日結單\n提示：確保單據平整、數字清晰`);
}

// ===== 日結 Step3: POS 照片 =====
async function handleSettlementImage(event, employee, state) {
  const uid = event.source.userId;
  await replyText(event.replyToken, "📸 AI 正在辨識日結單，約需 10 秒...");
  try {
    const base64 = await downloadImageAsBase64(event.message.id);
    const r = await analyzeDailySettlement(base64);
    if (!r) { await pushText(uid, "❌ 辨識失敗，請重新拍攝清晰照片。"); return; }

    const dateStr = r.period_end ? r.period_end.split(" ")[0] : new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
    const cashToDeposit = (r.cash_in_register || r.cash_amount || 0) - (r.petty_cash_reserved || 0);
    const imageUrl = await uploadImage(base64, "settlements", `${state.flow_data.store_name}_${dateStr}_${Date.now()}`);

    const sd = {
      ...state.flow_data, date: dateStr, period_start: r.period_start, period_end: r.period_end,
      cashier_name: r.cashier_name || state.flow_data.employee_name,
      net_sales: r.net_sales || 0, discount_total: r.discount_total || 0,
      cash_amount: r.cash_amount || 0, line_pay_amount: r.line_pay_amount || 0,
      twqr_amount: r.twqr_amount || 0, uber_eat_amount: r.uber_eat_amount || 0,
      easy_card_amount: r.easy_card_amount || 0, meal_voucher_amount: r.meal_voucher_amount || 0,
      line_credit_amount: r.line_credit_amount || 0, drink_voucher_amount: r.drink_voucher_amount || 0,
      invoice_count: r.invoice_count || 0, invoice_start: r.invoice_start, invoice_end: r.invoice_end,
      void_invoice_count: r.void_invoice_count || 0, void_invoice_amount: r.void_invoice_amount || 0,
      cash_in_register: r.cash_in_register || r.cash_amount || 0,
      petty_cash_reserved: r.petty_cash_reserved || 0, cash_to_deposit: cashToDeposit,
      bonus_item_count: r.bonus_item_count || 0, bonus_item_amount: r.bonus_item_amount || 0,
      image_url: imageUrl, ai_raw_data: r, receipts: [], audit_results: [],
    };

    const msg =
      `📊 日結單辨識結果\n━━━━━━━━━━━━━━\n` +
      `🏠 ${sd.store_name}｜📅 ${dateStr}\n👤 ${sd.employee_name}\n━━━━━━━━━━━━━━\n` +
      `💰 營業淨額：${fmt(r.net_sales)}\n━━━━━━━━━━━━━━\n` +
      `💵 現金：${fmt(r.cash_amount)}\n📱 LINE Pay：${fmt(r.line_pay_amount)}\n📱 TWQR：${fmt(r.twqr_amount)}\n` +
      `🛵 UberEat：${fmt(r.uber_eat_amount)}\n💳 悠遊卡：${fmt(r.easy_card_amount)}\n🎫 餐券：${fmt(r.meal_voucher_amount)}\n` +
      `📱 LINE儲值金：${fmt(r.line_credit_amount)}\n🎫 飲料券：${fmt(r.drink_voucher_amount)}\n━━━━━━━━━━━━━━\n` +
      `🧾 發票 ${r.invoice_count || 0} 張\n🏦 應存金額：${fmt(cashToDeposit)}`;
    await pushText(uid, msg);

    // 判斷是否有需要上傳的單據
    const nextStep = getNextReceiptStep(sd, null);
    if (nextStep) {
      await setUserState(uid, nextStep.flow, sd);
      await pushText(uid, `✅ POS 日結單已辨識\n\n接下來請上傳各項單據進行稽核：\n\n${getReceiptPrompt(nextStep, sd)}`);
    } else {
      await setUserState(uid, "settlement_confirm", sd);
      await sendFinalConfirmation(uid, sd);
    }
  } catch (error) {
    console.error("日結單處理錯誤:", error);
    await pushText(uid, "❌ 處理錯誤：" + error.message);
  }
}

// ===== 處理各類單據照片 =====
async function handleReceiptImage(event, state) {
  const uid = event.source.userId;
  const currentFlow = state.current_flow;
  await replyText(event.replyToken, "📸 正在辨識單據並稽核...");

  try {
    const base64 = await downloadImageAsBase64(event.message.id);
    const data = state.flow_data;
    let aiResult = null;
    let auditMsg = "";
    let serialNumbers = [];

    // 根據不同單據類型呼叫不同 AI
    if (currentFlow === "receipt_ubereats") {
      aiResult = await analyzeUberEatsReceipt(base64);
      serialNumbers = aiResult?.serial_numbers || [];
      const posAmount = Number(data.uber_eat_amount || 0);
      const receiptAmount = Number(aiResult?.total_amount || 0);
      const diff = Math.abs(posAmount - receiptAmount);
      if (diff <= 50) {
        auditMsg = `✅ UberEats 金額吻合\nPOS：${fmt(posAmount)}｜單據：${fmt(receiptAmount)}`;
      } else {
        auditMsg = `⚠️ UberEats 金額有差異！\nPOS：${fmt(posAmount)}｜單據：${fmt(receiptAmount)}\n差異：${fmt(diff)}`;
      }
      if (serialNumbers.length > 0) auditMsg += `\n📋 流水號：${serialNumbers.join(", ")}`;

    } else if (currentFlow === "receipt_meal_voucher") {
      aiResult = await analyzeVoucher(base64, "meal");
      serialNumbers = aiResult?.serial_numbers || [];
      const { duplicates, newSerials } = await checkDuplicateSerials(serialNumbers, "meal");
      if (duplicates.length > 0) {
        auditMsg = `🚨 發現重複餐券！\n`;
        for (const d of duplicates) {
          auditMsg += `❌ ${d.serial_number}（已於 ${d.date} 在 ${d.stores?.name || "未知"} 使用）\n`;
        }
        auditMsg += `\n新餐券：${newSerials.length} 張`;
      } else {
        auditMsg = `✅ 餐券稽核通過，${serialNumbers.length} 張全部為新券`;
      }
      auditMsg += `\n💰 面額合計：${fmt(aiResult?.total_amount)}（POS：${fmt(data.meal_voucher_amount)}）`;
      if (serialNumbers.length > 0) auditMsg += `\n📋 流水號：${serialNumbers.join(", ")}`;
      serialNumbers = newSerials; // 只記錄新的

    } else if (currentFlow === "receipt_line_credit") {
      aiResult = await analyzeLineCreditReceipt(base64);
      serialNumbers = aiResult?.serial_numbers || [];
      auditMsg = `✅ LINE 儲值金單據已記錄\n💰 金額：${fmt(aiResult?.total_amount)}（POS：${fmt(data.line_credit_amount)}）`;
      if (serialNumbers.length > 0) auditMsg += `\n📋 交易編號：${serialNumbers.join(", ")}`;

    } else if (currentFlow === "receipt_drink_voucher") {
      aiResult = await analyzeVoucher(base64, "drink");
      serialNumbers = aiResult?.serial_numbers || [];
      const { duplicates, newSerials } = await checkDuplicateSerials(serialNumbers, "drink");
      if (duplicates.length > 0) {
        auditMsg = `🚨 發現重複飲料券！\n`;
        for (const d of duplicates) {
          auditMsg += `❌ ${d.serial_number}（已於 ${d.date} 在 ${d.stores?.name || "未知"} 使用）\n`;
        }
        auditMsg += `\n新飲料券：${newSerials.length} 張`;
      } else {
        auditMsg = `✅ 飲料券稽核通過，${serialNumbers.length} 張全部為新券`;
      }
      auditMsg += `\n💰 面額合計：${fmt(aiResult?.total_amount)}（POS：${fmt(data.drink_voucher_amount)}）`;
      if (serialNumbers.length > 0) auditMsg += `\n📋 流水號：${serialNumbers.join(", ")}`;
      serialNumbers = newSerials;
    }

    // 上傳圖片
    const receiptType = currentFlow.replace("receipt_", "");
    const imageUrl = await uploadImage(base64, "receipts_detail", `${receiptType}_${data.store_name}_${Date.now()}`);

    // 記錄到 flow_data
    data.receipts = data.receipts || [];
    data.receipts.push({ type: receiptType, image_url: imageUrl, ai_raw_data: aiResult, serial_numbers: serialNumbers });
    data.audit_results = data.audit_results || [];
    data.audit_results.push({ type: receiptType, message: auditMsg, has_issue: auditMsg.includes("🚨") || auditMsg.includes("⚠️") });

    await pushText(uid, auditMsg);

    // 下一步
    const nextStep = getNextReceiptStep(data, currentFlow);
    if (nextStep) {
      await setUserState(uid, nextStep.flow, data);
      await pushText(uid, getReceiptPrompt(nextStep, data));
    } else {
      await setUserState(uid, "settlement_confirm", data);
      await sendFinalConfirmation(uid, data);
    }
  } catch (error) {
    console.error("單據處理錯誤:", error);
    await pushText(uid, "❌ 處理錯誤：" + error.message + "\n請重新拍照或輸入「跳過」");
  }
}

// ===== 跳過單據 =====
async function skipReceiptStep(uid, state) {
  const data = state.flow_data;
  const stepInfo = RECEIPT_STEPS.find(s => s.flow === state.current_flow);
  data.audit_results = data.audit_results || [];
  data.audit_results.push({ type: stepInfo?.flow?.replace("receipt_", "") || "unknown", message: "⏭️ 已跳過，未上傳單據", has_issue: true });

  const nextStep = getNextReceiptStep(data, state.current_flow);
  if (nextStep) {
    await setUserState(uid, nextStep.flow, data);
    return getReceiptPrompt(nextStep, data);
  } else {
    await setUserState(uid, "settlement_confirm", data);
    await sendFinalConfirmation(uid, data);
    return null;
  }
}

// ===== 最終確認摘要 =====
async function sendFinalConfirmation(uid, data) {
  let msg = `📋 日結回報摘要\n━━━━━━━━━━━━━━\n`;
  msg += `🏠 ${data.store_name}｜📅 ${data.date}\n👤 ${data.employee_name}\n`;
  msg += `💰 營業淨額：${fmt(data.net_sales)}\n🏦 應存現金：${fmt(data.cash_to_deposit)}\n`;

  // 稽核結果
  if (data.audit_results && data.audit_results.length > 0) {
    msg += `\n━━ 稽核結果 ━━\n`;
    for (const ar of data.audit_results) {
      const icon = ar.has_issue ? "⚠️" : "✅";
      msg += `${icon} ${ar.type}：${ar.message.split("\n")[0]}\n`;
    }
  }

  // 上傳的單據數
  const receiptCount = (data.receipts || []).length;
  msg += `\n📎 已上傳 ${receiptCount} 份附加單據`;

  const hasIssue = data.audit_results?.some(ar => ar.has_issue);
  if (hasIssue) {
    msg += `\n\n⚠️ 有稽核異常項目，送出後總部會收到通知`;
  }

  await pushText(uid, msg);
  await lineClient.pushMessage({
    to: uid,
    messages: [{ type: "text", text: "確認送出？", quickReply: { items: [
      { type: "action", action: { type: "message", label: "✅ 確認送出", text: "確認日結" } },
      { type: "action", action: { type: "message", label: "📸 重新拍POS單", text: "重新拍照" } },
      { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
    ]}}],
  });
}

// ===== 確認儲存 =====
async function confirmSettlement(uid, employee) {
  const state = await getUserState(uid);
  if (!state || state.current_flow !== "settlement_confirm") return false;
  const d = state.flow_data;

  // 儲存日結單
  const { data: settlement, error } = await supabase.from("daily_settlements").upsert({
    store_id: d.store_id, date: d.date, period_start: d.period_start, period_end: d.period_end,
    cashier_name: d.cashier_name, net_sales: d.net_sales, discount_total: d.discount_total,
    cash_amount: d.cash_amount, line_pay_amount: d.line_pay_amount, twqr_amount: d.twqr_amount,
    uber_eat_amount: d.uber_eat_amount, easy_card_amount: d.easy_card_amount,
    meal_voucher_amount: d.meal_voucher_amount, line_credit_amount: d.line_credit_amount,
    drink_voucher_amount: d.drink_voucher_amount, invoice_count: d.invoice_count,
    invoice_start: d.invoice_start, invoice_end: d.invoice_end,
    void_invoice_count: d.void_invoice_count, void_invoice_amount: d.void_invoice_amount,
    cash_in_register: d.cash_in_register, petty_cash_reserved: d.petty_cash_reserved,
    cash_to_deposit: d.cash_to_deposit, bonus_item_count: d.bonus_item_count,
    bonus_item_amount: d.bonus_item_amount, image_url: d.image_url, ai_raw_data: d.ai_raw_data,
    submitted_by: d.employee_id, submitted_at: new Date().toISOString(),
  }, { onConflict: "store_id,date" }).select().single();

  if (error) { console.error("儲存日結單錯誤:", error); return false; }

  // 儲存附加單據
  if (d.receipts && d.receipts.length > 0 && settlement) {
    for (const r of d.receipts) {
      await supabase.from("settlement_receipts").insert({
        settlement_id: settlement.id, receipt_type: r.type,
        image_url: r.image_url, serial_numbers: r.serial_numbers,
        ai_raw_data: r.ai_raw_data,
      }).catch(e => console.error("儲存單據錯誤:", e));

      // 儲存券別流水號（餐券/飲料券）
      if ((r.type === "meal_voucher" || r.type === "drink_voucher") && r.serial_numbers?.length > 0) {
        const vType = r.type === "meal_voucher" ? "meal" : "drink";
        for (const sn of r.serial_numbers) {
          await supabase.from("voucher_serials").insert({
            serial_number: sn, voucher_type: vType,
            store_id: d.store_id, settlement_id: settlement.id, date: d.date,
          }).catch(() => {}); // 忽略重複
        }
      }
    }
  }

  // 通知總部
  const hasIssue = d.audit_results?.some(ar => ar.has_issue);
  const { data: admins } = await supabase.from("employees").select("line_uid").eq("role", "admin").eq("is_active", true);
  if (admins) {
    for (const a of admins) {
      if (a.line_uid && a.line_uid !== uid) {
        let notify = `📊 日結回報\n${d.store_name}｜${d.date}\n👤 ${d.employee_name}\n💰 淨額：${fmt(d.net_sales)}｜應存：${fmt(d.cash_to_deposit)}`;
        if (hasIssue) {
          notify += `\n\n⚠️ 稽核異常：`;
          for (const ar of d.audit_results.filter(a => a.has_issue)) {
            notify += `\n・${ar.type}：${ar.message.split("\n")[0]}`;
          }
        }
        await pushText(a.line_uid, notify).catch(() => {});
      }
    }
  }

  await clearUserState(uid);
  return true;
}

// ===== 存款流程 =====
async function startDeposit(rt, employee) {
  const { data: stores } = await supabase.from("stores").select("*").eq("is_active", true);
  const items = (stores || []).map(s => ({ type: "action", action: { type: "message", label: s.name, text: `存款門市:${s.name}` } }));
  await setUserState(employee.line_uid, "deposit_select_store", { employee_name: employee.name, employee_id: employee.id });
  return replyWithQuickReply(rt, `🏦 存款回報\n👤 匯款人：${employee.name}\n\n請選擇門市：`, items);
}

async function handleDepositStoreSelection(rt, uid, storeName, state) {
  const store = await matchStore(storeName);
  if (!store) return replyText(rt, "❌ 找不到門市。");
  const { data: lastDep } = await supabase.from("deposits").select("deposit_date").eq("store_id", store.id).order("deposit_date", { ascending: false }).limit(1).single();
  const sugStart = lastDep ? new Date(new Date(lastDep.deposit_date).getTime() + 86400000).toISOString().split("T")[0] : "上次存款隔天";
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  await setUserState(uid, "deposit_photo", {
    ...state.flow_data, store_id: store.id, store_name: store.name,
    period_start: lastDep ? new Date(new Date(lastDep.deposit_date).getTime() + 86400000).toISOString().split("T")[0] : null,
  });
  return replyText(rt, `🏦 存款回報\n👤 ${state.flow_data.employee_name}\n🏠 ${store.name}\n📅 建議區間：${sugStart} ~ ${today}\n\n📸 請拍照上傳存款單`);
}

async function handleDepositImage(event, employee, state) {
  const uid = event.source.userId;
  await replyText(event.replyToken, "🏦 AI 正在辨識存款單...");
  try {
    const base64 = await downloadImageAsBase64(event.message.id);
    const r = await analyzeDepositSlip(base64);
    if (!r) { await pushText(uid, "❌ 辨識失敗，請重新拍攝。"); return; }
    const d = state.flow_data;
    const depositDate = r.deposit_date || new Date().toISOString().split("T")[0];
    const periodStart = d.period_start || new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const { data: settlements } = await supabase.from("daily_settlements").select("date, cash_to_deposit, cash_amount, petty_cash_reserved").eq("store_id", d.store_id).gte("date", periodStart).lte("date", depositDate);
    const expectedCash = (settlements || []).reduce((sum, s) => sum + Number(s.cash_to_deposit || (Number(s.cash_amount || 0) - Number(s.petty_cash_reserved || 0))), 0);
    const depositAmount = r.deposit_amount || 0;
    const diff = depositAmount - expectedCash;
    const absDiff = Math.abs(diff);
    let status, emoji, statusText;
    if (absDiff <= 500) { status = "matched"; emoji = "✅"; statusText = "吻合"; }
    else if (absDiff <= 2000) { status = "minor_diff"; emoji = "⚠️"; statusText = "小差異"; }
    else { status = "anomaly"; emoji = "🚨"; statusText = "異常！已通知總部"; }
    const imageUrl = await uploadImage(base64, "deposits", `${d.store_name}_${depositDate}_${Date.now()}`);
    await supabase.from("deposits").insert({
      store_id: d.store_id, deposit_date: depositDate, amount: depositAmount,
      bank_name: r.bank_name, bank_branch: r.bank_branch, account_number: r.account_number,
      depositor_name: d.employee_name, roc_date: r.roc_date,
      period_start: periodStart, period_end: depositDate,
      expected_cash: expectedCash, difference: diff, status,
      image_url: imageUrl, ai_raw_data: r, submitted_by: d.employee_id,
    });
    const msg = `🏦 存款核對結果\n━━━━━━━━━━━━━━\n🏠 ${d.store_name}\n👤 匯款人：${d.employee_name}\n🏦 ${r.bank_name || ""} ${r.bank_branch || ""}\n📅 ${r.roc_date || depositDate}\n📅 區間：${periodStart} ~ ${depositDate}\n━━━━━━━━━━━━━━\n💰 存款：${fmt(depositAmount)}\n📊 應存：${fmt(expectedCash)}\n📐 差異：${diff >= 0 ? "+" : ""}${fmt(diff)}\n━━━━━━━━━━━━━━\n${emoji} ${statusText}\n📋 含 ${(settlements || []).length} 天日結`;
    await pushText(uid, msg);
    if (status !== "matched") {
      const { data: admins } = await supabase.from("employees").select("line_uid").eq("role", "admin").eq("is_active", true);
      if (admins) for (const a of admins) if (a.line_uid) await pushText(a.line_uid, `${emoji} 存款${statusText}\n${d.store_name}｜${d.employee_name}\n存款 ${fmt(depositAmount)} vs 應存 ${fmt(expectedCash)}\n差異：${fmt(diff)}`).catch(() => {});
    }
    await clearUserState(uid);
  } catch (error) {
    console.error("存款處理錯誤:", error);
    await pushText(uid, "❌ 錯誤：" + error.message);
  }
}

// ===== 查營收 =====
async function queryTodayRevenue(rt, employee) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const { data } = await supabase.from("daily_settlements").select("*, stores(name)").eq("date", today);
  if (!data || data.length === 0) return replyText(rt, `📊 ${today} 尚無日結回報。`);
  let msg = `📊 ${today} 營收速報\n━━━━━━━━━━━━━━\n`;
  let total = 0;
  for (const s of data) {
    msg += `\n🔹 ${s.stores?.name}\n　淨額 ${fmt(s.net_sales)}｜現金 ${fmt(s.cash_amount)}\n`;
    total += Number(s.net_sales || 0);
  }
  msg += `\n━━━━━━━━━━━━━━\n💰 合計：${fmt(total)}`;
  return replyText(rt, msg);
}

// ===== 主事件 =====
async function handleEvent(event) {
  const userId = event.source.userId;
  const employee = await getEmployee(userId);
  const state = await getUserState(userId);

  // 圖片
  if (event.type === "message" && event.message.type === "image") {
    if (!employee) return replyText(event.replyToken, "❌ 請先綁定帳號。\n格式：綁定 123456");
    if (state?.current_flow === "settlement_photo") return handleSettlementImage(event, employee, state);
    if (state?.current_flow === "deposit_photo") return handleDepositImage(event, employee, state);
    if (state?.current_flow?.startsWith("receipt_")) return handleReceiptImage(event, state);
    return replyText(event.replyToken, "📷 請先選擇功能再拍照。");
  }

  if (event.type !== "message" || event.message.type !== "text") return;
  const text = event.message.text.trim();
  const rt = event.replyToken;

  // 綁定
  if (text.startsWith("綁定")) {
    const code = text.replace(/^綁定\s*/, "").trim();
    if (!code) return replyText(rt, "格式：綁定 123456");
    return handleBinding(rt, userId, code);
  }

  // 未綁定
  if (!employee) return replyText(rt, `🍯 歡迎來到小食糖內部系統！\n\n你的 LINE 帳號尚未綁定。\n請輸入：綁定 你的6位數綁定碼\n\n例如：綁定 123456`);

  // 取消
  if (text === "取消") { await clearUserState(userId); return replyWithQuickReply(rt, "已取消。", getMenu(employee.role)); }

  // 日結門市選擇
  if (text.startsWith("日結門市:") && state?.current_flow === "settlement_select_store") return handleStoreSelection(rt, userId, text.replace("日結門市:", ""), state);

  // 存款門市選擇
  if (text.startsWith("存款門市:") && state?.current_flow === "deposit_select_store") return handleDepositStoreSelection(rt, userId, text.replace("存款門市:", ""), state);

  // 跳過單據
  if (text === "跳過" && state?.current_flow?.startsWith("receipt_")) {
    const nextMsg = await skipReceiptStep(userId, state);
    if (nextMsg) return replyText(rt, "⏭️ 已跳過\n\n" + nextMsg);
    return; // sendFinalConfirmation already sent
  }

  // 確認日結
  if (text === "確認日結") {
    const ok = await confirmSettlement(userId, employee);
    if (ok) return replyWithQuickReply(rt, "✅ 日結單已儲存！含所有單據和稽核紀錄。辛苦了 👋", getMenu(employee.role));
    return replyText(rt, "❌ 儲存失敗，請重試。");
  }

  // 重新拍照
  if (text === "重新拍照") {
    if (state?.flow_data?.store_id) {
      await setUserState(userId, "settlement_photo", { employee_name: state.flow_data.employee_name, employee_id: state.flow_data.employee_id, store_id: state.flow_data.store_id, store_name: state.flow_data.store_name });
      return replyText(rt, "📸 請重新拍照上傳 POS 日結單");
    }
  }

  // 功能指令
  if (text === "日結回報") return startSettlement(rt, employee);
  if (text === "存款回報") return startDeposit(rt, employee);
  if (text === "今日營收") return queryTodayRevenue(rt, employee);
  if (["上班打卡", "下班打卡", "今日SOP", "我的班表", "請假申請", "學習中心", "支出登記", "門市出勤", "全店出勤"].includes(text))
    return replyText(rt, `${text} 模組建置中，敬請期待！`);

  // 選單
  return replyWithQuickReply(rt, `🍯 小食糖內部系統\n\n${getRoleLabel(employee.role)} ${employee.name}\n🏠 ${employee.stores?.name || "總部"}\n\n請選擇功能：`, getMenu(employee.role));
}

export async function POST(request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-line-signature");
    if (!verifySignature(body, signature)) return new Response("Invalid signature", { status: 401 });
    const { events } = JSON.parse(body);
    await Promise.all(events.map(handleEvent));
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook 錯誤:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function GET() {
  return new Response("🍯 小食糖 LINE Bot is running!", { status: 200 });
}
