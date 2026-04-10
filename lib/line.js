import { messagingApi, middleware } from "@line/bot-sdk";

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET || "",
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
};

export const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

export const lineConfig = config;

// 發送文字訊息
export async function replyText(replyToken, text) {
  return lineClient.replyMessage({
    replyToken,
    messages: [{ type: "text", text }],
  });
}

// 發送按鈕選單
export async function replyButtons(replyToken, title, text, actions) {
  return lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "template",
        altText: title,
        template: {
          type: "buttons",
          title,
          text,
          actions,
        },
      },
    ],
  });
}

// 發送快速回覆
export async function replyWithQuickReply(replyToken, text, items) {
  return lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text,
        quickReply: { items },
      },
    ],
  });
}

// 推播訊息給指定用戶
export async function pushText(userId, text) {
  return lineClient.pushMessage({
    to: userId,
    messages: [{ type: "text", text }],
  });
}
