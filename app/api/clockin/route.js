import { supabase } from "@/lib/supabase";
import { pushText } from "@/lib/line";

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

  const { data: emp } = await supabase.from("employees").select("name, store_id, stores(*)").eq("id", t.employee_id).single();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const { data: schedule } = await supabase.from("schedules").select("*, shifts(*)").eq("employee_id", t.employee_id).eq("date", today).single();

  return Response.json({
    employee_name: emp?.name, type: t.type,
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

  const { data: emp } = await supabase.from("employees").select("name, line_uid, store_id, stores(*)").eq("id", t.employee_id).single();
  const store = emp?.stores;

  const distance = store?.latitude ? Math.round(calcDistance(latitude, longitude, store.latitude, store.longitude)) : null;
  const isValid = distance !== null ? distance <= (store.radius_m || 200) : true;

  const now = new Date();
  const taipeiNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const today = taipeiNow.toLocaleDateString("sv-SE");
  const currentTime = taipeiNow.toTimeString().slice(0, 5);

  const { data: schedule } = await supabase.from("schedules").select("*, shifts(*)").eq("employee_id", t.employee_id).eq("date", today).single();
  const { data: settings } = await supabase.from("attendance_settings").select("*").limit(1).single();

  let lateMinutes = 0;
  if (t.type === "clock_in" && schedule?.shifts?.start_time) {
    const [sh, sm] = schedule.shifts.start_time.split(":").map(Number);
    const [ch, cm] = currentTime.split(":").map(Number);
    const diff = (ch * 60 + cm) - (sh * 60 + sm);
    lateMinutes = diff > (settings?.late_grace_minutes || 5) ? diff : 0;
  }

  await supabase.from("attendances").insert({
    employee_id: t.employee_id, store_id: store?.id, type: t.type,
    timestamp: now.toISOString(), latitude, longitude,
    is_valid: isValid, distance_meters: distance, late_minutes: lateMinutes,
    schedule_id: schedule?.id, shift_id: schedule?.shift_id, clock_in_token: token,
  });

  await supabase.from("clockin_tokens").update({ used: true }).eq("token", token);

  const label = t.type === "clock_in" ? "上班" : "下班";
  let msg = `✅ ${label}打卡成功！\n\n👤 ${emp?.name}\n🏠 ${store?.name || "?"}\n⏰ ${currentTime}\n📍 距門市 ${distance ?? "?"}m`;
  if (!isValid) msg += `\n⚠️ 超出範圍（${distance}m > ${store?.radius_m}m）`;
  if (lateMinutes > 0) msg += `\n⏰ 遲到 ${lateMinutes} 分鐘`;
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

  if (lateMinutes > 0) {
    const { data: mgrs } = await supabase.from("employees").select("line_uid").in("role", ["admin", "manager"]).eq("is_active", true);
    if (mgrs) for (const m of mgrs) if (m.line_uid) await pushText(m.line_uid, `⏰ 遲到｜${emp?.name}（${store?.name}）${lateMinutes}分鐘`).catch(() => {});
  }

  return Response.json({ success: true, type: t.type, time: currentTime, distance, is_valid: isValid, late_minutes: lateMinutes, store_name: store?.name });
}
