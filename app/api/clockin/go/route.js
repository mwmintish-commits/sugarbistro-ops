import crypto from "crypto";
import { supabase } from "@/lib/supabase";

// 永久打卡入口：LINE Bot 卡片按鈕指向這裡，點擊當下才產生新 token 再 302 到 /clockin
// 解決「聊天室舊卡片的一次性 token 已過期/已使用」導致打卡常失效的問題
export async function GET(request) {
  const u = new URL(request.url);
  const eid = u.searchParams.get("eid");
  const type = u.searchParams.get("type");
  const SITE = process.env.SITE_URL || "https://sugarbistro-ops.zeabur.app";

  if (!eid || !["clock_in", "clock_out"].includes(type)) {
    return Response.redirect(`${SITE}/clockin`, 302); // 頁面會顯示「缺少打卡 Token」
  }

  const { data: emp } = await supabase.from("employees")
    .select("id, is_active, store_id").eq("id", eid).maybeSingle();
  if (!emp || !emp.is_active) return Response.redirect(`${SITE}/clockin`, 302);

  const token = crypto.randomBytes(16).toString("hex");
  const { error } = await supabase.from("clockin_tokens").insert({
    token, employee_id: eid, type, store_id: emp.store_id || null,
    expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(), used: false,
  });
  if (error) return Response.redirect(`${SITE}/clockin`, 302);

  return Response.redirect(`${SITE}/clockin?token=${token}`, 302);
}
