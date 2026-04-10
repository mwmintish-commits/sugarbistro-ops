import crypto from "crypto";
import { replyText, replyWithQuickReply, downloadImageAsBase64, lineConfig, pushText, lineClient } from "@/lib/line";
import { supabase } from "@/lib/supabase";
import { analyzeDailySettlement, analyzeDepositSlip } from "@/lib/anthropic";

function verifySignature(body, signature) {
  const hash = crypto.createHmac("SHA256", lineConfig.channelSecret).update(body).digest("base64");
  return hash === signature;
}

// ===== 角色對應選單 =====
const MENU_STAFF = [
  { type: "action", action: { type: "message", label: "📍 上班打卡", text: "上班打卡" } },
  { type: "action", action: { type: "message", label: "📍 下班打卡", text: "下班打卡" } },
  { type: "action", action: { type: "message", label: "💰 日結回報", text: "日結回報" } },
  { type: "action", action: { type: "message", label: "🏦 存款回報", text: "存款回報" } },
  { type: "action", action: { type: "message", label: "📅 我的班表", text: "我的班表" } },
  { type: "action", action: { type: "message", label: "🙋 請假申請", text: "請假申請" } },
];

const MENU_MANAGER = [
  ...MENU_STAFF,
  { type: "action", action: { type: "message", label: "📊 門市營收", text: "今日營收" } },
  { type: "action", action: { type: "message", label: "👥 門市出勤", text: "門市出勤" } },
];

const MENU_ADMIN = [
  { type: "action", action: { type: "message", label: "📊 全店營收", text: "今日營收" } },
  { type: "action", action: { type: "message", label: "💰 日結回報", text: "日結回報" } },
  { type: "action", action: { type: "message", label: "🏦 存款回報", text: "存款回報" } },
  { type: "action", action: { type: "message", label: "👥 全店出勤", text: "全店出勤" } },
  { type: "action", action: { type: "message", label: "📍 上班打卡", text: "上班打卡" } },
  { type: "action", action: { type: "message", label: "📍 下班打卡", text: "下班打卡" } },
];

function getMenu(role) {
  if (role === "admin") return MENU_ADMIN;
  if (role === "manager") return MENU_MANAGER;
  return MENU_STAFF;
}

function getRoleLabel(role) {
  if (role === "admin") return "👑 總部";
  if (role === "manager") return "🏠 管理";
  return "👤 員工";
}

// ===== 用戶狀態 =====
async function getUserState(uid) {
  const { data } = await supabase.from("user_states").select("*").eq("line_uid", uid).single();
  return data;
}
async function setUserState(uid, flow, flowData = {}) {
  await supabase.from("user_states").upsert({ line_uid: uid, current_flow: flow, flow_data: flowData, updated_at: new Date().toISOString() });
}
async function clearUserState(uid) {
  await supabase.from("user_states").delete().eq("line_uid", uid);
}

// ===== 員工查詢 =====
async function getEmployee(uid) {
  const { data } = await supabase.from("employees").select("*, stores(*)").eq("line_uid", uid).eq("is_active", true).single();
  return data;
}

// ===== 員工綁定 =====
async function handleBinding(replyToken, userId, code) {
  // 查詢綁定碼
  const { data: emp } = await supabase
    .from("employees")
    .select("*, stores(name)")
    .eq("bind_code", code)
    .eq("is_active", true)
    .single();

  if (!emp) {
    return replyText(replyToken, "❌ 綁定碼無效，請確認後重新輸入。\n格式：綁定 123456");
  }

  // 檢查是否過期
  if (emp.bind_code_expires && new Date(emp.bind_code_expires) < new Date()) {
    return replyText(replyToken, "❌ 綁定碼已過期，請聯繫主管重新產生。");
  }

  // 檢查是否已被綁定
  if (emp.line_uid && emp.line_uid !== userId) {
    return replyText(replyToken, "❌ 此員工帳號已被其他 LINE 綁定，請聯繫主管處理。");
  }

  // 綁定
  const { error } = await supabase
    .from("employees")
    .update({ line_uid: userId, bind_code: null, bind_code_expires: null })
    .eq("id", emp.id);

  if (error) {
    return replyText(replyToken, "❌ 綁定失敗，請重試。");
  }

  const roleLabel = getRoleLabel(emp.role);
  const menu = getMenu(emp.role);

  return replyWithQuickReply(
    replyToken,
    `✅ 綁定成功！\n\n` +
    `👤 姓名：${emp.name}\n` +
    `${roleLabel}\n` +
    `🏠 門市：${emp.stores?.name || "總部"}\n\n` +
    `歡迎加入小食糖！請點選下方功能開始使用。`,
    menu
  );
}

