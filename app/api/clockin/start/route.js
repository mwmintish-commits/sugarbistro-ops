import crypto from "crypto";
import { supabase } from "@/lib/supabase";

// 面板直接產生打卡 token（不經 LINE），回傳 token 供 /clockin 頁面使用
export async function POST(request) {
  const { employee_id, type } = await request.json();
  if (!employee_id || !type) return Response.json({ error: "缺少參數" }, { status: 400 });

  const { data: emp } = await supabase.from("employees").select("id, is_active").eq("id", employee_id).single();
  if (!emp || !emp.is_active) return Response.json({ error: "員工不存在或未啟用" }, { status: 404 });

  const token = crypto.randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 分鐘有效

  const { error } = await supabase.from("clockin_tokens").insert({
    token, employee_id, type, expires_at: expires.toISOString(), used: false,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const SITE = process.env.SITE_URL || "https://sugarbistro-ops.zeabur.app";
  return Response.json({ token, url: `${SITE}/clockin?token=${token}` });
}
