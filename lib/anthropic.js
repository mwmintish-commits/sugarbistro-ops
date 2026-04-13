const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function callVision(imageBase64, prompt) {
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
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
          { type: "text", text: prompt },
        ],
      }],
    }),
  });
  const data = await response.json();
  const text = data.content?.[0]?.text || "";
  try {
    return JSON.parse(text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
  } catch (e) {
    console.error("AI 解析失敗:", text);
    return null;
  }
}

export async function analyzeDailySettlement(imageBase64) {
  return callVision(imageBase64, `這是一張「小食糖 SUGARbISTRO」POS 系統印出的日結單（關帳紀錄）。請仔細辨識所有數字，以 JSON 格式回傳，不要加任何其他文字：

{
  "store_name": "門市名稱",
  "period_start": "期間開始 YYYY-MM-DD HH:mm",
  "period_end": "期間結束 YYYY-MM-DD HH:mm",
  "cashier_name": "關帳人員名稱",
  "net_sales": 營業淨額數字,
  "discount_total": 總折扣折讓金額數字,
  "cash_amount": 現金(現金支付)期間系統營收數字,
  "twqr_amount": TWQR(自定義支付)期間系統營收數字,
  "uber_eat_amount": UberEats(自定義支付)期間系統營收數字,
  "line_pay_amount": LINE Pay營收數字,
  "easy_card_amount": 悠遊卡營收數字,
  "remittance_amount": 匯款(自定義支付)期間系統營收數字,
  "meal_voucher_amount": 50/100餐券(自定義支付)期間系統營收數字,
  "line_credit_amount": LINE儲值金(自定義支付)期間系統營收數字,
  "drink_voucher_amount": 130/160飲料券(自定義支付)期間系統營收數字,
  "invoice_count": 發票張數,
  "invoice_start": "發票起始號碼",
  "invoice_end": "發票結束號碼",
  "void_invoice_count": 本期發票作廢張數,
  "void_invoice_amount": 本期發票作廢金額,
  "void_invoice_numbers": "本期發票作廢號碼",
  "cash_in_register": 現金取出/期間取出金額,
  "petty_cash_reserved": 預留零用金,
  "void_item_count": 註銷單品數量,
  "void_item_amount": 註銷單品金額
}

金額只填數字不加$或逗號，看不到填0。
重要：POS單上的日期可能是民國年格式（如115/04/11），請轉換為西元年（民國年+1911=西元年），例如：民國115年=西元2026年。今天是${new Date().toLocaleDateString("sv-SE")}，日期格式一律用YYYY-MM-DD。只回傳JSON。`);
}

export async function analyzeDepositSlip(imageBase64) {
  return callVision(imageBase64, `這是一張台灣的銀行存款單（活期性存款存款條/收據）。請辨識所有欄位，以 JSON 格式回傳：

{
  "bank_name": "銀行名稱",
  "bank_branch": "分行名稱",
  "account_number": "帳號",
  "depositor_name": "戶名或存款人",
  "roc_date": "民國年日期原文",
  "deposit_date": "西元日期 YYYY-MM-DD（民國年+1911）",
  "deposit_amount": 存款金額數字,
  "deposit_type": "存款類型"
}

金額只填數字，民國115年=西元2026年。只回傳JSON。`);
}

export async function analyzeUberEatsReceipt(imageBase64) {
  return callVision(imageBase64, `這是一張 UberEats 外送平台的對帳單或訂單明細。請辨識以下資訊，以 JSON 格式回傳：

{
  "total_amount": 總金額數字,
  "order_count": 訂單數量,
  "serial_numbers": ["流水號1", "流水號2", ...],
  "date": "日期 YYYY-MM-DD",
  "store_name": "商店名稱"
}

注意：
- serial_numbers 請列出所有能辨識到的訂單編號、流水號、Order ID
- 金額只填數字
- 如果看不到某項，填 null
- 只回傳JSON。`);
}