// ===== 門市比對 =====
async function matchStore(name) {
  if (!name) return null;
  const { data: stores } = await supabase.from("stores").select("*").eq("is_active", true);
  if (!stores) return null;
  const n = name.toLowerCase();
  for (const s of stores) {
    if (s.name.includes("台北") && (n.includes("台北"))) return s;
    if (s.name.includes("屏東") && (n.includes("屏東"))) return s;
    if (s.name.includes("左營") && (n.includes("左營") || n.includes("新光"))) return s;
    if (s.name.includes("SKM") && n.includes("skm")) return s;
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

function fmt(n) {
  if (n === null || n === undefined) return "$0";
  return "$" + Number(n).toLocaleString();
}

// ===== 日結單：Step 1 確認身份 + 選門市 =====
async function startSettlement(replyToken, employee) {
  const { data: stores } = await supabase.from("stores").select("*").eq("is_active", true);
  const storeItems = (stores || []).map(s => ({
    type: "action",
    action: { type: "message", label: s.name, text: `日結門市:${s.name}` },
  }));

  await setUserState(employee.line_uid, "settlement_select_store", { employee_name: employee.name, employee_id: employee.id });

  return replyWithQuickReply(
    replyToken,
    `💰 日結回報\n\n👤 結單人員：${employee.name}\n\n請選擇門市：`,
    storeItems
  );
}

// ===== 日結單：Step 2 收到門市選擇，等待照片 =====
async function handleStoreSelection(replyToken, uid, storeName, state) {
  const store = await matchStore(storeName);
  if (!store) {
    return replyText(replyToken, "❌ 找不到門市，請重新選擇。");
  }

  await setUserState(uid, "settlement_photo", {
    ...state.flow_data,
    store_id: store.id,
    store_name: store.name,
  });

  return replyText(
    replyToken,
    `🏠 門市：${store.name}\n👤 結單人員：${state.flow_data.employee_name}\n\n📸 請拍照上傳 POS 日結單\n\n提示：確保單據平整、數字清晰完整`
  );
}

// ===== 日結單：處理 POS 照片 =====
async function handleSettlementImage(event, employee, state) {
  const uid = event.source.userId;
  await replyText(event.replyToken, "📸 AI 正在辨識日結單，請稍候約 10 秒...");

  try {
    const base64 = await downloadImageAsBase64(event.message.id);
    const r = await analyzeDailySettlement(base64);

    if (!r) {
      await pushText(uid, "❌ 辨識失敗，請重新拍攝清晰照片。");
      return;
    }

    const dateStr = r.period_end ? r.period_end.split(" ")[0] : new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
    const cashToDeposit = (r.cash_in_register || r.cash_amount || 0) - (r.petty_cash_reserved || 0);
    const imageUrl = await uploadImage(base64, "settlements", `${state.flow_data.store_name}_${dateStr}_${Date.now()}`);

    const settlementData = {
      ...state.flow_data,
      date: dateStr,
      period_start: r.period_start,
      period_end: r.period_end,
      cashier_name: r.cashier_name || state.flow_data.employee_name,
      net_sales: r.net_sales || 0,
      discount_total: r.discount_total || 0,
      cash_amount: r.cash_amount || 0,
      line_pay_amount: r.line_pay_amount || 0,
      twqr_amount: r.twqr_amount || 0,
      uber_eat_amount: r.uber_eat_amount || 0,
      easy_card_amount: r.easy_card_amount || 0,
      meal_voucher_amount: r.meal_voucher_amount || 0,
      line_credit_amount: r.line_credit_amount || 0,
      drink_voucher_amount: r.drink_voucher_amount || 0,
      invoice_count: r.invoice_count || 0,
      invoice_start: r.invoice_start,
      invoice_end: r.invoice_end,
      void_invoice_count: r.void_invoice_count || 0,
      void_invoice_amount: r.void_invoice_amount || 0,
      cash_in_register: r.cash_in_register || r.cash_amount || 0,
      petty_cash_reserved: r.petty_cash_reserved || 0,
      cash_to_deposit: cashToDeposit,
      bonus_item_count: r.bonus_item_count || 0,
      bonus_item_amount: r.bonus_item_amount || 0,
      image_url: imageUrl,
      ai_raw_data: r,
      receipts: [],
    };

    await setUserState(uid, "settlement_confirm", settlementData);

    const msg =
      `📊 日結單辨識結果\n━━━━━━━━━━━━━━\n` +
      `🏠 ${state.flow_data.store_name}\n📅 ${dateStr}\n👤 ${state.flow_data.employee_name}\n━━━━━━━━━━━━━━\n` +
      `💰 營業淨額：${fmt(r.net_sales)}\n━━━━━━━━━━━━━━\n` +
      `💵 現金：${fmt(r.cash_amount)}\n📱 LINE Pay：${fmt(r.line_pay_amount)}\n📱 TWQR：${fmt(r.twqr_amount)}\n` +
      `🛵 UberEat：${fmt(r.uber_eat_amount)}\n💳 悠遊卡：${fmt(r.easy_card_amount)}\n🎫 餐券：${fmt(r.meal_voucher_amount)}\n` +
      `📱 LINE儲值金：${fmt(r.line_credit_amount)}\n🎫 飲料券：${fmt(r.drink_voucher_amount)}\n━━━━━━━━━━━━━━\n` +
      `🧾 發票：${r.invoice_count || 0} 張（${r.invoice_start || "-"} ~ ${r.invoice_end || "-"}）\n` +
      `💵 現金取出：${fmt(r.cash_in_register || r.cash_amount)}｜零用金：${fmt(r.petty_cash_reserved)}\n` +
      `🏦 應存金額：${fmt(cashToDeposit)}`;

    await pushText(uid, msg);

    // 判斷下一步：是否有需要上傳的非現金單據
    const nextStep = getNextReceiptStep(settlementData, null);
    if (nextStep) {
      await setUserState(uid, nextStep.flow, settlementData);
      await pushText(uid, nextStep.message);
    } else {
      await lineClient.pushMessage({
        to: uid,
        messages: [{ type: "text", text: "以上資料是否正確？", quickReply: { items: [
          { type: "action", action: { type: "message", label: "✅ 確認送出", text: "確認日結" } },
          { type: "action", action: { type: "message", label: "📸 重新拍照", text: "重新拍照" } },
          { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
        ]}}],
      });
    }
  } catch (error) {
    console.error("日結單處理錯誤:", error);
    await pushText(uid, "❌ 處理錯誤：" + error.message);
  }
}

// ===== 判斷下一個需要上傳的單據 =====
function getNextReceiptStep(data, currentStep) {
  const steps = [
    { flow: "receipt_ubereats", check: data.uber_eat_amount > 0, message: "🛵 UberEat 金額為 " + fmt(data.uber_eat_amount) + "\n\n請拍照上傳 UberEats 對帳單（需包含流水號）\n輸入「跳過」可略過" },
    { flow: "receipt_meal_voucher", check: data.meal_voucher_amount > 0, message: "🎫 餐券金額為 " + fmt(data.meal_voucher_amount) + "\n\n請拍照上傳今日收到的餐券（需包含流水號）\n輸入「跳過」可略過" },
    { flow: "receipt_line_credit", check: data.line_credit_amount > 0, message: "📱 LINE 儲值金為 " + fmt(data.line_credit_amount) + "\n\n請拍照上傳 LINE 儲值金單據\n輸入「跳過」可略過" },
    { flow: "receipt_drink_voucher", check: data.drink_voucher_amount > 0, message: "🎫 飲料券金額為 " + fmt(data.drink_voucher_amount) + "\n\n請拍照上傳飲料券（需包含流水號）\n輸入「跳過」可略過" },
  ];

  let found = currentStep === null;
  for (const step of steps) {
    if (found && step.check) return step;
    if (step.flow === currentStep) found = true;
  }
  return null;
}

// ===== 處理非現金單據照片 =====
async function handleReceiptImage(event, state) {
  const uid = event.source.userId;
  const receiptType = state.current_flow.replace("receipt_", "");

  await replyText(event.replyToken, "📸 正在辨識單據...");

  try {
    const base64 = await downloadImageAsBase64(event.message.id);
    const imageUrl = await uploadImage(base64, "receipts_detail", `${receiptType}_${Date.now()}`);

    // 記錄到 flow_data
    const data = state.flow_data;
    data.receipts = data.receipts || [];
    data.receipts.push({ type: receiptType, image_url: imageUrl });

    // 判斷下一步
    const nextStep = getNextReceiptStep(data, state.current_flow);
    if (nextStep) {
      await setUserState(uid, nextStep.flow, data);
      await pushText(uid, `✅ ${receiptType} 單據已記錄\n\n${nextStep.message}`);
    } else {
      await setUserState(uid, "settlement_confirm", data);
      await pushText(uid, `✅ ${receiptType} 單據已記錄\n\n所有單據已收齊！`);
      await lineClient.pushMessage({
        to: uid,
        messages: [{ type: "text", text: "確認送出日結單？", quickReply: { items: [
          { type: "action", action: { type: "message", label: "✅ 確認送出", text: "確認日結" } },
          { type: "action", action: { type: "message", label: "📸 重新拍照", text: "重新拍照" } },
          { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
        ]}}],
      });
    }
  } catch (error) {
    console.error("單據處理錯誤:", error);
    await pushText(uid, "❌ 處理錯誤，請重新拍照。");
  }
}

// ===== 跳過當前單據步驟 =====
async function skipReceiptStep(uid, state) {
  const data = state.flow_data;
  const nextStep = getNextReceiptStep(data, state.current_flow);

  if (nextStep) {
    await setUserState(uid, nextStep.flow, data);
    return nextStep.message;
  } else {
    await setUserState(uid, "settlement_confirm", data);
    return null; // 全部完成
  }
}

// ===== 確認儲存日結單 =====
async function confirmSettlement(uid, employee) {
  const state = await getUserState(uid);
  if (!state || state.current_flow !== "settlement_confirm") return false;
  const d = state.flow_data;

  const { data: settlement, error } = await supabase.from("daily_settlements").upsert({
    store_id: d.store_id, date: d.date, period_start: d.period_start, period_end: d.period_end,
    cashier_name: d.cashier_name || d.employee_name, net_sales: d.net_sales, discount_total: d.discount_total,
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
        settlement_id: settlement.id,
        receipt_type: r.type,
        image_url: r.image_url,
      }).catch(() => {});
    }
  }

  // 推播給總部
  const { data: admins } = await supabase.from("employees").select("line_uid").eq("role", "admin").eq("is_active", true);
  if (admins) {
    for (const a of admins) {
      if (a.line_uid && a.line_uid !== uid) {
        await pushText(a.line_uid, `📊 日結回報\n${d.store_name} ${d.date}\n👤 ${d.employee_name}\n💰 營業淨額：${fmt(d.net_sales)}\n💵 應存現金：${fmt(d.cash_to_deposit)}`).catch(() => {});
      }
    }
  }

  await clearUserState(uid);
  return true;
}

// ===== 存款流程：開始 =====
async function startDeposit(replyToken, employee) {
  const { data: stores } = await supabase.from("stores").select("*").eq("is_active", true);
  const storeItems = (stores || []).map(s => ({
    type: "action",
    action: { type: "message", label: s.name, text: `存款門市:${s.name}` },
  }));

  await setUserState(employee.line_uid, "deposit_select_store", { employee_name: employee.name, employee_id: employee.id });
  return replyWithQuickReply(replyToken, `🏦 存款回報\n\n👤 匯款人：${employee.name}\n\n請選擇門市：`, storeItems);
}

// ===== 存款：選門市後等照片 =====
async function handleDepositStoreSelection(replyToken, uid, storeName, state) {
  const store = await matchStore(storeName);
  if (!store) return replyText(replyToken, "❌ 找不到門市，請重新選擇。");

  // 查上次存款日
  const { data: lastDeposit } = await supabase.from("deposits").select("deposit_date")
    .eq("store_id", store.id).eq("status", "matched").order("deposit_date", { ascending: false }).limit(1).single();

  const suggestedStart = lastDeposit
    ? new Date(new Date(lastDeposit.deposit_date).getTime() + 86400000).toISOString().split("T")[0]
    : "上次存款日隔天";

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });

  await setUserState(uid, "deposit_photo", {
    ...state.flow_data, store_id: store.id, store_name: store.name,
    period_start: lastDeposit ? new Date(new Date(lastDeposit.deposit_date).getTime() + 86400000).toISOString().split("T")[0] : null,
  });

  return replyText(replyToken,
    `🏦 存款回報\n👤 匯款人：${state.flow_data.employee_name}\n🏠 門市：${store.name}\n📅 建議區間：${suggestedStart} ~ ${today}\n\n📸 請拍照上傳銀行存款單`
  );
}

