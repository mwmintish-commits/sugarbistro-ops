import crypto from "crypto";
import { replyText, replyWithQuickReply, downloadImageAsBase64, lineConfig, pushText, lineClient } from "@/lib/line";
import { supabase } from "@/lib/supabase";
import { analyzeDailySettlement, analyzeDepositSlip } from "@/lib/anthropic";

function verifySignature(body, signature) {
  const hash = crypto.createHmac("SHA256", lineConfig.channelSecret).update(body).digest("base64");
  return hash === signature;
}

const MAIN_MENU = [
  { type: "action", action: { type: "message", label: "💰 日結回報", text: "日結回報" } },
  { type: "action", action: { type: "message", label: "🏦 存款回報", text: "存款回報" } },
  { type: "action", action: { type: "message", label: "📊 今日營收", text: "今日營收" } },
  { type: "action", action: { type: "message", label: "📍 上班打卡", text: "上班打卡" } },
  { type: "action", action: { type: "message", label: "📋 今日SOP", text: "今日SOP" } },
  { type: "action", action: { type: "message", label: "📅 我的班表", text: "我的班表" } },
  { type: "action", action: { type: "message", label: "🙋 請假申請", text: "請假申請" } },
  { type: "action", action: { type: "message", label: "🧾 支出登記", text: "支出登記" } },
];

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

// ===== 員工 =====
async function getEmployee(uid) {
  const { data } = await supabase.from("employees").select("*, stores(*)").eq("line_uid", uid).eq("is_active", true).single();
  return data;
}

// ===== 門市比對 =====
async function matchStore(name) {
  if (!name) return null;
  const { data: stores } = await supabase.from("stores").select("*").eq("is_active", true);
  if (!stores) return null;
  const n = name.toLowerCase();
  for (const s of stores) {
    if (s.name.includes("台北") && (n.includes("台北") || n.includes("taipei"))) return s;
    if (s.name.includes("屏東") && (n.includes("屏東") || n.includes("pingtung"))) return s;
    if (s.name.includes("左營") && (n.includes("左營") || n.includes("新光"))) return s;
    if (s.name.includes("SKM") && n.includes("skm")) return s;
    if (s.name.toLowerCase().includes(n) || n.includes(s.name.toLowerCase())) return s;
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

// ===== 日結單處理 =====
async function handleSettlementImage(event, employee) {
  const messageId = event.message.id;
  const uid = event.source.userId;

  await replyText(event.replyToken, "📸 收到照片！AI 正在辨識日結單，請稍候約 10 秒...");

  try {
    const base64 = await downloadImageAsBase64(messageId);
    const r = await analyzeDailySettlement(base64);

    if (!r) {
      await pushText(uid, "❌ 辨識失敗，請確保照片清晰完整後重新拍照，或輸入「取消」返回。");
      return;
    }

    // 比對門市
    let store = await matchStore(r.store_name);
    if (!store && employee?.store_id) {
      const { data } = await supabase.from("stores").select("*").eq("id", employee.store_id).single();
      store = data;
    }

    // 計算應存現金 = 現金營收 - 預留零用金
    const cashToDeposit = (r.cash_in_register || r.cash_amount || 0) - (r.petty_cash_reserved || 0);

    // 取日期（從 period_end 擷取日期部分）
    const dateStr = r.period_end ? r.period_end.split(" ")[0] : new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });

    // 上傳圖片
    const imageUrl = await uploadImage(base64, "settlements", `${store?.name || "unknown"}_${dateStr}_${Date.now()}`);

    // 存到用戶狀態
    await setUserState(uid, "settlement_confirm", {
      store_id: store?.id,
      store_name: store?.name || "未識別門市",
      date: dateStr,
      period_start: r.period_start,
      period_end: r.period_end,
      cashier_name: r.cashier_name,
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
    });

    // 發送辨識結果
    const msg =
      `📊 日結單辨識結果\n` +
      `━━━━━━━━━━━━━━\n` +
      `🏠 ${store?.name || r.store_name || "未識別"}\n` +
      `📅 ${dateStr}\n` +
      `👤 結單人員：${r.cashier_name || "-"}\n` +
      `━━━━━━━━━━━━━━\n` +
      `💰 營業淨額：${fmt(r.net_sales)}\n` +
      `━━━━━━━━━━━━━━\n` +
      `💵 現金：${fmt(r.cash_amount)}\n` +
      `📱 LINE Pay：${fmt(r.line_pay_amount)}\n` +
      `📱 TWQR：${fmt(r.twqr_amount)}\n` +
      `🛵 UberEat：${fmt(r.uber_eat_amount)}\n` +
      `💳 悠遊卡：${fmt(r.easy_card_amount)}\n` +
      `🎫 餐券：${fmt(r.meal_voucher_amount)}\n` +
      `📱 LINE儲值金：${fmt(r.line_credit_amount)}\n` +
      `🎫 飲料券：${fmt(r.drink_voucher_amount)}\n` +
      `━━━━━━━━━━━━━━\n` +
      `🧾 發票：${r.invoice_count || 0} 張\n` +
      `🔢 ${r.invoice_start || "-"} ~ ${r.invoice_end || "-"}\n` +
      `━━━━━━━━━━━━━━\n` +
      `💵 現金取出：${fmt(r.cash_in_register || r.cash_amount)}\n` +
      `💰 預留零用金：${fmt(r.petty_cash_reserved)}\n` +
      `🏦 應存金額：${fmt(cashToDeposit)}`;

    await pushText(uid, msg);

    await lineClient.pushMessage({
      to: uid,
      messages: [{
        type: "text",
        text: "以上資料是否正確？",
        quickReply: {
          items: [
            { type: "action", action: { type: "message", label: "✅ 確認送出", text: "確認日結" } },
            { type: "action", action: { type: "message", label: "📸 重新拍照", text: "重新拍照" } },
            { type: "action", action: { type: "message", label: "🔙 取消", text: "取消" } },
          ],
        },
      }],
    });
  } catch (error) {
    console.error("日結單處理錯誤:", error);
    await pushText(uid, "❌ 處理過程發生錯誤：" + error.message + "\n請重新拍照或輸入「取消」。");
  }
}