export async function analyzeVoucher(imageBase64, voucherType) {
  const typeLabel = voucherType === "meal" ? "餐券（50元/100元）" : "飲料券（130元/160元）";
  return callVision(imageBase64, `這是一張或多張${typeLabel}的照片。請辨識以下資訊，以 JSON 格式回傳：

{
  "voucher_count": 券的數量,
  "total_amount": 總面額數字,
  "serial_numbers": ["券上的流水號或編號1", "流水號2", ...],
  "denominations": [每張券的面額, ...]
}

注意：
- serial_numbers 非常重要，請仔細辨識每張券上的編號、序號、流水號
- 如果券上有任何數字編碼，都請列入 serial_numbers
- 金額只填數字
- 只回傳JSON。`);
}

export async function analyzeLineCreditReceipt(imageBase64) {
  return callVision(imageBase64, `這是一張 LINE 儲值金的消費紀錄或單據。請辨識以下資訊，以 JSON 格式回傳：

{
  "total_amount": 總金額數字,
  "transaction_count": 交易筆數,
  "serial_numbers": ["交易編號1", "交易編號2", ...],
  "date": "日期 YYYY-MM-DD"
}

金額只填數字，只回傳JSON。`);
}

export async function analyzeExpenseReceipt(imageBase64) {
  return callVision(imageBase64, `這是一張費用單據（可能是廠商送貨單、發票、收據、零用金支出收據、房租、水電費、保險費等）。請辨識以下資訊，以 JSON 格式回傳：

{
  "vendor_name": "廠商/商店名稱",
  "date": "日期 YYYY-MM-DD",
  "total_amount": 總金額數字,
  "items": [{"name":"品項名稱","amount":金額,"qty":數量}],
  "receipt_type": "invoice/delivery_note/receipt/contract/other",
  "invoice_number": "發票號碼如AB-12345678或單據編號，無則填null",
  "category_suggestion": "食材原料/包材耗材/飲料原料/清潔用品/設備維修/文具雜物/交通費/臨時採購/租金/水電費/瓦斯費/電信費/保險費/稅務/廣告行銷/員工餐費/其他",
  "is_prepaid": false,
  "prepaid_months": 1,
  "prepaid_start": "YYYY-MM",
  "description": "簡短說明"
}

重點：發票號碼格式通常為英文2碼+8位數字，送貨單也有單據編號。預付費用設is_prepaid=true。金額只填數字。只回傳JSON。`);
}

export async function analyzePosSales(imageBase64) {
  return callVision(imageBase64, `這是一張 POS 系統（可能是 iCHEF 或其他 POS）的品項銷售統計報表截圖。請辨識每個品項的名稱和銷售數量。

以 JSON 格式回傳：
{
  "date": "日期 YYYY-MM-DD（如果看得到）",
  "store_name": "門市名稱（如果看得到）",
  "items": [
    {"name": "品項名稱", "qty": 銷售數量, "amount": 銷售金額}
  ],
  "total_qty": 總銷售數量,
  "total_amount": 總銷售金額
}

重點：
- 品項名稱要完整辨識（如「椰糖拿鐵」「原味泡芙」）
- qty 是銷售數量（杯/個/份），不是金額
- 如果有分類（如飲品/餐點/甜點），也請保留
- 只回傳 JSON，不要其他文字`);
}

export async function parsePosCsv(csvContent) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 4096,
    messages: [{ role: "user", content: `以下是 POS 系統匯出的銷售明細 CSV。請解析並以 JSON 回傳每個品項的銷售數量：

${csvContent.slice(0, 8000)}

回傳格式：
{
  "date": "YYYY-MM-DD",
  "items": [{"name": "品項名稱", "qty": 數量, "amount": 金額}]
}

只回傳 JSON。` }]
  });
  try { return JSON.parse(response.content[0].text.replace(/```json?|```/g, "").trim()); } catch { return null; }
}
