import { supabase, auditLog } from "@/lib/supabase";
import { pushText } from "@/lib/line";

function generateBindCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

// 計算年資（月）
function calcServiceMonths(hireDate) {
  if (!hireDate) return 0;
  const hire = new Date(hireDate), now = new Date();
  return (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth());
}

// 計算特休（小時，1天=8hr）
function calcAnnualLeave(serviceMonths, type) {
  const rules = type === "parttime" ? [
    [6,12,1.5],[12,24,3.5],[24,36,5],[36,60,7],[60,120,7.5],[120,9999,7.5]
  ] : [
    [6,12,3],[12,24,7],[24,36,10],[36,60,14],[60,120,15],[120,180,16],[180,240,17],[240,300,18],[300,360,19],[360,9999,20]
  ];
  for (const [min, max, days] of rules) {
    if (serviceMonths >= min && serviceMonths < max) return days * 8;
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

    // 取勞保級距
    let laborIns = null;
    if (emp.labor_tier) {
      const { data } = await supabase.from("insurance_tiers").select("*").eq("tier_level", emp.labor_tier).eq("employment_type", emp.employment_type).single();
      laborIns = data;
    }
    // 取健保級距
    let healthIns = null;
    if (emp.health_tier) {
      const { data } = await supabase.from("insurance_tiers").select("*").eq("tier_level", emp.health_tier).eq("employment_type", emp.employment_type).single();
      healthIns = data;
    }

    const { data: onboarding } = await supabase.from("onboarding_records").select("*").eq("auto_employee_id", id).single();
    const year = new Date().getFullYear();
    const { data: leaveBalance } = await supabase.from("leave_balances").select("*").eq("employee_id", id).eq("year", year).single();

    return Response.json({
      data: emp, service_months: months, annual_leave_days: annualLeave,
      labor_insurance: laborIns, health_insurance: healthIns,
      onboarding, leave_balance: leaveBalance,
    });
  }

  // 員工列表
  let query = supabase.from("employees").select("*, stores(name)").order("created_at", { ascending: false });
  if (store_id) query = query.eq("store_id", store_id);
  if (!include_inactive) query = query.or("is_active.eq.true,is_active.eq.false"); // show all for admin

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // 附加年資和特休（檢查 leave_balances 有無手動覆蓋）
  const year = new Date().getFullYear();
  const { data: balances } = await supabase.from("leave_balances")
    .select("employee_id, annual_total").eq("year", year);
  const balMap = {};
  (balances || []).forEach(b => { if (b.annual_total > 0) balMap[b.employee_id] = b.annual_total; });

  const enriched = (data || []).map(emp => {
    const auto = calcAnnualLeave(calcServiceMonths(emp.hire_date), emp.employment_type);
    return {
      ...emp,
      service_months: calcServiceMonths(emp.hire_date),
      annual_leave_days: balMap[emp.id] || auto,
    };
  });

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

    // 通知員工帳號已啟用
    if (data.line_uid) {
      await pushText(data.line_uid, `✅ 帳號已啟用！\n\n👤 ${data.name}\n🏠 ${data.stores?.name || "總部"}\n🔑 綁定碼：${bindCode}\n\n你已經可以使用系統了，輸入「選單」查看功能列表。\n\n如需重新綁定請輸入：綁定 ${bindCode}`).catch(() => {});
    }

    return Response.json({ data, bind_code: bindCode });
  }

  // 停用帳號
  if (body.action === "deactivate") {
    const { data: empData } = await supabase.from("employees").select("line_uid, name").eq("id", body.employee_id).single();
    // LINE 通知 + 解除綁定
    if (empData?.line_uid) {
      await pushText(empData.line_uid, "⚠️ 你的帳號已停用\n\n👤 " + empData.name + "\n\n如有疑問請聯繫總部。").catch(() => {});
      await supabase.from("user_states").delete().eq("line_uid", empData.line_uid);
    }
    const { data, error } = await supabase.from("employees").update({ is_active: false, line_uid: null }).eq("id", body.employee_id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  // 永久刪除
  if (body.action === "delete") {
    const eid = body.employee_id;
    try {
      // LINE 通知
      const { data: empData } = await supabase.from("employees").select("line_uid, name").eq("id", eid).single();
      if (empData?.line_uid) {
        await pushText(empData.line_uid, "⚠️ 帳號已移除\n👤 " + empData.name).catch(() => {});
      }
      // 並行清理所有 FK 表
      await Promise.allSettled([
        supabase.from("schedules").delete().eq("employee_id", eid),
        supabase.from("attendances").delete().eq("employee_id", eid),
        supabase.from("leave_requests").delete().eq("employee_id", eid),
        supabase.from("leave_balances").delete().eq("employee_id", eid),
        supabase.from("overtime_records").delete().eq("employee_id", eid),
        supabase.from("payroll_records").delete().eq("employee_id", eid),
        supabase.from("violations").delete().eq("employee_id", eid),
        supabase.from("performance_reviews").delete().eq("employee_id", eid),
        supabase.from("bonus_records").delete().eq("employee_id", eid),
        supabase.from("employee_documents").delete().eq("employee_id", eid),
        supabase.from("work_logs").delete().eq("employee_id", eid),
        supabase.from("clock_amendments").delete().eq("employee_id", eid),
        supabase.from("clockin_tokens").delete().eq("employee_id", eid),
        supabase.from("admin_sessions").delete().eq("employee_id", eid),
        supabase.from("incident_reports").delete().eq("employee_id", eid),
        supabase.from("swap_requests").delete().or("requester_id.eq." + eid + ",target_id.eq." + eid),
        supabase.from("user_states").delete().eq("line_uid", empData?.line_uid || "____"),
        supabase.from("daily_settlements").update({ submitted_by: null }).eq("submitted_by", eid),
        supabase.from("deposits").update({ submitted_by: null }).eq("submitted_by", eid),
        supabase.from("expenses").update({ submitted_by: null }).eq("submitted_by", eid),
        supabase.from("production_orders").update({ assigned_to: null }).eq("assigned_to", eid),
        supabase.from("onboarding_records").update({ auto_employee_id: null }).eq("auto_employee_id", eid),
        supabase.from("work_log_items").update({ completed_by: null }).eq("completed_by", eid),
      ]);
      const { error } = await supabase.from("employees").delete().eq("id", eid);
      if (error) return Response.json({ error: "刪除失敗：" + error.message }, { status: 500 });
      return Response.json({ success: true });
    } catch (e) {
      return Response.json({ error: "刪除失敗：" + (e.message || "未知錯誤") }, { status: 500 });
    }
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
      probation_end_date: new Date(Date.now() + 90 * 86400000).toLocaleDateString("sv-SE"),
      probation_status: "in_probation",
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
    await auditLog(null, null, "employee_update", "employee", employee_id, updates);
    return Response.json({ data });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
