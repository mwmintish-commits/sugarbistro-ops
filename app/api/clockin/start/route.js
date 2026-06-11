import crypto from "crypto";
import { supabase } from "@/lib/supabase";

// 面板直接產生打卡 token（不經 LINE），回傳 token 供 /clockin 頁面使用
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "請求格式錯誤" }, { status: 400 }); }
  const { employee_id, type } = body || {};
  if (!employee_id || !type) return Response.json({ error: "缺少參數" }, { status: 400 });
  if (!["clock_in", "clock_out"].includes(type)) return Response.json({ error: "type 必須是 clock_in 或 clock_out" }, { status: 400 });

  const { data: emp, error: empErr } = await supabase.from("employees").select("id, is_active, store_id").eq("id", employee_id).maybeSingle();
  if (empErr) return Response.json({ error: "查員工失敗：" + empErr.message }, { status: 500 });
  if (!emp) return Response.json({ error: "員工不存在" }, { status: 404 });
  if (!emp.is_active) return Response.json({ error: "員工尚未啟用，請聯繫主管" }, { status: 403 });

  const token = crypto.randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 20 * 60 * 1000); // 20 分鐘有效（GPS 慢/被打斷的緩衝）

  const { error } = await supabase.from("clockin_tokens").insert({
    token, employee_id, type, store_id: emp.store_id || null,
    expires_at: expires.toISOString(), used: false,
  });
  if (error) return Response.json({ error: "建立打卡連結失敗：" + error.message }, { status: 500 });

  const SITE = process.env.SITE_URL || "https://sugarbistro-ops.zeabur.app";
  return Response.json({ token, url: `${SITE}/clockin?token=${token}` });
}
