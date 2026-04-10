import { supabase } from "@/lib/supabase";

// 產生 6 位數綁定碼
function generateBindCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// GET: 查詢員工列表
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const store_id = searchParams.get("store_id");
  const role = searchParams.get("role");

  let query = supabase
    .from("employees")
    .select("*, stores(name)")
    .order("created_at", { ascending: false });

  if (store_id) query = query.eq("store_id", store_id);
  if (role) query = query.eq("role", role);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

// POST: 新增員工 或 產生綁定碼
export async function POST(request) {
  const body = await request.json();
  const { action } = body;

  // 產生綁定碼
  if (action === "generate_bind_code") {
    const { employee_id } = body;
    const bindCode = generateBindCode();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24小時

    const { data, error } = await supabase
      .from("employees")
      .update({ bind_code: bindCode, bind_code_expires: expires })
      .eq("id", employee_id)
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data, bind_code: bindCode });
  }

  // 新增員工
  if (action === "create") {
    const { name, store_id, role, phone } = body;
    const bindCode = generateBindCode();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7天

    const { data, error } = await supabase
      .from("employees")
      .insert({
        name,
        store_id: store_id || null,
        role: role || "staff",
        phone: phone || null,
        bind_code: bindCode,
        bind_code_expires: expires,
        managed_store_id: role === "manager" ? store_id : null,
      })
      .select("*, stores(name)")
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data, bind_code: bindCode });
  }

  // 更新員工
  if (action === "update") {
    const { employee_id, name, store_id, role, phone, is_active } = body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (store_id !== undefined) updates.store_id = store_id;
    if (role !== undefined) updates.role = role;
    if (phone !== undefined) updates.phone = phone;
    if (is_active !== undefined) updates.is_active = is_active;
    if (role === "manager") updates.managed_store_id = store_id;

    const { data, error } = await supabase
      .from("employees")
      .update(updates)
      .eq("id", employee_id)
      .select("*, stores(name)")
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
