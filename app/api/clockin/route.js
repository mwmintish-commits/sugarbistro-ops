import { supabase } from "@/lib/supabase";
import { pushText } from "@/lib/line";
import { calcHourlyRate } from "@/lib/hr-utils";

function calcDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return Response.json({ error: "Missing token" }, { status: 400 });

  const { data: t } = await supabase.from("clockin_tokens").select("*").eq("token", token).single();
  if (!t) return Response.json({ error: "Invalid token" }, { status: 404 });
  if (t.used) return Response.json({ error: "Token already used" }, { status: 400 });
  if (new Date(t.expires_at) < new Date()) return Response.json({ error: "Token expired" }, { status: 400 });

  const { data: emp } = await supabase.from("employees").select("name, store_id, stores!store_id(*)").eq("id", t.employee_id).single();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const { data: schedule } = await supabase.from("schedules").select("*, shifts(*)").eq("employee_id", t.employee_id).eq("date", today).single();

  return Response.json({
    employee_name: emp?.name, employee_id: t.employee_id, type: t.type,
    store: emp?.stores ? { name: emp.stores.name, latitude: emp.stores.latitude, longitude: emp.stores.longitude, radius_m: emp.stores.radius_m } : null,
    schedule: schedule ? { shift_name: schedule.shifts?.name, start_time: schedule.shifts?.start_time, end_time: schedule.shifts?.end_time } : null,
  });
}

