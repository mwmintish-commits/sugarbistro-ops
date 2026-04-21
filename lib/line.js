import { messagingApi } from "@line/bot-sdk";

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET || "",
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
};

export const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

export const lineBlobClient = new messagingApi.MessagingApiBlobClient({
  channelAccessToken: config.channelAccessToken,
});

export const lineConfig = config;

export async function replyText(replyToken, text) {
  return lineClient.replyMessage({
    replyToken,
    messages: [{ type: "text", text }],
  });
}

export async function replyMessages(replyToken, messages) {
  return lineClient.replyMessage({ replyToken, messages });
}

export async function replyWithQuickReply(replyToken, text, _items) {
  return lineClient.replyMessage({
    replyToken,
    messages: [{ type: "text", text }],
  });
}

export async function pushText(userId, text) {
  return lineClient.pushMessage({
    to: userId,
    messages: [{ type: "text", text }],
  });
}

export async function downloadImageAsBase64(messageId) {
  const url = `https://api-data.line.me/v2/bot/message/${messageId}/content`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.channelAccessToken}` },
  });
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString("base64");
}