// ===== 確認儲存日結單 =====
async function confirmSettlement(uid, employee) {
  const state = await getUserState(uid);
  if (!state || state.current_flow !== "settlement_confirm") return false;
  const d = state.flow_data;

  const { error } = await supabase.from("daily_settlements").upsert({
    store_id: d.store_id,
    date: d.date,
    period_start: d.period_start,
    period_end: d.period_end,
    cashier_name: d.cashier_name,
    net_sales: d.net_sales,
    discount_total: d.discount_total,
    cash_amount: d.cash_amount,
    line_pay_amount: d.line_pay_amount,
    twqr_amount: d.twqr_amount,
    uber_eat_amount: d.uber_eat_amount,
    easy_card_amount: d.easy_card_amount,
    meal_voucher_amount: d.meal_voucher_amount,
    line_credit_amount: d.line_credit_amount,
    drink_voucher_amount: d.drink_voucher_amount,
    invoice_count: d.invoice_count,
    invoice_start: d.invoice_start,
    invoice_end: d.invoice_end,
    void_invoice_count: d.void_invoice_count,
    void_invoice_amount: d.void_invoice_amount,
    cash_in_register: d.cash_in_register,
    petty_cash_reserved: d.petty_cash_reserved,
    cash_to_deposit: d.cash_to_deposit,
    bonus_item_count: d.bonus_item_count,
    bonus_item_amount: d.bonus_item_amount,
    image_url: d.image_url,
    ai_raw_data: d.ai_raw_data,
    manually_corrected: d.manually_corrected || false,
    submitted_by: employee?.id,
    submitted_at: new Date().toISOString(),
  }, { onConflict: "store_id,date" });

  if (error) {
    console.error("儲存日結單錯誤:", error);
    return false;
  }
  await clearUserState(uid);
  return true;
}

