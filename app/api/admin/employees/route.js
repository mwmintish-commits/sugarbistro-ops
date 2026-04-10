import { supabase } from "@/lib/supabase";
import { pushText } from "@/lib/line";

function generateBindCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

// 計算年資（月）
function calcServiceMonths(hireDate) {
  if (!hireDate) return 0;
  const hire = new Date(hireDate), now = new Date();
  return (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth());
}

// 計算特休天數
function calcAnnualLeave(serviceMonths, type) {
  const rules = type === "parttime" ? [
    [6,12,1.5],[12,24,3.5],[24,36,5],[36,60,7],[60,120,7.5],[120,9999,7.5]
  ] : [
    [6,12,3],[12,24,7],[24,36,10],[36,60,14],[60,120,15],[120,180,16],[180,240,17],[240,300,18],[300,360,19],[360,9999,20]
  ];
  for (const [min, max, days] of rules) {
    if (serviceMonths >= min && serviceMonths < max) return days;
  }
  return 0;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const store_id = searchParams.get("store_id");
  const include_inactive = searchParams.get("include_inactive");

  // 單一員工詳情
  if (id) {
    const { data: emp } = await supabase.from("employees").select("*, stores(name)").eq("id", id).single();
    if (!emp) return Response.json({ error: "Not found" }, { status: 404 });

    const months = calcServiceMonths(emp.hire_date);
    const annualLeave = calcAnnualLeave(months, emp.employment_type);

    // 取保險級距
    let insurance = null;
    if (emp.insurance_tier) {
      const { data } = await supabase.from("insurance_tiers").select("*").eq("tier_level", emp.insurance_tier).eq("employment_type", emp.employment_type).single();
      insurance = data;
    }

    // 取報到紀錄
    const { data: onboarding } = await supabase.from("onboarding_records").select("*").eq("auto_employee_id", id).single();

    // 取假別使用
    const year = new Date().getFullYear();
    const { data: leaveBalance } = await supabase.from("leave_balances").select("*").eq("employee_id", id).eq("year", year).single();

    return Response.json({
      data: emp,
      service_months: months,
      annual_leave_days: annualLeave,
      insurance,
      onboarding,
      leave_balance: leaveBalance,
    });
  }

  // 員工列表
  let query = supabase.from("employees").select("*, stores(name)").order("created_at", { ascending: false });
  if (store_id) query = query.eq("store_id", store_id);
  if (!include_inactive) query = query.or("is_active.eq.true,is_active.eq.false"); // show all for admin

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // 附加年資和特休
  const enriched = (data || []).map(emp => ({
    ...emp,
    service_months: calcServiceMonths(emp.hire_date),
    annual_leave_days: calcAnnualLeave(calcServiceMonths(emp.hire_date), emp.employment_type),
  }));

  return Response.json({ data: enriched });
}

export async function POST(request) {
  const body = await request.json();

  // 啟用帳號（總部核發權限）
  if (body.action === "activate") {
    const { employee_id } = body;
    const bindCode = generateBindCode();
    const { data, error } = await supabase.from("employees").update({
      is_active: true,
      bind_code: bindCode,
      bind_code_expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }).eq("id", employee_id).select("*, stores(name)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });

    // 如果已有 LINE UID，直接通知
    if (data.line_uid) {
      await pushText(data.line_uid, `✅ 你的帳號已啟用！\n\n👤 ${data.name}\n🏠 ${data.stores?.name || "總部"}\n\n輸入「選單」查看功能列表`).catch(() => {});
    }

    return Response.json({ data, bind_code: bindCode });
  }

  // 停用帳號
  if (body.action === "deactivate") {
    const { data, error } = await supabase.from("employees").update({ is_active: false }).eq("id", body.employee_id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  // 產生綁定碼
  if (body.action === "generate_bind_code") {
    const bindCode = generateBindCode();
    const { data, error } = await supabase.from("employees").update({
      bind_code: bindCode, bind_code_expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }).eq("id", body.employee_id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data, bind_code: bindCode });
  }

  // 新增員工
  if (body.action === "create") {
    const { name, store_id, role, phone, email, employment_type } = body;
    const bindCode = generateBindCode();
    const { data, error } = await supabase.from("employees").insert({
      name, store_id: store_id || null, role: role || "staff", phone, email,
      employment_type: employment_type || "regular",
      hire_date: new Date().toLocaleDateString("sv-SE"),
      bind_code: bindCode,
      bind_code_expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }).select("*, stores(name)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data, bind_code: bindCode });
  }

  // 更新員工（保險、薪資設定等）
  if (body.action === "update") {
    const { employee_id, ...updates } = body;
    delete updates.action;
    const { data, error } = await supabase.from("employees").update(updates).eq("id", employee_id).select("*, stores(name)").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
