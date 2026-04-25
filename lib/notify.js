// 分層通知 helper：依事件所屬門市，回傳該推送的 line_uid 清單
//
// 規則：
// - 該店店長 (role=store_manager AND store_id=event_store)
// - 全體區經理 (role=manager)，視為次線稽核
// - admin（總部）預設不收常規通知；可用 includeAdmin=true 強制納入
//
// 用法：
//   import { getStoreManagers } from "@/lib/notify";
//   const recipients = await getStoreManagers(supabase, store_id);
//   for (const r of recipients) await pushText(r.line_uid, msg);

import { supabase as defaultSb } from "@/lib/supabase";

/**
 * 回傳「該店店長 + 區經理」的 employees 列（含 line_uid）
 * @param {object} sb - Supabase client (optional, 預設用 lib/supabase)
 * @param {string|null} store_id - 事件所屬門市；若為 null/undefined 只回區經理
 * @param {object} opts - { includeAdmin: boolean, includeStoreManager: boolean, includeAreaManager: boolean }
 */
export async function getStoreManagers(sb, store_id, opts = {}) {
  const { includeAdmin = false, includeStoreManager = true, includeAreaManager = true, fallbackToAdmin = true } = opts;
  const client = sb || defaultSb;
  const roles = ["store_manager", "manager"];
  // 若 caller 強制要 admin，先納入；否則先當 fallback 候補
  if (includeAdmin) roles.push("admin");

  const { data, error } = await client.from("employees")
    .select("id, name, line_uid, role, store_id")
    .in("role", roles.concat(fallbackToAdmin && !includeAdmin ? ["admin"] : []))
    .eq("is_active", true);
  if (error || !data) return [];

  const primary = data.filter(e => {
    if (!e.line_uid) return false;
    if (e.role === "store_manager") return includeStoreManager && store_id && e.store_id === store_id;
    if (e.role === "manager") return includeAreaManager;
    if (e.role === "admin") return includeAdmin;
    return false;
  });

  if (primary.length > 0) return primary;

  // Fallback：店長+區經理都沒設定 → 通知 admin（避免訊息消失）
  if (fallbackToAdmin) {
    return data.filter(e => e.role === "admin" && e.line_uid);
  }
  return [];
}

/**
 * 推送純文字訊息給多位收件人，靜默失敗（不阻擋主流程）
 */
export async function pushToManagers(sb, store_id, text, opts = {}) {
  const recipients = await getStoreManagers(sb, store_id, opts);
  if (recipients.length === 0) return { sent: 0 };
  const { pushText } = await import("@/lib/line");
  let sent = 0;
  for (const r of recipients) {
    try { await pushText(r.line_uid, text); sent++; } catch {}
  }
  return { sent, recipients: recipients.map(r => r.name) };
}
