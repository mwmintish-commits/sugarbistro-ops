// 測試 Resend Email 寄送是否正常 — 後台診斷用
// GET /api/admin/test-email?to=xxx@example.com
export async function GET(request) {
  const to = new URL(request.url).searchParams.get("to");
  const RESEND_KEY = process.env.RESEND_API_KEY;
  const fromAddr = process.env.RESEND_FROM || "小食糖 <onboarding@resend.dev>";

  const diag = {
    has_api_key: !!RESEND_KEY,
    api_key_prefix: RESEND_KEY ? RESEND_KEY.slice(0, 6) + "..." : null,
    from_address: fromAddr,
    using_default_from: !process.env.RESEND_FROM,
    to_address: to || "(未提供)",
  };

  if (!RESEND_KEY) {
    return Response.json({ ok: false, reason: "Zeabur 未設定 RESEND_API_KEY 環境變數", diag, fix: "請至 Zeabur 後台 Variables 新增 RESEND_API_KEY，值取自 https://resend.com/api-keys" }, { status: 500 });
  }
  if (!to) {
    return Response.json({ ok: false, reason: "請在網址加上 ?to=你的email", diag }, { status: 400 });
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + RESEND_KEY },
      body: JSON.stringify({
        from: fromAddr,
        to,
        subject: "【小食糖】Email 寄送測試",
        html: "<h1>✅ 寄送測試成功</h1><p>這是來自 sugarbistro-ops 系統的測試郵件。</p><p>From: " + fromAddr + "</p><p>時間: " + new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) + "</p>",
      }),
    });
    const body = await r.text();
    let parsed = null; try { parsed = JSON.parse(body); } catch {}

    if (!r.ok) {
      let hint = "";
      if (r.status === 401) hint = "API Key 無效或過期";
      else if (r.status === 403) {
        if (body.includes("verify")) hint = "寄件網域未在 Resend 驗證。改用預設 onboarding@resend.dev 只能寄到「Resend 帳號註冊信箱」，無法寄給其他人。請至 https://resend.com/domains 驗證自己的網域，並設定 RESEND_FROM 環境變數。";
        else hint = "權限不足，請檢查 API Key 權限設定";
      } else if (r.status === 422 && body.includes("testing emails")) {
        hint = "使用預設 onboarding@resend.dev 時，只能寄給註冊 Resend 帳號的 email。請驗證自己的網域並設定 RESEND_FROM。";
      }
      return Response.json({ ok: false, status: r.status, response: parsed || body, diag, hint }, { status: 500 });
    }

    return Response.json({ ok: true, message: "✅ 寄出成功！請檢查 " + to + " 的信箱（含垃圾信件夾）", resend_id: parsed?.id, diag });
  } catch (e) {
    return Response.json({ ok: false, reason: "fetch exception: " + e.message, diag }, { status: 500 });
  }
}
