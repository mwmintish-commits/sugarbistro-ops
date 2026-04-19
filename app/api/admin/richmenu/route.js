import { lineConfig } from "@/lib/line";

export async function POST(request) {
  const body = await request.json();

  if (body.action === "setup") {
    const items = body.items || [
      { label: "📱 開啟面板", text: "面板" },
      { label: "🟢 上班打卡", text: "上班打卡" },
      { label: "🔴 下班打卡", text: "下班打卡" },
      { label: "📅 日結回報", text: "日結回報" },
      { label: "🏦 存款回報", text: "存款回報" },
      { label: "📋 選單", text: "選單" },
    ];

    const headers = { Authorization: "Bearer " + lineConfig.channelAccessToken, "Content-Type": "application/json" };

    try {
      // 刪除舊的
      const listRes = await fetch("https://api.line.me/v2/bot/richmenu/list", { headers });
      const list = await listRes.json();
      if (list.richmenus) {
        for (const rm of list.richmenus) {
          await fetch("https://api.line.me/v2/bot/richmenu/" + rm.richMenuId, { method: "DELETE", headers });
        }
      }

      // 建立選單結構（2行3列）
      const W = 2500, H = 843, CW = Math.floor(W / 3), RH = Math.floor(H / 2);
      const areas = items.slice(0, 6).map((item, i) => ({
        bounds: { x: (i % 3) * CW, y: Math.floor(i / 3) * RH, width: CW, height: RH },
        action: { type: "message", text: item.text },
      }));

      const createRes = await fetch("https://api.line.me/v2/bot/richmenu", {
        method: "POST", headers,
        body: JSON.stringify({
          size: { width: W, height: H }, selected: true,
          name: "小食糖選單", chatBarText: "📋 功能選單",
          areas,
        }),
      });
      const result = await createRes.json();
      if (!result.richMenuId) return Response.json({ error: "建立失敗", detail: result }, { status: 500 });

      // 上傳最小圖片（黑底，用戶可到 LINE 後台替換）
      const tinyJpeg = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsLDhEQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wgARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAB//EABQBAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhADEAAAAUf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAn//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AX//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/AX//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/An//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IX//2gAMAwEAAgADAAAAEH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==", "base64");
      await fetch("https://api.line.me/v2/bot/richmenu/" + result.richMenuId + "/content", {
        method: "POST",
        headers: { Authorization: "Bearer " + lineConfig.channelAccessToken, "Content-Type": "image/jpeg" },
        body: tinyJpeg,
      });

      // 設為預設
      await fetch("https://api.line.me/v2/bot/user/all/richmenu/" + result.richMenuId, {
        method: "POST", headers,
      });

      return Response.json({ success: true, richMenuId: result.richMenuId });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
