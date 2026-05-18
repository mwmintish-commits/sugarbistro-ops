import crypto from "crypto";
import { supabase, auditLog } from "@/lib/supabase";
import { pushText } from "@/lib/line";
import { verifyPassword, hashPassword } from "@/lib/password";

const ALLOWED_ROLES = ["admin", "manager", "store_manager"];

export async function GET(request) {
  const token = request.headers.get("x-admin-token");
  if (!token) return Response.json({ error: "No token" }, { status: 401 });

  const { data: session } = await supabase.from("admin_sessions")
    .select("*, employees(name, role, store_id, stores!store_id(name))")
    .eq("token", token).single();

  if (!session) return Response.json({ error: "Invalid session" }, { status: 401 });
  if (new Date(session.expires_at) < new Date()) {
    await supabase.from("admin_sessions").delete().eq("token", token);
    return Response.json({ error: "Session expired" }, { status: 401 });
  }

  // ✦33 更新最後活動時間（fire-and-forget，不阻塞回應）
  supabase.from("admin_sessions").update({
    last_active_at: new Date().toISOString()
  }).eq("token", token).then(() => {}, () => {});

  return Response.json({
    authenticated: true,
    employee_id: session.employee_id,
    name: session.employees?.name,
    role: session.role,
    store_id: session.store_id,
    store_name: session.employees?.stores?.name,
  });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "send_code") {
    const { phone } = body;
    if (!phone) return Response.json({ error: "請輸入手機號碼" }, { status: 400 });

    const { data: emp } = await supabase.from("employees")
      .select("id, name, role, line_uid, phone, store_id, login_fail_count, locked_until")
      .eq("phone", phone).eq("is_active", true).single();

    if (!emp) return Response.json({ error: "找不到此手機號碼的員工" }, { status: 404 });
    if (!ALLOWED_ROLES.includes(emp.role)) return Response.json({ error: "此帳號無後台權限" }, { status: 403 });
    if (!emp.line_uid) return Response.json({ error: "此帳號尚未綁定 LINE" }, { status: 400 });

    // ✦33 鎖定檢查
    if (emp.locked_until && new Date(emp.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(emp.locked_until) - new Date()) / 60000);
      return Response.json({ error: "帳號已鎖定，請 " + mins + " 分鐘後再試" }, { status: 429 });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 5 * 60 * 1000);
    await supabase.from("verify_codes").insert({ phone, code, expires_at: expires.toISOString() });
    try {
      await pushText(emp.line_uid, `🔐 後台登入驗證碼\n\n${code}\n\n5 分鐘內有效。`);
    } catch (e) {
      console.error("LINE push verify code failed:", e);
      return Response.json({
        error: "LINE 推送失敗：" + (e?.message || "未知錯誤") + "\n\n可能原因：員工封鎖了官方帳號、line_uid 已失效，或 LINE 通道暫時故障。",
      }, { status: 500 });
    }

    return Response.json({ success: true, message: "驗證碼已發送至 LINE" });
  }

  if (body.action === "verify") {
    const { phone, code } = body;
    if (!phone || !code) return Response.json({ error: "請輸入手機號碼和驗證碼" }, { status: 400 });

    const { data: vc } = await supabase.from("verify_codes")
      .select("*").eq("phone", phone).eq("code", code).eq("used", false)
      .order("created_at", { ascending: false }).limit(1).single();

    if (!vc || new Date(vc.expires_at) < new Date()) {
      // ✦33 失敗計數
      const { data: emp } = await supabase.from("employees")
        .select("id, login_fail_count").eq("phone", phone).single();
      if (emp) {
        const fails = (emp.login_fail_count || 0) + 1;
        const updates = { login_fail_count: fails };
        if (fails >= 5) updates.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await supabase.from("employees").update(updates).eq("id", emp.id);
      }
      return Response.json({ error: !vc ? "驗證碼錯誤" : "驗證碼已過期" }, { status: 400 });
    }

    // 並行：標記驗證碼用過 + 查員工資料
    const [, empRes] = await Promise.all([
      supabase.from("verify_codes").update({ used: true }).eq("phone", phone).eq("code", code),
      supabase.from("employees")
        .select("id, name, role, store_id, stores!store_id(name)")
        .eq("phone", phone).eq("is_active", true).single(),
    ]);
    const emp = empRes.data;
    if (!emp) return Response.json({ error: "帳號錯誤" }, { status: 404 });

    // 並行：清除舊 Session、重置失敗計數、建新 Session
    const token = crypto.randomBytes(32).toString("hex");
    await Promise.all([
      supabase.from("admin_sessions").delete().eq("employee_id", emp.id),
      supabase.from("employees").update({
        login_fail_count: 0, locked_until: null, last_login_at: new Date().toISOString()
      }).eq("id", emp.id),
    ]);
    await supabase.from("admin_sessions").insert({
      token, employee_id: emp.id, role: emp.role,
      store_id: emp.store_id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      last_active_at: new Date().toISOString(),
    });

    // auditLog fire-and-forget
    auditLog(emp.id, emp.name, "login", "session", null, { phone }).catch(() => {});

    return Response.json({
      success: true, token, employee_id: emp.id,
      name: emp.name, role: emp.role,
      store_id: emp.store_id, store_name: emp.stores?.name,
    });
  }

  // 新版：手機 + 密碼 登入（不需 LINE 推送驗證碼）
  if (body.action === "login_password") {
    const { phone, password } = body;
    if (!phone || !password) return Response.json({ error: "請輸入手機號碼與密碼" }, { status: 400 });

    const { data: emp } = await supabase.from("employees")
      .select("id, name, role, phone, store_id, password_hash, login_fail_count, locked_until, is_active, stores!store_id(name)")
      .eq("phone", phone).eq("is_active", true).single();

    if (!emp) return Response.json({ error: "找不到此手機號碼的員工" }, { status: 404 });
    if (!ALLOWED_ROLES.includes(emp.role)) return Response.json({ error: "此帳號無後台權限" }, { status: 403 });
    if (emp.locked_until && new Date(emp.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(emp.locked_until) - new Date()) / 60000);
      return Response.json({ error: "帳號已鎖定，請 " + mins + " 分鐘後再試" }, { status: 429 });
    }
    if (!emp.password_hash) return Response.json({ error: "此帳號尚未設定密碼，請聯繫管理員" }, { status: 400 });

    if (!verifyPassword(password, emp.password_hash)) {
      const fails = (emp.login_fail_count || 0) + 1;
      const updates = { login_fail_count: fails };
      if (fails >= 5) updates.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await supabase.from("employees").update(updates).eq("id", emp.id);
      return Response.json({ error: "密碼錯誤" + (fails >= 3 ? `（已嘗試 ${fails} 次，第 5 次將鎖定 15 分鐘）` : "") }, { status: 400 });
    }

    // 成功：清舊 session、重置失敗計數、建新 session
    const token = crypto.randomBytes(32).toString("hex");
    await Promise.all([
      supabase.from("admin_sessions").delete().eq("employee_id", emp.id),
      supabase.from("employees").update({
        login_fail_count: 0, locked_until: null, last_login_at: new Date().toISOString()
      }).eq("id", emp.id),
    ]);
    await supabase.from("admin_sessions").insert({
      token, employee_id: emp.id, role: emp.role, store_id: emp.store_id,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 天
      last_active_at: new Date().toISOString(),
    });
    auditLog(emp.id, emp.name, "login", "session", null, { phone, method: "password" }).catch(() => {});

    return Response.json({
      success: true, token, employee_id: emp.id,
      name: emp.name, role: emp.role,
      store_id: emp.store_id, store_name: emp.stores?.name,
    });
  }

  // 修改密碼（管理員幫員工改 / 員工自己改）
  if (body.action === "set_password") {
    const { employee_id, new_password, admin_token } = body;
    if (!employee_id || !new_password) return Response.json({ error: "缺少參數" }, { status: 400 });
    if (new_password.length < 4) return Response.json({ error: "密碼至少 4 個字元" }, { status: 400 });

    // 權限：必須有 admin_token 且該 session 是 admin 或 manager
    if (!admin_token) return Response.json({ error: "未授權" }, { status: 401 });
    const { data: session } = await supabase.from("admin_sessions")
      .select("role, employee_id").eq("token", admin_token).single();
    if (!session) return Response.json({ error: "Session 無效" }, { status: 401 });
    if (!["admin", "manager"].includes(session.role) && session.employee_id !== employee_id) {
      return Response.json({ error: "只能改自己的密碼或由管理員代改" }, { status: 403 });
    }

    const hash = hashPassword(new_password);
    const { error } = await supabase.from("employees")
      .update({ password_hash: hash, login_fail_count: 0, locked_until: null })
      .eq("id", employee_id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    auditLog(session.employee_id, null, "set_password", "employees", employee_id, { by_admin: session.employee_id !== employee_id }).catch(() => {});
    return Response.json({ success: true });
  }

  if (body.action === "logout") {
    const token = body.token;
    if (token) await supabase.from("admin_sessions").delete().eq("token", token);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
