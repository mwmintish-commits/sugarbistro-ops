const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_VISION_KEY = process.env.GOOGLE_VISION_API_KEY;

// ===== Google Vision OCR =====
async function googleOCR(imageBase64) {
  if (!GOOGLE_VISION_KEY) return null;
  try {
    const res = await fetch("https://vision.googleapis.com/v1/images:annotate?key=" + GOOGLE_VISION_KEY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{ image: { content: imageBase64 }, features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }] }]
      }),
    });
    const data = await res.json();
    return data.responses?.[0]?.fullTextAnnotation?.text || data.responses?.[0]?.textAnnotations?.[0]?.description || null;
  } catch (e) { console.error("Google OCR fail:", e.message); return null; }
}

// ===== Claude 純文字解析（不含圖片，超便宜） =====
async function callText(prompt, fast) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: fast ? "claude-haiku-4-5-20251001" : "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    if (data.error) { console.error("AI text error:", data.error); return null; }
    const text = data.content?.[0]?.text || "";
    try { return JSON.parse(text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()); }
    catch { console.error("AI parse fail:", text?.slice(0, 200)); return null; }
  } catch (e) { console.error("AI text call fail:", e.message); return null; }
}

// ===== Claude 圖片辨識（fallback，較貴） =====
async function callVision(imageBase64, prompt, fast) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), fast ? 15000 : 25000);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: fast ? "claude-haiku-4-5-20251001" : "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
          { type: "text", text: prompt },
        ]}],
      }),
    });
    clearTimeout(timeout);
    const data = await response.json();
    if (data.error) { console.error("AI vision error:", data.error); return null; }
    const text = data.content?.[0]?.text || "";
    try { return JSON.parse(text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()); }
    catch { console.error("AI vision parse fail:", text?.slice(0, 200)); return null; }
  } catch (e) { clearTimeout(timeout); console.error("AI vision fail:", e.message); return null; }
}

// ===== 混合辨識：先 OCR 再文字解析，fallback 圖片辨識 =====
async function hybridRecognize(imageBase64, textPrompt, visionPrompt, fast) {
  // Step 1: Google Vision OCR
  const ocrText = await googleOCR(imageBase64);
  if (ocrText && ocrText.length > 10) {
    // Step 2: Claude 解析 OCR 文字（超快超便宜）
    const result = await callText(textPrompt.replace("{OCR_TEXT}", ocrText), true);
    if (result) return result;
  }
  // Fallback: Claude 直接看圖
  return callVision(imageBase64, visionPrompt, fast);
}