// ===== 存款：處理照片 =====
async function handleDepositImage(event, employee, state) {
  const uid = event.source.userId;
  await replyText(event.replyToken, "🏦 AI 正在辨識存款單，請稍候...");

  try {
    const base64 = await downloadImageAsBase64(event.message.id);
    const r = await analyzeDepositSlip(base64);
    if (!r) { await pushText(uid, "❌ 辨識失敗，請重新拍攝。"); return; }

    const d = state.flow_data;
    const depositDate = r.deposit_date || new Date().toISOString().split("T")[0];
    const periodStart = d.period_start || new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

    // 加總期間應存金額
    const { data: settlements } = await supabase.from("daily_settlements")
      .select("date, cash_to_deposit, cash_amount, petty_cash_reserved")
      .eq("store_id", d.store_id).gte("date", periodStart).lte("date", depositDate);

    const expectedCash = (settlements || []).reduce((sum, s) => {
      return sum + Number(s.cash_to_deposit || (Number(s.cash_amount || 0) - Number(s.petty_cash_reserved || 0)));
    }, 0);

    const depositAmount = r.deposit_amount || 0;
    const diff = depositAmount - expectedCash;
    const absDiff = Math.abs(diff);
    const tolerance = 500;

    let status, emoji, statusText;
    if (absDiff <= tolerance) { status = "matched"; emoji = "✅"; statusText = "吻合"; }
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

    const msg =
      `🏦 存款核對結果\n━━━━━━━━━━━━━━\n` +
      `🏠 ${d.store_name}\n👤 匯款人：${d.employee_name}\n` +
      `🏦 ${r.bank_name || ""} ${r.bank_branch || ""}\n📅 ${r.roc_date || depositDate}\n` +
      `📅 核對區間：${periodStart} ~ ${depositDate}\n━━━━━━━━━━━━━━\n` +
      `💰 存款金額：${fmt(depositAmount)}\n📊 應存現金：${fmt(expectedCash)}\n` +
      `📐 差異：${diff >= 0 ? "+" : ""}${fmt(diff)}\n━━━━━━━━━━━━━━\n` +
      `${emoji} ${statusText}\n📋 包含 ${(settlements || []).length} 天日結資料`;

    await pushText(uid, msg);

    // 異常通報總部
    if (status === "anomaly" || status === "minor_diff") {
      const { data: admins } = await supabase.from("employees").select("line_uid").eq("role", "admin").eq("is_active", true);
      if (admins) {
        for (const a of admins) {
          if (a.line_uid) {
            await pushText(a.line_uid, `${emoji} 存款${statusText}\n${d.store_name}｜匯款人：${d.employee_name}\n存款 ${fmt(depositAmount)} vs 應存 ${fmt(expectedCash)}\n差異：${fmt(diff)}`).catch(() => {});
          }
        }
      }
    }

    await clearUserState(uid);
  } catch (error) {
    console.error("存款處理錯誤:", error);
    await pushText(uid, "❌ 處理錯誤：" + error.message);
  }
}