export async function POST(request) {
  const { token, latitude, longitude } = await request.json();
  if (!token || !latitude || !longitude) return Response.json({ error: "Missing data" }, { status: 400 });

  const { data: t } = await supabase.from("clockin_tokens").select("*").eq("token", token).single();
  if (!t) return Response.json({ error: "Invalid token" }, { status: 404 });
  if (t.used) return Response.json({ error: "Already clocked" }, { status: 400 });
  if (new Date(t.expires_at) < new Date()) return Response.json({ error: "Expired" }, { status: 400 });

  const { data: emp } = await supabase.from("employees").select("name, line_uid, store_id, hourly_rate, monthly_salary, stores!store_id(*)").eq("id", t.employee_id).single();
  if (!emp) return Response.json({ error: "找不到員工資料" }, { status: 404 });
  const store = emp?.stores;

  const distance = store?.latitude ? Math.round(calcDistance(latitude, longitude, store.latitude, store.longitude)) : null;
  const isValid = distance !== null ? distance <= (store.radius_m || 200) : true;

  const now = new Date();
  const taipeiNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const today = taipeiNow.toLocaleDateString("sv-SE");
  const currentTime = taipeiNow.toTimeString().slice(0, 5);

  const { data: schedule } = await supabase.from("schedules").select("*, shifts(*)").eq("employee_id", t.employee_id).eq("date", today).single();

  // 無排班不可打卡
  if (!schedule) return Response.json({ error: "今日無排班，無法打卡。請確認排班表。" }, { status: 403 });

  // 位置異常不可打卡
  if (distance !== null && !isValid) return Response.json({ error: `位置異常（距門市${distance}m，超出${store.radius_m || 200}m），無法打卡。` }, { status: 403 });
  const { data: settings } = await supabase.from("attendance_settings").select("*").limit(1).single();

  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  if (t.type === "clock_in" && schedule?.shifts?.start_time) {
    const [sh, sm] = schedule.shifts.start_time.split(":").map(Number);
    const [ch, cm] = currentTime.split(":").map(Number);
    const diff = (ch * 60 + cm) - (sh * 60 + sm);
    lateMinutes = diff > (settings?.late_grace_minutes || 5) ? diff : 0;
  }
  if (t.type === "clock_out" && schedule?.shifts?.end_time) {
    const [eh, emn] = schedule.shifts.end_time.split(":").map(Number);
    const [ch, cm] = currentTime.split(":").map(Number);
    const diff = (eh * 60 + emn) - (ch * 60 + cm);  // 早多少分鐘下班
    const threshold = settings?.early_leave_minutes ?? 5;
    earlyLeaveMinutes = diff > threshold ? diff : 0;
  }

  // 寫入打卡（含 work_type 從排班帶過來）
  const workType = schedule?.day_type || "work";
  await supabase.from("attendances").insert({
    employee_id: t.employee_id, store_id: store?.id, type: t.type,
    timestamp: now.toISOString(), latitude, longitude,
    is_valid: isValid, distance_meters: distance,
    late_minutes: lateMinutes, early_leave_minutes: earlyLeaveMinutes,
    schedule_id: schedule?.id, shift_id: schedule?.shift_id, clock_in_token: token,
    work_type: workType,
  });

  await supabase.from("clockin_tokens").update({ used: true }).eq("token", token);

  const label = t.type === "clock_in" ? "上班" : "下班";
  let msg = `✅ ${label}打卡成功！\n\n👤 ${emp?.name}\n🏠 ${store?.name || "?"}\n⏰ ${currentTime}\n📍 距門市 ${distance ?? "?"}m`;
  if (!isValid) msg += `\n⚠️ 超出範圍（${distance}m > ${store?.radius_m}m）`;
  if (lateMinutes > 0) msg += `\n⏰ 遲到 ${lateMinutes} 分鐘`;
  if (earlyLeaveMinutes > 0) msg += `\n🏃 早退 ${earlyLeaveMinutes} 分鐘`;
  await pushText(emp?.line_uid, msg).catch(() => {});

  // 上班打卡後自動發送工作日誌連結
  if (t.type === "clock_in" && emp?.line_uid) {
    const baseUrl = process.env.SITE_URL || "https://sugarbistro-ops.zeabur.app";
    const wlUrl = `${baseUrl}/worklog?eid=${t.employee_id}&sid=${store?.id || ""}&name=${encodeURIComponent(emp.name)}`;
    const { lineClient } = await import("@/lib/line");
    await lineClient.pushMessage({
      to: emp.line_uid,
      messages: [{ type: "template", altText: "填寫工作日誌", template: { type: "buttons", title: "📋 每日工作日誌", text: "請確認今日工作項目", actions: [{ type: "uri", label: "填寫工作日誌", uri: wlUrl }] } }],
    }).catch(() => {});
  }

  // 下班打卡：自動偵測加班（依 schedule.day_type 區分費率，與 payroll 邏輯一致）
  if (t.type === "clock_out" && schedule?.shifts?.end_time) {
    const [eh, em2] = schedule.shifts.end_time.split(":").map(Number);
    const [ch2, cm2] = currentTime.split(":").map(Number);
    const otMinutes = (ch2 * 60 + cm2) - (eh * 60 + em2);
    const minOt = settings?.overtime_min_minutes || 30;
    if (otMinutes >= minOt) {
      const dt = workType;  // schedule.day_type
      // 統一以 day_type 對應費率（不再混用 dayOfWeek 與 national_holidays 雙來源）
      let otType, rate;
      if (dt === "national_holiday") { otType = "holiday"; rate = 2.0; }
      else if (dt === "rest_day") {
        // 休息日：前 2hr 1.34、之後 1.67（>8hr 階梯由薪資結算統一處理）
        otType = "rest_1"; rate = otMinutes <= 120 ? 1.34 : 1.67;
      }
      else { otType = otMinutes <= 120 ? "weekday_1" : "weekday_2"; rate = otMinutes <= 120 ? 1.34 : 1.67; }
      const hourlyRate = calcHourlyRate(emp);
      const otAmount = Math.round(hourlyRate * (otMinutes / 60) * rate);
      await supabase.from("overtime_records").insert({
        employee_id: t.employee_id, store_id: store?.id, date: today,
        scheduled_end: schedule.shifts.end_time, actual_end: currentTime,
        overtime_minutes: otMinutes, overtime_type: otType, rate, amount: otAmount,
      }).catch(() => {});
      msg += "\n⏱ 加班 " + otMinutes + " 分鐘（待核准）";
    }
  }

  if (lateMinutes > 0 || earlyLeaveMinutes > 0) {
    // 分層通知：該店店長 + 區經理（不再推總部 admin）
    const { getStoreManagers } = await import("@/lib/notify");
    const recipients = await getStoreManagers(supabase, store?.id);
    const tag = lateMinutes > 0 ? `⏰ 遲到 ${lateMinutes}分鐘` : `🏃 早退 ${earlyLeaveMinutes}分鐘`;
    for (const r of recipients) await pushText(r.line_uid, `${tag}｜${emp?.name}（${store?.name}）`).catch(() => {});
  }

  return Response.json({ success: true, type: t.type, time: currentTime, distance, is_valid: isValid, late_minutes: lateMinutes, early_leave_minutes: earlyLeaveMinutes, store_name: store?.name });
}