// ===== 日結單辨識（用 Sonnet 看圖，需要精確數字） =====
export async function analyzeDailySettlement(imageBase64) {
  const textPrompt = `以下是 POS 日結單的 OCR 文字。請從中擷取所有金額數字，以 JSON 格式回傳：

{OCR_TEXT}

回傳格式：
{
  "date": "YYYY-MM-DD",
  "cashier_name": "收銀員",
  "net_sales": 淨銷售額,
  "discount_total": 折扣總額,
  "cash_amount": 現金,
  "line_pay_amount": LINE Pay,
  "twqr_amount": 台灣Pay/街口/悠遊付等,
  "uber_eat_amount": UberEats,
  "easy_card_amount": 悠遊卡,
  "remittance_amount": 匯款,
  "meal_voucher_amount": 餐券,
  "line_credit_amount": LINE儲值金,
  "drink_voucher_amount": 飲料券,
  "invoice_count": 發票張數,
  "invoice_start": "起始號碼",
  "invoice_end": "結束號碼",
  "void_invoice_count": 作廢發票張數,
  "void_invoice_amount": 作廢金額,
  "void_invoice_numbers": "作廢號碼",
  "void_item_count": 銷貨退回筆數,
  "void_item_amount": 銷貨退回金額,
  "cash_in_register": 實收現金,
  "petty_cash_reserved": 零用金保留
}
民國115年=西元2026年。金額只填數字，找不到的填0。只回傳JSON。`;

  const visionPrompt = `這是一張「小食糖 SUGARbISTRO」POS 系統印出的日結單（關帳紀錄）。請仔細辨識所有數字，以 JSON 格式回傳，不要加任何其他文字：

{
  "date": "YYYY-MM-DD",
  "cashier_name": "收銀員姓名",
  "net_sales": 淨銷售額,
  "discount_total": 折扣總額,
  "cash_amount": 現金收入,
  "line_pay_amount": LINE Pay金額,
  "twqr_amount": 台灣Pay/街口/悠遊付,
  "uber_eat_amount": UberEats金額,
  "easy_card_amount": 悠遊卡金額,
  "remittance_amount": 匯款金額,
  "meal_voucher_amount": 餐券金額,
  "line_credit_amount": LINE儲值金,
  "drink_voucher_amount": 飲料券金額,
  "invoice_count": 發票張數,
  "invoice_start": "起始號碼",
  "invoice_end": "結束號碼",
  "void_invoice_count": 作廢張數,
  "void_invoice_amount": 作廢金額,
  "void_invoice_numbers": "作廢號碼",
  "void_item_count": 銷退筆數,
  "void_item_amount": 銷退金額,
  "cash_in_register": 實收現金,
  "petty_cash_reserved": 零用金
}

重要：POS單上的日期可能是民國年格式（如115/04/11），請轉換為西元年（民國年+1911=西元年），例如：民國115年=西元2026年。今天是${new Date().toLocaleDateString("sv-SE")}，日期格式一律用YYYY-MM-DD。只回傳JSON。`;

  return hybridRecognize(imageBase64, textPrompt, visionPrompt, false);
}

// ===== 存款單辨識 =====
export async function analyzeDepositSlip(imageBase64) {
  const textPrompt = `以下是銀行存款單的 OCR 文字。請擷取存款資訊，以 JSON 回傳：

{OCR_TEXT}

{
  "bank_name": "銀行名稱",
  "deposit_date": "YYYY-MM-DD",
  "amount": 存款金額數字,
  "account_last4": "帳號後4碼",
  "branch_name": "分行名稱"
}
民國115年=西元2026年。金額只填數字。只回傳JSON。`;

  const visionPrompt = `這是一張台灣的銀行存款單（活期性存款存款條/收據）。請辨識所有欄位，以 JSON 格式回傳：
{
  "bank_name": "銀行名稱",
  "deposit_date": "存款日期 YYYY-MM-DD",
  "amount": 存款金額數字,
  "account_last4": "帳號後4碼",
  "branch_name": "分行名稱"
}
金額只填數字，民國115年=西元2026年。只回傳JSON。`;

  return hybridRecognize(imageBase64, textPrompt, visionPrompt, true);
}

// ===== UberEats 對帳單 =====
export async function analyzeUberEatsReceipt(imageBase64) {
  const visionPrompt = `這是一張 UberEats 外送平台的對帳單或訂單明細。請辨識以下資訊，以 JSON 格式回傳：
{ "period": "對帳區間", "total_sales": 總銷售金額, "uber_fee": UberEats抽成, "net_amount": 實收金額, "order_count": 訂單數 }
金額只填數字。只回傳JSON。`;
  return callVision(imageBase64, visionPrompt, true);
}

// ===== 餐券辨識 =====
export async function analyzeVoucher(imageBase64, voucherType) {
  const typeLabel = voucherType === "meal_voucher" ? "餐券" : "飲料券";
  const visionPrompt = `這是一張或多張${typeLabel}的照片。請辨識以下資訊，以 JSON 格式回傳：
{ "serial_numbers": ["序號1","序號2"], "face_value": 面額數字, "count": 張數, "total_value": 總金額 }
- 只回傳JSON。`;
  return callVision(imageBase64, visionPrompt, true);
}

