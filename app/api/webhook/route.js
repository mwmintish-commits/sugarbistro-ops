import crypto from "crypto";
import { replyText, replyWithQuickReply, lineConfig } from "@/lib/line";

// 驗證 LINE 簽名
function verifySignature(body, signature) {
  const hash = crypto
    .createHmac("SHA256", lineConfig.channelSecret)
    .update(body)
    .digest("base64");
  return hash === signature;
}

// 主選單快速回覆按鈕
const MAIN_MENU = [
  { type: "action", action: { type: "message", label: "📍 上班打卡", text: "上班打卡" } },
  { type: "action", action: { type: "message", label: "📍 下班打卡", text: "下班打卡" } },
  { type: "action", action: { type: "message", label: "📋 今日SOP", text: "今日SOP" } },
  { type: "action", action: { type: "message", label: "💰 日結回報", text: "日結回報" } },
  { type: "action", action: { type: "message", label: "📅 我的班表", text: "我的班表" } },
  { type: "action", action: { type: "message", label: "🙋 請假申請", text: "請假申請" } },
  { type: "action", action: { type: "message", label: "📖 學習中心", text: "學習中心" } },
  { type: "action", action: { type: "message", label: "🧾 支出登記", text: "支出登記" } },
];

// 處理每個事件
async function handleEvent(event) {
  // 只處理文字訊息
  if (event.type !== "message" || event.message.type !== "text") {
    return;
  }

  const text = event.message.text.trim();
  const userId = event.source.userId;
  const replyToken = event.replyToken;

  // 根據訊息內容回覆
  switch (text) {
    case "選單":
    case "主選單":
    case "menu":
      return replyWithQuickReply(
        replyToken,
        "🍯 小食糖內部系統\n請選擇功能：",
        MAIN_MENU
      );

    case "上班打卡":
      return replyText(
        replyToken,
        `📍 上班打卡功能建置中...\n\n` +
        `你的 LINE ID: ${userId}\n` +
        `時間: ${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}\n\n` +
        `✅ 系統已收到，打卡模組即將上線！`
      );

    case "下班打卡":
      return replyText(
        replyToken,
        `📍 下班打卡功能建置中...\n\n` +
        `時間: ${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}\n\n` +
        `✅ 系統已收到，打卡模組即將上線！`
      );

    case "今日SOP":
      return replyText(replyToken, "📋 SOP 模組建置中，敬請期待！");

    case "日結回報":
      return replyText(replyToken, "💰 日結回報模組建置中，敬請期待！");

    case "我的班表":
      return replyText(replyToken, "📅 班表查詢模組建置中，敬請期待！");

    case "請假申請":
      return replyText(replyToken, "🙋 請假申請模組建置中，敬請期待！");

    case "學習中心":
      return replyText(replyToken, "📖 學習中心模組建置中，敬請期待！");

    case "支出登記":
      return replyText(replyToken, "🧾 支出登記模組建置中，敬請期待！");

    default:
      // 任何其他訊息都顯示主選單
      return replyWithQuickReply(
        replyToken,
        `🍯 小食糖內部系統\n\n` +
        `嗨！請點選下方按鈕操作，或輸入「選單」顯示功能列表。`,
        MAIN_MENU
      );
  }
}

// POST: LINE Webhook 接收端
export async function POST(request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-line-signature");

    // 驗證簽名
    if (!verifySignature(body, signature)) {
      console.error("❌ LINE 簽名驗證失敗");
      return new Response("Invalid signature", { status: 401 });
    }

    const { events } = JSON.parse(body);

    // 處理所有事件
    await Promise.all(events.map(handleEvent));

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("❌ Webhook 錯誤:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// GET: 健康檢查（Zeabur 部署驗證用）
export async function GET() {
  return new Response("🍯 小食糖 LINE Bot is running!", { status: 200 });
}