// ===== 存款單處理 =====
async function handleDepositImage(event, employee) {
  const uid = event.source.userId;
  await replyText(event.replyToken, "🏦 收到照片！AI 正在辨識存款單，請稍候...");

  try {
    const base64 = await downloadImageAsBase64(event.message.id);
    const r = await analyzeDepositSlip(base64);

    if (!r) {
      await pushText(uid, "❌ 辨識失敗，請重新拍攝清晰的存款單。");
      return;
    }

    const store = employee?.stores;
    if (!store) {
      await pushText(uid, "❌ 找不到你所屬的門市，請聯繫主管設定。");
      return;
    }

    // 查上次存款日
    const { data: lastDeposit } = await supabase
      .from("deposits").select("deposit_date")
      .eq("store_id", store.id).order("deposit_date", { ascending: false }).limit(1).single();

    const periodStart = lastDeposit
      ? new Date(new Date(lastDeposit.deposit_date).getTime() + 86400000).toISOString().split("T")[0]
      : new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

    const depositDate = r.deposit_date || new Date().toISOString().split("T")[0];

    // 加總期間現金應存金額
    const { data: settlements } = await supabase
      .from("daily_settlements").select("date, cash_to_deposit, cash_amount, petty_cash_reserved")
      .eq("store_id", store.id).gte("date", periodStart).lte("date", depositDate);

    const expectedCash = (settlements || []).reduce((sum, s) => {
      const toDeposit = s.cash_to_deposit || (Number(s.cash_amount || 0) - Number(s.petty_cash_reserved || 0));
      return sum + toDeposit;
    }, 0);

    const depositAmount = r.deposit_amount || 0;
    const diff = depositAmount - expectedCash;
    const absDiff = Math.abs(diff);
    const tolerance = store.deposit_tolerance || 500;

    let status, emoji, statusText;
    if (absDiff <= tolerance) {
      status = "matched"; emoji = "✅"; statusText = "吻合";
    } else if (absDiff <= 2000) {
      status = "minor_diff"; emoji = "⚠️"; statusText = "小差異，請確認";
    } else {
      status = "anomaly"; emoji = "🚨"; statusText = "異常！已通知主管";
    }

    const imageUrl = await uploadImage(base64, "deposits", `${store.name}_${depositDate}_${Date.now()}`);

    await supabase.from("deposits").insert({
      store_id: store.id,
      deposit_date: depositDate,
      amount: depositAmount,
      bank_name: r.bank_name,
      bank_branch: r.bank_branch,
      account_number: r.account_number,
      depositor_name: r.depositor_name,
      roc_date: r.roc_date,
      period_start: periodStart,
      period_end: depositDate,
      expected_cash: expectedCash,
      difference: diff,
      status,
      image_url: imageUrl,
      ai_raw_data: r,
      submitted_by: employee?.id,
    });

    const msg =
      `🏦 存款核對結果\n━━━━━━━━━━━━━━\n` +
      `🏠 ${store.name}\n` +
      `🏦 ${r.bank_name || ""} ${r.bank_branch || ""}\n` +
      `📅 存款日：${r.roc_date || depositDate}\n` +
      `📅 核對期間：${periodStart} ~ ${depositDate}\n` +
      `━━━━━━━━━━━━━━\n` +
      `💰 存款金額：${fmt(depositAmount)}\n` +
      `📊 期間應存現金：${fmt(expectedCash)}\n` +
      `📐 差異：${diff >= 0 ? "+" : ""}${fmt(diff)}\n` +
      `━━━━━━━━━━━━━━\n` +
      `${emoji} ${statusText}\n` +
      (settlements ? `📋 包含 ${settlements.length} 天的日結資料` : "");

    await pushText(uid, msg);

    if (status === "anomaly") {
      const { data: managers } = await supabase
        .from("employees").select("line_uid").in("role", ["manager", "admin"]).eq("is_active", true);
      if (managers) {
        for (const m of managers) {
          if (m.line_uid) {
            await pushText(m.line_uid, `🚨 存款異常\n${store.name} 差異 ${fmt(diff)}\n存款 ${fmt(depositAmount)} vs 應存 ${fmt(expectedCash)}`);
          }
        }
      }
    }

    await clearUserState(uid);
  } catch (error) {
    console.error("存款單處理錯誤:", error);
    await pushText(uid, "❌ 處理錯誤：" + error.message);
  }
}

