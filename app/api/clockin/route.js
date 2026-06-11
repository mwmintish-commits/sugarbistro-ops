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

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  // 並行查詢：員工與今日排班互不依賴，省一次 round-trip（冷啟動時差更明顯）
  const [{ data: emp }, { data: schedule }] = await Promise.all([
    supabase.from("employees").select("name, store_id, stores!store_id(*)").eq("id", t.employee_id).single(),
    supabase.from("schedules").select("*, shifts(*)").eq("employee_id", t.employee_id).eq("date", today).single(),
  ]);

  return Response.json({
    employee_name: emp?.name, employee_id: t.employee_id, type: t.type,
    store: emp?.stores ? { id: emp.stores.id, name: emp.stores.name, latitude: emp.stores.latitude, longitude: emp.stores.longitude, radius_m: emp.stores.radius_m } : null,
    schedule: schedule ? { shift_name: schedule.shifts?.name, start_time: schedule.shifts?.start_time, end_time: schedule.shifts?.end_time } : null,
  });
}

export async function POST(request) {
  const { token, latitude, longitude } = await request.json();
  // 0 是合法緯度（赤道），所以用 == null 判斷而不是 falsy
  if (!token || latitude == null || longitude == null) return Response.json({ error: "Missing data" }, { status: 400 });
  if (typeof latitude !== "number" || typeof longitude !== "number") return Response.json({ error: "Invalid coordinates" }, { status: 400 });

  // 原子鎖定 token：把 used=false 的那筆改成 used=true，select 拿回原本資料；
  // 若回不到資料代表 token 不存在 / 已用過 / 已過期（無 row 符合條件）→ 直接擋
  const { data: t, error: lockErr } = await supabase.from("clockin_tokens")
    .update({ used: true })
    .eq("token", token).eq("used", false).gt("expires_at", new Date().toISOString())
    .select("token, employee_id, type, expires_at").maybeSingle();
  if (lockErr) return Response.json({ error: "Token 鎖定失敗：" + lockErr.message }, { status: 500 });
  if (!t) {
    // 區分原因給更明確錯誤
    const { data: existing } = await supabase.from("clockin_tokens").select("used, expires_at").eq("token", token).maybeSingle();
    if (!existing) return Response.json({ error: "打卡連結無效，請從 LINE 重新開啟" }, { status: 404 });
    if (existing.used) return Response.json({ error: "此打卡連結已使用，請重新從 LINE 取得新連結" }, { status: 400 });
    return Response.json({ error: "打卡連結已過期，請重新從 LINE 開啟" }, { status: 400 });
  }

  // 並行抓員工 + 今日排班，加快 cold start 場景
  const now = new Date();
  const taipeiNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const today = taipeiNow.toLocaleDateString("sv-SE");
  const todayStart = today + "T00:00:00+08:00";
  const todayEnd = today + "T23:59:59+08:00";
  const [{ data: emp }, { data: schedule }, { data: todayRecs }, { data: settings }] = await Promise.all([
    supabase.from("employees").select("name, line_uid, store_id, hourly_rate, monthly_salary, stores!store_id(*)").eq("id", t.employee_id).maybeSingle(),
    supabase.from("schedules").select("*, shifts(*)").eq("employee_id", t.employee_id).eq("date", today).maybeSingle(),
    supabase.from("attendances").select("id, timestamp, is_amendment")
      .eq("employee_id", t.employee_id).eq("type", t.type)
      .gte("timestamp", todayStart).lte("timestamp", todayEnd)
      .order("timestamp", { ascending: false }),
    // maybeSingle 防 0 row 時 throw（attendance_settings 沒設定時整個 API 會 crash）
    supabase.from("attendance_settings").select("*").limit(1).maybeSingle(),
  ]);
  if (!emp) {
    // 取消已鎖定的 token（恢復 used=false）讓使用者可再試
    await supabase.from("clockin_tokens").update({ used: false }).eq("token", token);
    return Response.json({ error: "找不到員工資料" }, { status: 404 });
  }
  const store = emp?.stores;

  const distance = store?.latitude ? Math.round(calcDistance(latitude, longitude, store.latitude, store.longitude)) : null;
  const isValid = distance !== null ? distance <= (store.radius_m || 200) : true;

  let currentTime = taipeiNow.toTimeString().slice(0, 5);
  let recordedTimestamp = now.toISOString();
  let autoCorrected = false;

  // 無排班不可打卡（同時釋放 token 讓員工可再試）
  if (!schedule) {
    await supabase.from("clockin_tokens").update({ used: false }).eq("token", token);
    return Response.json({ error: "今日無排班，無法打卡。請聯繫主管確認排班是否已發布。" }, { status: 403 });
  }

  // 位置異常不可打卡（釋放 token 讓員工移動位置後可再試）
  if (distance !== null && !isValid) {
    await supabase.from("clockin_tokens").update({ used: false }).eq("token", token);
    return Response.json({ error: `位置異常（距門市${distance}m，超出${store.radius_m || 200}m），無法打卡。` }, { status: 403 });
  }

  // 防呆：重複打卡偵測
  // 1) 5 分鐘內已有同類型紀錄 → 直接拒絕（避免員工連點）
  // 2) 達當日上限（單班=1次，雙班=2次）→ 拒絕，請走補打卡流程
  {
    const typeLabel = t.type === "clock_in" ? "上班" : "下班";
    const normalRecs = (todayRecs || []).filter(r => !r.is_amendment);

    if (normalRecs[0]) {
      const lastTs = new Date(normalRecs[0].timestamp);
      const lastHHMM = lastTs.toLocaleTimeString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }).slice(0, 5);
      const minutesAgo = (Date.now() - lastTs.getTime()) / 60000;
      if (minutesAgo < 5) {
        return Response.json({
          error: `已於 ${lastHHMM} 完成${typeLabel}打卡（${Math.round(minutesAgo)} 分鐘前），請勿重複按。如要修正請走「補打卡」`,
        }, { status: 409 });
      }
    }

    const maxPerType = store?.shift_mode === "double" ? 2 : 1;
    if (normalRecs.length >= maxPerType) {
      const allTimes = normalRecs.map(r => new Date(r.timestamp).toLocaleTimeString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }).slice(0, 5)).join("、");
      return Response.json({
        error: `今日${typeLabel}打卡已達上限 ${maxPerType} 次（${allTimes}）。如要修正請聯絡主管或走「補打卡」`,
      }, { status: 409 });
    }
  }
  // 自動矯正：下班超過 end_time 但未達加班起算門檻 → 視為準時下班（記錄為排班 end_time）
  if (t.type === "clock_out" && schedule?.shifts?.end_time) {
    const [eh0, em0] = schedule.shifts.end_time.split(":").map(Number);
    const [ch0, cm0] = currentTime.split(":").map(Number);
    const overMin = (ch0 * 60 + cm0) - (eh0 * 60 + em0);
    const minOt = settings?.overtime_min_minutes || 30;
    if (overMin > 0 && overMin < minOt) {
      // 矯正打卡時間為排班結束時間
      currentTime = schedule.shifts.end_time.slice(0, 5);
      const corrected = new Date(taipeiNow);
      corrected.setHours(eh0, em0, 0, 0);
      // 換算回 UTC ISO（taipeiNow 是已轉成 Taipei wall-clock 的 Date，差 8hr）
      recordedTimestamp = new Date(corrected.getTime() - 8 * 3600 * 1000).toISOString();
      autoCorrected = true;
    }
  }

  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  // 例假/休息日不算遲到早退（即使排班殘留 shift_id）
  const isOffDay = schedule?.day_type === "regular_off" || schedule?.day_type === "rest_day";
  if (!isOffDay && t.type === "clock_in" && schedule?.shifts?.start_time) {
    const [sh, sm] = schedule.shifts.start_time.split(":").map(Number);
    const [ch, cm] = currentTime.split(":").map(Number);
    const diff = (ch * 60 + cm) - (sh * 60 + sm);
    lateMinutes = diff > (settings?.late_grace_minutes || 5) ? diff : 0;
  }
  if (!isOffDay && t.type === "clock_out" && schedule?.shifts?.end_time) {
    const [eh, emn] = schedule.shifts.end_time.split(":").map(Number);
    const [ch, cm] = currentTime.split(":").map(Number);
    const diff = (eh * 60 + emn) - (ch * 60 + cm);  // 早多少分鐘下班
    const threshold = settings?.early_leave_minutes ?? 5;
    earlyLeaveMinutes = diff > threshold ? diff : 0;
  }

  // 寫入打卡（含 work_type 從排班帶過來）
  const workType = schedule?.day_type || "work";
  // 防呆：若 attendances 缺欄位（如 work_type），降級重試以確保打卡不被擋
  const baseAtt = {
    employee_id: t.employee_id, store_id: store?.id, type: t.type,
    timestamp: recordedTimestamp, latitude, longitude,
    is_valid: isValid, distance_meters: distance,
    late_minutes: lateMinutes, early_leave_minutes: earlyLeaveMinutes,
    schedule_id: schedule?.id, shift_id: schedule?.shift_id, clock_in_token: token,
  };
  // 嘗試含 work_type 寫入；schema 缺欄位則降級重試
  let insertOk = false;
  let lastErrMsg = "";
  try {
    const r = await supabase.from("attendances").insert({ ...baseAtt, work_type: workType });
    if (!r.error) insertOk = true;
    else lastErrMsg = r.error.message || "";
  } catch (e) { lastErrMsg = e?.message || String(e); }
  if (!insertOk) {
    try {
      const r = await supabase.from("attendances").insert(baseAtt);
      if (!r.error) insertOk = true;
      else lastErrMsg = r.error.message || lastErrMsg;
    } catch (e) { lastErrMsg = e?.message || lastErrMsg; }
  }
  if (!insertOk) {
    // 寫入完全失敗 → 釋放 token、回傳具體錯誤（不要靜默讓員工以為成功）
    await supabase.from("clockin_tokens").update({ used: false }).eq("token", token);
    console.error("attendance insert failed:", lastErrMsg);
    return Response.json({ error: "打卡寫入失敗，請重試或聯繫主管：" + (lastErrMsg || "未知錯誤") }, { status: 500 });
  }
  // token 鎖定已在最前面完成，不需再次 update

  const label = t.type === "clock_in" ? "上班" : "下班";
  let msg = `✅ ${label}打卡成功！\n\n👤 ${emp?.name}\n🏠 ${store?.name || "?"}\n⏰ ${currentTime}${autoCorrected ? "（依排班結束時間記錄，未達加班門檻）" : ""}\n📍 距門市 ${distance ?? "?"}m`;
  if (!isValid) msg += `\n⚠️ 超出範圍（${distance}m > ${store?.radius_m}m）`;
  if (lateMinutes > 0) msg += `\n⏰ 遲到 ${lateMinutes} 分鐘`;
  if (earlyLeaveMinutes > 0) msg += `\n🏃 早退 ${earlyLeaveMinutes} 分鐘`;
  // 注意：msg 在下方加班判定後才推播（加班行要拼進去），所有推播最後一次並行送出

  // 下班打卡：自動偵測加班（依 schedule.day_type 區分費率，與 payroll 邏輯一致）
  // 整段以 try-catch 包覆 — 加班記錄失敗不影響打卡成功
  try {
    if (t.type === "clock_out" && schedule?.shifts?.end_time) {
      const [eh, em2] = schedule.shifts.end_time.split(":").map(Number);
      const [ch2, cm2] = currentTime.split(":").map(Number);
      const otMinutes = (ch2 * 60 + cm2) - (eh * 60 + em2);
      const minOt = settings?.overtime_min_minutes || 30;
      if (otMinutes >= minOt) {
        const dt = workType;
        let otType, rate;
        if (dt === "national_holiday") { otType = "holiday"; rate = 2.0; }
        else if (dt === "rest_day") {
          otType = "rest_1"; rate = otMinutes <= 120 ? 1.34 : 1.67;
        }
        else { otType = otMinutes <= 120 ? "weekday_1" : "weekday_2"; rate = otMinutes <= 120 ? 1.34 : 1.67; }
        const hourlyRate = calcHourlyRate(emp);
        const otAmount = Math.round(hourlyRate * (otMinutes / 60) * rate);

        // 對照「事前申請且已核准」的加班記錄
        let preApproved = null;
        try {
          const { data: pre } = await supabase.from("overtime_records")
            .select("id, requested_minutes, request_comp_pref, comp_type")
            .eq("employee_id", t.employee_id).eq("date", today)
            .eq("is_pre_approved", true).eq("status", "approved")
            .order("requested_at", { ascending: false }).limit(1).maybeSingle();
          preApproved = pre;
        } catch {}

        if (preApproved) {
          // 已預約 → 更新該筆，自動成立
          try {
            const updates = {
              scheduled_end: schedule.shifts.end_time, actual_end: currentTime,
              overtime_minutes: otMinutes, overtime_type: otType, rate, amount: otAmount,
            };
            // 補休偏好 → 換算 comp_hours + expiry
            if (preApproved.comp_type === "comp" || preApproved.request_comp_pref === "comp") {
              updates.comp_type = "comp";
              updates.comp_hours = Math.round((otMinutes / 60) * 10) / 10;
              const exp = new Date(today); exp.setMonth(exp.getMonth() + 6);
              updates.comp_expiry_date = exp.toLocaleDateString("sv-SE");
              updates.amount = 0;
            } else {
              updates.comp_type = "pay";
            }
            await supabase.from("overtime_records").update(updates).eq("id", preApproved.id);
            const overReq = otMinutes - (preApproved.requested_minutes || 0);
            msg += `\n⏱ 加班 ${otMinutes} 分鐘（已核准成立）`;
            if (Math.abs(overReq) > 15) msg += `\n📝 與預約差 ${overReq > 0 ? "+" : ""}${overReq} 分鐘`;
          } catch (e) { console.error("pre-approved update failed:", e?.message); }
        } else {
          // 無預約 → 寫入 pending 等事後核准
          try {
            await supabase.from("overtime_records").insert({
              employee_id: t.employee_id, store_id: store?.id, date: today,
              scheduled_end: schedule.shifts.end_time, actual_end: currentTime,
              overtime_minutes: otMinutes, overtime_type: otType, rate, amount: otAmount,
              status: "pending", is_pre_approved: false,
            });
          } catch (e) { console.error("overtime_records insert failed:", e?.message); }
          msg += `\n⏱ 加班 ${otMinutes} 分鐘（待核准）\n💡 下次可先輸入「加班申請」事前申報`;
        }
      }
    }
  } catch (e) { console.error("OT block error:", e?.message); }

  // 所有 LINE 推播並行送出（成功訊息/工作日誌卡片/遲到早退通知），縮短員工等待時間
  try {
    const pushes = [pushText(emp?.line_uid, msg)];
    if (t.type === "clock_in" && emp?.line_uid) {
      const baseUrl = process.env.SITE_URL || "https://sugarbistro-ops.zeabur.app";
      const wlUrl = `${baseUrl}/worklog?eid=${t.employee_id}&sid=${store?.id || ""}&name=${encodeURIComponent(emp.name)}`;
      const { lineClient } = await import("@/lib/line");
      pushes.push(lineClient.pushMessage({
        to: emp.line_uid,
        messages: [{ type: "template", altText: "填寫工作日誌", template: { type: "buttons", title: "📋 每日工作日誌", text: "請確認今日工作項目", actions: [{ type: "uri", label: "填寫工作日誌", uri: wlUrl }] } }],
      }));
    }
    if (lateMinutes > 0 || earlyLeaveMinutes > 0) {
      const { getStoreManagers } = await import("@/lib/notify");
      const tag = lateMinutes > 0 ? `⏰ 遲到 ${lateMinutes}分鐘` : `🏃 早退 ${earlyLeaveMinutes}分鐘`;
      pushes.push(getStoreManagers(supabase, store?.id).then(recipients =>
        Promise.allSettled(recipients.map(r => pushText(r.line_uid, `${tag}｜${emp?.name}（${store?.name}）`)))
      ));
    }
    await Promise.allSettled(pushes);
  } catch (e) { console.error("Notify block error:", e?.message); }

  return Response.json({ success: true, type: t.type, time: currentTime, distance, is_valid: isValid, late_minutes: lateMinutes, early_leave_minutes: earlyLeaveMinutes, store_name: store?.name });
}
