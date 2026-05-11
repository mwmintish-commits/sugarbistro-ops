// 付款方式 → daily_settlements 欄位 自動對應路由
// ─────────────────────────────────────────
// 用途：
// 1. lib/ichef-pull.js 拉資料時，會員系統 API 給的 customPayments 陣列
//    用這個 router 自動分散到對應欄位（匯款→remittance_amount 等）
// 2. 後台「拆分」modal 儲存時也用同樣 router，確保使用者手動拆出來的
//    匯款也能自動歸到匯款欄
//
// 依四間門市實際使用的結帳方式整理：
// 屏東/永康：現金、TWQR、UberEats、匯款、餐券、LINEPAY
// SKM OUTLET：現金、信用卡、UberEats、餐券、LINEPAY、SKMPAY、悠遊卡一卡通、百貨點數、應付帳款
// 新光左營：現金、信用卡、UberEats、餐券、LINEPAY、SKMPAY、悠遊卡一卡通、百貨點數

// 標準欄位對應表（小寫、去空白/底線後比對）
const STANDARD_MAP = {
  // 現金
  "現金": "cash_amount",
  "cash": "cash_amount",
  // 信用卡
  "信用卡": "credit_card_amount",
  "creditcard": "credit_card_amount",
  "credit card": "credit_card_amount",
  "刷卡": "credit_card_amount",
  // LINE Pay
  "linepay": "line_pay_amount",
  "line pay": "line_pay_amount",
  "line_pay": "line_pay_amount",
  // TWQR
  "twqr": "twqr_amount",
  "tw qr": "twqr_amount",
  "台灣qr": "twqr_amount",
  "台灣 qr": "twqr_amount",
  "qr code": "twqr_amount",
  // Uber Eats
  "ubereats": "uber_eat_amount",
  "uber eats": "uber_eat_amount",
  "uber eat": "uber_eat_amount",
  "uber": "uber_eat_amount",
  // 悠遊卡 / 一卡通
  "悠遊卡": "easy_card_amount",
  "一卡通": "easy_card_amount",
  "悠遊卡一卡通": "easy_card_amount",
  "悠遊卡/一卡通": "easy_card_amount",
  "easycard": "easy_card_amount",
  "easy card": "easy_card_amount",
  // 餐券
  "餐券": "meal_voucher_amount",
  "餐卷": "meal_voucher_amount",
  "振興券": "meal_voucher_amount",
  "voucher": "meal_voucher_amount",
  // 匯款
  "匯款": "remittance_amount",
  "轉帳": "remittance_amount",
  "銀行匯款": "remittance_amount",
  "bank transfer": "remittance_amount",
};
// 不在 STANDARD_MAP 的方式（SKMPAY、百貨點數、應付帳款...）會保留在 custom_payments JSONB

export function routePaymentMethod(name) {
  if (!name) return null;
  const norm = String(name).trim().toLowerCase().replace(/[\s_/-]+/g, " ").trim();
  if (STANDARD_MAP[norm]) return STANDARD_MAP[norm];
  // 也試一下沒小寫沒正規化的原文（中文 key）
  const raw = String(name).trim();
  if (STANDARD_MAP[raw]) return STANDARD_MAP[raw];
  // 再試一下去空白
  const noSpace = raw.replace(/\s+/g, "");
  if (STANDARD_MAP[noSpace]) return STANDARD_MAP[noSpace];
  return null;
}

// 把一個 customPayments 陣列拆成「該加到標準欄位的金額」與「剩下的自定義」
// 回傳：{ standardExtras: { remittance_amount: 5000, ... }, customEntries: [{method, amount}, ...] }
export function routeCustomPayments(customPayments) {
  const standardExtras = {};
  const customEntries = [];
  for (const cp of (customPayments || [])) {
    if (!cp || !cp.method) continue;
    const amt = Number(cp.amount || 0);
    if (!amt) continue;
    const target = routePaymentMethod(cp.method);
    if (target) {
      standardExtras[target] = (standardExtras[target] || 0) + amt;
    } else {
      customEntries.push({ method: String(cp.method).trim(), amount: amt });
    }
  }
  return { standardExtras, customEntries };
}