// ===== 查詢今日營收 =====
async function queryTodayRevenue(replyToken, employee) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  let query = supabase.from("daily_settlements").select("*, stores(name)").eq("date", today);

  // 管理者只看自己門市
  if (employee?.role === "manager" && employee?.managed_store_id) {
    query = query.eq("store_id", employee.managed_store_id);
  }

  const { data } = await query;
  if (!data || data.length === 0) return replyText(replyToken, `📊 ${today} 尚無日結回報。`);

  let msg = `📊 ${today} 營收速報\n━━━━━━━━━━━━━━\n`;
  let total = 0;
  for (const s of data) {
    msg += `\n🔹 ${s.stores?.name}\n　淨額 ${fmt(s.net_sales)}｜現金 ${fmt(s.cash_amount)}\n　TWQR ${fmt(s.twqr_amount)}｜UberEat ${fmt(s.uber_eat_amount)}\n`;
    total += Number(s.net_sales || 0);
  }
  msg += `\n━━━━━━━━━━━━━━\n💰 合計：${fmt(total)}`;
  return replyText(replyToken, msg);
}

// ===== 主事件處理 =====
async function handleEvent(event) {
  const userId = event.source.userId;
  const employee = await getEmployee(userId);
  const state = await getUserState(userId);

  // ===== 圖片訊息 =====
  if (event.type === "message" && event.message.type === "image") {
    if (!employee) return replyText(event.replyToken, "❌ 你還沒有綁定員工帳號，請先輸入：\n綁定 你的綁定碼");
    if (state?.current_flow === "settlement_photo") return handleSettlementImage(event, employee, state);
    if (state?.current_flow === "deposit_photo") return handleDepositImage(event, employee, state);
    if (state?.current_flow?.startsWith("receipt_")) return handleReceiptImage(event, state);
    return replyText(event.replyToken, "📷 請先選擇功能再拍照上傳。");
  }

  if (event.type !== "message" || event.message.type !== "text") return;

  const text = event.message.text.trim();
  const rt = event.replyToken;

  // ===== 綁定流程（不需要先登入）=====
  if (text.startsWith("綁定") || text.startsWith("綁定 ")) {
    const code = text.replace(/^綁定\s*/, "").trim();
    if (!code) return replyText(rt, "請輸入綁定碼，格式：綁定 123456");
    return handleBinding(rt, userId, code);
  }

  // ===== 未綁定用戶 =====
  if (!employee) {
    return replyText(rt,
      `🍯 歡迎來到小食糖內部系統！\n\n` +
      `你的 LINE 帳號尚未綁定。\n請向主管索取綁定碼，然後輸入：\n\n綁定 你的6位數綁定碼\n\n例如：綁定 123456`
    );
  }

  // ===== 已綁定：取消操作 =====
  if (text === "取消") {
    await clearUserState(userId);
    return replyWithQuickReply(rt, "已取消。", getMenu(employee.role));
  }

  // ===== 日結門市選擇 =====
  if (text.startsWith("日結門市:") && state?.current_flow === "settlement_select_store") {
    return handleStoreSelection(rt, userId, text.replace("日結門市:", ""), state);
  }

  // ===== 存款門市選擇 =====
  if (text.startsWith("存款門市:") && state?.current_flow === "deposit_select_store") {
    return handleDepositStoreSelection(rt, userId, text.replace("存款門市:", ""), state);
  }

  // ===== 跳過單據 =====
  if (text === "跳過" && state?.current_flow?.startsWith("receipt_")) {
    const nextMsg = await skipReceiptStep(userId, state);
    if (nextMsg) {
      return replyText(rt, "⏭️ 已跳過\n\n" + nextMsg);
    } else {
      return replyWithQuickReply(rt, "所有單據已處理完畢！確認送出？", [
        { type: "action", action: { type: "message", label: "✅ 確認送出", text: "確認日結" } },
        { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
      ]);
    }
  }

  // ===== 功能指令 =====
  if (text === "日結回報") return startSettlement(rt, employee);
  if (text === "存款回報") return startDeposit(rt, employee);
  if (text === "今日營收") return queryTodayRevenue(rt, employee);

  if (text === "確認日結") {
    const ok = await confirmSettlement(userId, employee);
    if (ok) return replyWithQuickReply(rt, "✅ 日結單已儲存！辛苦了 👋", getMenu(employee.role));
    return replyText(rt, "❌ 儲存失敗，請重試。");
  }

  if (text === "重新拍照") {
    if (state?.current_flow?.includes("settlement")) {
      await setUserState(userId, "settlement_photo", state.flow_data);
      return replyText(rt, "📸 請重新拍照上傳 POS 日結單");
    }
    if (state?.current_flow?.includes("deposit")) {
      await setUserState(userId, "deposit_photo", state.flow_data);
      return replyText(rt, "📸 請重新拍照上傳存款單");
    }
  }

  // 建置中功能
  if (["上班打卡", "下班打卡", "今日SOP", "我的班表", "請假申請", "學習中心", "支出登記", "門市出勤", "全店出勤"].includes(text)) {
    return replyText(rt, `${text} 模組建置中，敬請期待！`);
  }

  // 預設選單
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
