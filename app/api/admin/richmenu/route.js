import { lineConfig } from "@/lib/line";

async function lineAPI(path, method, body) {
  const res = await fetch(`https://api.line.me/v2/bot${path}`, {
    method,
    headers: { Authorization: `Bearer ${lineConfig.channelAccessToken}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "setup") {
    try {
      // 刪除舊的
      const list = await lineAPI("/richmenu/list", "GET");
      if (list.richmenus?.length) {
        for (const rm of list.richmenus) {
          await fetch(`https://api.line.me/v2/bot/richmenu/${rm.richMenuId}`, {
            method: "DELETE", headers: { Authorization: `Bearer ${lineConfig.channelAccessToken}` },
          });
        }
      }

      // 建立新的
      const result = await lineAPI("/richmenu", "POST", {
        size: { width: 2500, height: 843 },
        selected: true,
        name: "小食糖選單",
        chatBarText: "📋 功能選單",
        areas: [
          { bounds: { x: 0, y: 0, width: 833, height: 421 }, action: { type: "message", text: "上班打卡" } },
          { bounds: { x: 833, y: 0, width: 834, height: 421 }, action: { type: "message", text: "下班打卡" } },
          { bounds: { x: 1667, y: 0, width: 833, height: 421 }, action: { type: "message", text: "我的班表" } },
          { bounds: { x: 0, y: 421, width: 833, height: 422 }, action: { type: "message", text: "日結回報" } },
          { bounds: { x: 833, y: 421, width: 834, height: 422 }, action: { type: "message", text: "存款回報" } },
          { bounds: { x: 1667, y: 421, width: 833, height: 422 }, action: { type: "message", text: "選單" } },
        ],
      });

      if (!result.richMenuId) return Response.json({ error: "建立失敗", detail: result }, { status: 500 });

      // 產生簡易圖片（純黑底 JPEG）
      // 建立最小可用的 2500x843 圖片
      const w = 2500, h = 843;
      const header = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
      ]);
      // 用最簡單方式：上傳一個小圖片
      // LINE 會自動拉伸到選單大小
      const tinyJpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsLDhEQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wgARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAB//EABQBAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhADEAAAAUf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAn//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AX//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/AX//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/An//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IX//2gAMAwEAAgADAAAAEH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==', 'base64');

      await fetch(`https://api.line.me/v2/bot/richmenu/${result.richMenuId}/content`, {
        method: "POST",
        headers: { Authorization: `Bearer ${lineConfig.channelAccessToken}`, "Content-Type": "image/jpeg" },
        body: tinyJpeg,
      });

      // 設為預設
      await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${result.richMenuId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${lineConfig.channelAccessToken}`, "Content-Type": "application/json" },
      });

      return Response.json({
        success: true, richMenuId: result.richMenuId,
        note: "選單結構已建立！目前是黑底暫用圖片。請到 LINE Official Account Manager → 聊天室相關 → 圖文選單，上傳正式的選單圖片。",
      });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
