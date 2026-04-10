import crypto from "crypto";
import { supabase } from "@/lib/supabase";
import { pushText } from "@/lib/line";

const ALLOWED_ROLES = ["admin", "manager", "store_manager"];

// GET: 驗證 session
export async function GET(request) {
  const token = request.headers.get("x-admin-token");
  if (!token) return Response.json({ error: "No token" }, { status: 401 });

  const { data: session } = await supabase.from("admin_sessions")
    .select("*, employees(name, role, store_id, stores(name))")
    .eq("token", token).single();

  if (!session) return Response.json({ error: "Invalid session" }, { status: 401 });
  if (new Date(session.expires_at) < new Date()) {
    await supabase.from("admin_sessions").delete().eq("token", token);
    return Response.json({ error: "Session expired" }, { status: 401 });
  }

  return Response.json({
    authenticated: true,
    employee_id: session.employee_id,
    name: session.employees?.name,
    role: session.role,
    store_id: session.store_id,
    store_name: session.employees?.stores?.name,
  });
}

// POST: 發送驗證碼 / 驗證登入
export async function POST(request) {
  const body = await request.json();

  // 發送驗證碼
  if (body.action === "send_code") {
    const { phone } = body;
    if (!phone) return Response.json({ error: "請輸入手機號碼" }, { status: 400 });

    // 查找員工
    const { data: emp } = await supabase.from("employees")
      .select("id, name, role, line_uid, phone, store_id")
      .eq("phone", phone).eq("is_active", true).single();

    if (!emp) return Response.json({ error: "找不到此手機號碼的員工" }, { status: 404 });
    if (!ALLOWED_ROLES.includes(emp.role)) return Response.json({ error: "此帳號無後台權限" }, { status: 403 });
    if (!emp.line_uid) return Response.json({ error: "此帳號尚未綁定 LINE，請先綁定" }, { status: 400 });

    // 產生 6 位驗證碼
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 分鐘

    await supabase.from("verify_codes").insert({
      phone, code, expires_at: expires.toISOString(),
    });

    // 透過 LINE 發送驗證碼
    await pushText(emp.line_uid, `🔐 後台登入驗證碼\n\n${code}\n\n此驗證碼 5 分鐘內有效。\n如非本人操作請忽略。`).catch(() => {});

    return Response.json({ success: true, message: "驗證碼已發送至你的 LINE" });
  }

  // 驗證登入
  if (body.action === "verify") {
    const { phone, code } = body;
    if (!phone || !code) return Response.json({ error: "請輸入手機號碼和驗證碼" }, { status: 400 });

    // 查驗證碼
    const { data: vc } = await supabase.from("verify_codes")
      .select("*").eq("phone", phone).eq("code", code).eq("used", false)
      .order("created_at", { ascending: false }).limit(1).single();

    if (!vc) return Response.json({ error: "驗證碼錯誤" }, { status: 400 });
    if (new Date(vc.expires_at) < new Date()) return Response.json({ error: "驗證碼已過期" }, { status: 400 });

    // 標記已使用
    await supabase.from("verify_codes").update({ used: true }).eq("phone", phone).eq("code", code);

    // 查員工
    const { data: emp } = await supabase.from("employees")
      .select("id, name, role, store_id, stores(name)")
      .eq("phone", phone).eq("is_active", true).single();

    if (!emp) return Response.json({ error: "帳號錯誤" }, { status: 404 });

    // 建立 session（7 天有效）
    const token = crypto.randomBytes(32).toString("hex");
    await supabase.from("admin_sessions").insert({
      token, employee_id: emp.id, role: emp.role,
      store_id: emp.store_id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    return Response.json({
      success: true, token,
      name: emp.name, role: emp.role,
      store_id: emp.store_id, store_name: emp.stores?.name,
    });
  }

  // 登出
  if (body.action === "logout") {
    const token = body.token;
    if (token) await supabase.from("admin_sessions").delete().eq("token", token);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
