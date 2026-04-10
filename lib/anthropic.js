const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// 辨識 POS 日結單（小食糖 SUGARbISTRO 格式）
export async function analyzeDailySettlement(imageBase64) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `這是一張「小食糖 SUGARbISTRO」POS 系統印出的日結單（團結紀錄）。請仔細辨識所有數字，以 JSON 格式回傳，不要加任何其他文字：

{
  "store_name": "門市名稱（從單據上方辨識，例如 小食糖 SUGARbISTRO）",
  "period_start": "期間開始時間，格式 YYYY-MM-DD HH:mm",
  "period_end": "期間結束時間，格式 YYYY-MM-DD HH:mm",
  "cashier_name": "團結人員名稱",
  "net_sales": 營業淨額數字,
  "discount_total": 機前扣或折讓合計數字,
  "cash_amount": 現金(現金支付)期間系統營收數字,
  "line_pay_amount": LINE Pay 期間系統營收數字,
  "twqr_amount": TWQR(固定商支付)期間系統營收數字,
  "uber_eat_amount": UberEat(自定義支付)期間系統營收數字,
  "easy_card_amount": 悠遊(自定義支付)期間系統營收數字,
  "meal_voucher_amount": 50/100餐券(不開立發票)(自定義支付)期間系統營收數字,
  "line_credit_amount": LINE儲值金(不開立發票)(自定義支付)期間系統營收數字,
  "drink_voucher_amount": 130/160飲料券(不開立發票)(自定義支付)期間系統營收數字,
  "invoice_count": 發票張數,
  "invoice_start": "發票起始號碼",
  "invoice_end": "發票結束號碼",
  "void_invoice_count": 本期發票作廢張數,
  "void_invoice_amount": 本期發票作廢金額,
  "cash_in_register": 現金取出金額（期間銷出金額）,
  "petty_cash_reserved": 預留零用金金額,
  "bonus_item_count": 紅利單品數量,
  "bonus_item_amount": 紅利單品金額
}

注意：
- 所有金額只填數字，不要加 $ 符號或逗號
- 如果某項是 $0 或看不到，填 0
- 如果某項不存在，填 null
- 只回傳 JSON，不要有其他文字
- 日期請轉為西元年（如 2026/03/29）`,
            },
          ],
        },
      ],
    }),
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || "";

  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("AI 日結單解析失敗:", text);
    return null;
  }
}

// 辨識華南銀行存款單
export async function analyzeDepositSlip(imageBase64) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `這是一張台灣的銀行存款單（活期性存款存款條/收據）。請仔細辨識所有欄位，以 JSON 格式回傳，不要加任何其他文字：

{
  "bank_name": "銀行名稱（如 華南商業銀行）",
  "bank_branch": "分行名稱（如 屏東分行）",
  "account_number": "帳號（完整帳號數字）",
  "depositor_name": "戶名或存款人名稱",
  "roc_date": "民國年日期原文（如 115年3月16日）",
  "deposit_date": "西元日期，格式 YYYY-MM-DD（民國年+1911=西元年）",
  "deposit_amount": 存款金額數字,
  "deposit_type": "存款類型（活期存款/定期存款等）"
}

注意：
- 金額只填數字，不要加逗號或小數點後的 .00
- 民國年轉西元年：民國115年 = 西元2026年
- 如果某項看不清楚，填 null
- 只回傳 JSON，不要有其他文字`,
            },
          ],
        },
      ],
    }),
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || "";

  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("AI 存款單解析失敗:", text);
    return null;
  }
}
