import crypto from "crypto";
import { supabase, auditLog } from "@/lib/supabase";
import { pushText } from "@/lib/line";

const ALLOWED_ROLES = ["admin", "manager", "store_manager"];

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

  // ✦33 更新最後活動時間
  await supabase.from("admin_sessions").update({
    last_active_at: new Date().toISOString()
  }).eq("token", token);

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
    await pushText(emp.line_uid, `🔐 後台登入驗證碼\n\n${code}\n\n5 分鐘內有效。`).catch(() => {});

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

    await supabase.from("verify_codes").update({ used: true }).eq("phone", phone).eq("code", code);

    const { data: emp } = await supabase.from("employees")
      .select("id, name, role, store_id, stores(name)")
      .eq("phone", phone).eq("is_active", true).single();
    if (!emp) return Response.json({ error: "帳號錯誤" }, { status: 404 });

    // ✦33 清除舊 Session（同帳號僅1個）+ 重置失敗計數
    await supabase.from("admin_sessions").delete().eq("employee_id", emp.id);
    await supabase.from("employees").update({
      login_fail_count: 0, locked_until: null, last_login_at: new Date().toISOString()
    }).eq("id", emp.id);

    const token = crypto.randomBytes(32).toString("hex");
    await supabase.from("admin_sessions").insert({
      token, employee_id: emp.id, role: emp.role,
      store_id: emp.store_id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      last_active_at: new Date().toISOString(),
    });

    await auditLog(emp.id, emp.name, "login", "session", null, { phone });

    return Response.json({
      success: true, token, employee_id: emp.id,
      name: emp.name, role: emp.role,
      store_id: emp.store_id, store_name: emp.stores?.name,
    });
  }

  if (body.action === "logout") {
    const token = body.token;
    if (token) await supabase.from("admin_sessions").delete().eq("token", token);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