// ===== LINE 儲值金 =====
export async function analyzeLineCreditReceipt(imageBase64) {
  const visionPrompt = `這是一張 LINE 儲值金的消費紀錄或單據。請辨識以下資訊，以 JSON 格式回傳：
{ "amount": 金額數字, "date": "YYYY-MM-DD", "transaction_id": "交易編號或null" }
金額只填數字，只回傳JSON。`;
  return callVision(imageBase64, visionPrompt, true);
}

// ===== 費用單據辨識（Google OCR + Haiku 解析） =====
export async function analyzeExpenseReceipt(imageBase64) {
  const textPrompt = `以下是台灣餐飲業費用單據的 OCR 文字內容。請從中擷取費用資訊：

{OCR_TEXT}

以 JSON 回傳：
{
  "vendor_name": "廠商名稱",
  "date": "YYYY-MM-DD",
  "total_amount": 總金額數字（找「合計」「總計」「應付」旁的數字）,
  "items": [{"name":"品項","amount":金額,"qty":數量}],
  "receipt_type": "invoice/electronic_invoice/delivery_note/receipt/other",
  "invoice_number": "發票號碼（英文2碼+8位數字如YX-26013438）或null",
  "category_suggestion": "食材原料/包材耗材/飲料原料/清潔用品/設備維修/租金/水電費/瓦斯費/電信費/廣告行銷/印刷費/其他",
  "is_prepaid": false,
  "prepaid_months": 1,
  "description": "簡短說明"
}
民國115年=西元2026年。金額只填數字。品項最多5項。只回傳JSON。`;

  const visionPrompt = `這是一張台灣餐飲業的費用單據（發票/送貨單/收據）。請辨識：
{
  "vendor_name": "廠商名稱",
  "date": "YYYY-MM-DD",
  "total_amount": 總金額數字,
  "items": [{"name":"品項","amount":金額,"qty":數量}],
  "receipt_type": "invoice/electronic_invoice/delivery_note/receipt/other",
  "invoice_number": "發票號碼或null",
  "category_suggestion": "食材原料/包材耗材/飲料原料/清潔用品/設備維修/租金/水電費/瓦斯費/電信費/廣告行銷/印刷費/其他",
  "is_prepaid": false,
  "prepaid_months": 1,
  "description": "簡短說明"
}
民國115年=西元2026年。金額只填數字。只回傳JSON。`;

  return hybridRecognize(imageBase64, textPrompt, visionPrompt, true);
}

// ===== POS 銷售辨識 =====
export async function analyzePosSales(imageBase64) {
  const textPrompt = `以下是 POS 系統品項銷售統計報表的 OCR 文字。請擷取每個品項名稱和銷售數量：

{OCR_TEXT}

以 JSON 回傳：
{
  "date": "YYYY-MM-DD",
  "items": [{"name": "品項名稱", "qty": 銷售數量, "amount": 銷售金額}],
  "total_qty": 總數量,
  "total_amount": 總金額
}
只回傳JSON。`;

  const visionPrompt = `這是一張 POS 系統的品項銷售統計報表截圖。請辨識每個品項名稱和銷售數量：
{
  "date": "YYYY-MM-DD",
  "items": [{"name": "品項名稱", "qty": 銷售數量, "amount": 銷售金額}],
  "total_qty": 總數量,
  "total_amount": 總金額
}
只回傳JSON。`;

  return hybridRecognize(imageBase64, textPrompt, visionPrompt, true);
}

// ===== CSV 解析 =====
export async function parsePosCsv(csvContent) {
  return callText(`以下是 POS 系統匯出的銷售明細 CSV：

${csvContent.slice(0, 8000)}

以 JSON 回傳：
{ "date": "YYYY-MM-DD", "items": [{"name": "品項名稱", "qty": 數量, "amount": 金額}] }
只回傳JSON。`, true);
}
