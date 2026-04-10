import { lineConfig } from "@/lib/line";

const BASE = "https://api.line.me/v2/bot";

async function lineAPI(path, method, body, contentType) {
  const headers = { Authorization: `Bearer ${lineConfig.channelAccessToken}` };
  if (contentType) headers["Content-Type"] = contentType;
  else if (body && !(body instanceof Buffer)) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body instanceof Buffer ? body : body ? JSON.stringify(body) : undefined,
  });
  if (contentType) return res;
  return res.json();
}

// 產生簡易 Rich Menu 圖片（純色塊+文字，用 SVG 轉 PNG 不行，改用 jimp）
async function generateMenuImage() {
  // 如果無法產生圖片，回傳 null（使用者需手動上傳）
  try {
    const Jimp = (await import("jimp")).Jimp;
    const img = new Jimp({ width: 2500, height: 843, color: 0x1a1a1aff });
    
    // 畫格線
    const cols = [0, 833, 1667, 2500];
    for (let x = 0; x < 2500; x++) {
      for (let y = 0; y < 843; y++) {
        // 格線
        if (Math.abs(x - 833) < 2 || Math.abs(x - 1667) < 2 || Math.abs(y - 421) < 2) {
          img.setPixelColor(0x333333ff, x, y);
        }
      }
    }
    
    const buf = await img.getBuffer("image/jpeg");
    return buf;
  } catch (e) {
    console.error("Image gen failed:", e.message);
    return null;
  }
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "setup") {
    // 1. 刪除舊的 Rich Menu
    const { richmenus } = await lineAPI("/richmenu/list", "GET");
    if (richmenus?.length) {
      for (const rm of richmenus) {
        await lineAPI(`/richmenu/${rm.richMenuId}`, "DELETE");
      }
    }

    // 2. 建立 Rich Menu
    const menuData = {
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
    };

    const result = await lineAPI("/richmenu", "POST", menuData);
    if (!result.richMenuId) return Response.json({ error: "建立失敗", detail: result }, { status: 500 });

    const menuId = result.richMenuId;

    // 3. 上傳圖片
    const imgBuf = await generateMenuImage();
    if (imgBuf) {
      await lineAPI(`/richmenu/${menuId}/content`, "POST", imgBuf, "image/jpeg");
    }

    // 4. 設為預設
    await lineAPI(`/user/all/richmenu/${menuId}`, "POST", {});

    return Response.json({ success: true, richMenuId: menuId, hasImage: !!imgBuf, note: imgBuf ? "已自動產生圖片（純色塊），建議到 LINE Official Account Manager 替換更美觀的圖片" : "請到 LINE Official Account Manager 上傳選單圖片" });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