// ===== 查詢今日營收 =====
async function queryTodayRevenue(replyToken) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const { data } = await supabase.from("daily_settlements").select("*, stores(name)").eq("date", today);

  if (!data || data.length === 0) {
    return replyText(replyToken, `📊 ${today} 尚無門市回報日結單。`);
  }

  let msg = `📊 ${today} 營收速報\n━━━━━━━━━━━━━━\n`;
  let total = 0;
  for (const s of data) {
    msg += `\n🔹 ${s.stores?.name || "未知"}\n`;
    msg += `　營業淨額 ${fmt(s.net_sales)}\n`;
    msg += `　現金 ${fmt(s.cash_amount)}｜TWQR ${fmt(s.twqr_amount)}\n`;
    msg += `　UberEat ${fmt(s.uber_eat_amount)}｜餐券 ${fmt(s.meal_voucher_amount)}\n`;
    total += Number(s.net_sales || 0);
  }
  msg += `\n━━━━━━━━━━━━━━\n💰 全店合計：${fmt(total)}\n📋 已回報 ${data.length}/4 間`;
  return replyText(replyToken, msg);
}

// ===== 主事件處理 =====
async function handleEvent(event) {
  const userId = event.source.userId;
  const employee = await getEmployee(userId);
  const state = await getUserState(userId);

  // 圖片訊息
  if (event.type === "message" && event.message.type === "image") {
    if (state?.current_flow === "settlement_photo") return handleSettlementImage(event, employee);
    if (state?.current_flow === "deposit_photo") return handleDepositImage(event, employee);
    return replyText(event.replyToken, "📷 請先點選「日結回報」或「存款回報」，再拍照上傳。");
  }

  if (event.type !== "message" || event.message.type !== "text") return;

  const text = event.message.text.trim();
  const rt = event.replyToken;

  if (text === "取消") { await clearUserState(userId); return replyWithQuickReply(rt, "已取消。", MAIN_MENU); }

  // 日結流程
  if (text === "日結回報") {
    await setUserState(userId, "settlement_photo");
    return replyText(rt, "📸 請拍照上傳今日 POS 日結單\n\n提示：\n・確保單據平整、光線充足\n・完整拍入所有數字\n\n輸入「取消」返回選單");
  }
  if (text === "確認日結") {
    const ok = await confirmSettlement(userId, employee);
    if (ok) return replyWithQuickReply(rt, "✅ 日結單已儲存！辛苦了 👋", MAIN_MENU);
    return replyText(rt, "❌ 儲存失敗，請重試。");
  }
  if (text === "重新拍照") {
    await setUserState(userId, state?.current_flow === "settlement_confirm" ? "settlement_photo" : "deposit_photo");
    return replyText(rt, "📸 請重新拍照上傳");
  }

  // 存款流程
  if (text === "存款回報") {
    await setUserState(userId, "deposit_photo");
    return replyText(rt, "🏦 請拍照上傳銀行存款單\n\n提示：\n・金額和日期要清晰可見\n・整張存款單入鏡\n\n輸入「取消」返回選單");
  }

  // 營收查詢
  if (text === "今日營收") return queryTodayRevenue(rt);

  // 其他建置中
  if (["上班打卡", "下班打卡", "今日SOP", "我的班表", "請假申請", "學習中心", "支出登記"].includes(text)) {
    return replyText(rt, `${text} 模組建置中，敬請期待！`);
  }

  // 預設選單
  return replyWithQuickReply(rt, "🍯 小食糖內部系統\n請點選功能：", MAIN_MENU);
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
