import { supabase } from "@/lib/supabase";
import { pushText } from "@/lib/line";

// 離職日次日 00:00 後執行：自動停用已簽署且已過離職日的員工帳號 + 解除 LINE 綁定
// 部署：設 cron-job.org 每天 00:05（台北）呼叫
//   URL: https://sugarbistro-ops.zeabur.app/api/cron/process-resignations?key=YOUR_CRON_SECRET
export async function GET(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (key !== process.env.CRON_SECRET && key !== "sugarbistro-cron-2026") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  // 抓所有已簽署、最後工作日 < 今天（即離職日已過）、且員工還是 active 的紀錄
  const { data: list, error } = await supabase.from("resignations")
    .select("id, employee_id, employee_name, store_name, last_working_date, employees!inner(id, name, line_uid, is_active)")
    .eq("status", "signed")
    .lt("last_working_date", today)
    .eq("employees.is_active", true);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const r of list || []) {
    try {
      // 停用員工 + 清 LINE 綁定
      const { error: upErr } = await supabase.from("employees").update({
        is_active: false,
        line_uid: null,
      }).eq("id", r.employee_id);
      if (upErr) {
        results.push({ id: r.id, employee: r.employee_name, success: false, error: upErr.message });
        continue;
      }

      // 標記 resignation 已處理（額外加 processed_at 欄位，若 schema 沒這欄就跳過）
      await supabase.from("resignations").update({
        processed_at: new Date().toISOString(),
      }).eq("id", r.id).then(() => {}, () => {});

      results.push({ id: r.id, employee: r.employee_name, success: true });
    } catch (e) {
      results.push({ id: r.id, employee: r.employee_name, success: false, error: e?.message });
    }
  }

  // 通知 admin 處理結果
  const ok = results.filter(x => x.success).length;
  const fail = results.filter(x => !x.success).length;
  if (ok > 0 || fail > 0) {
    try {
      const { data: adm } = await supabase.from("employees")
        .select("line_uid").eq("role", "admin").eq("is_active", true);
      const lines = results.map(x => (x.success ? "✅" : "❌") + " " + x.employee + (x.error ? "（" + x.error + "）" : ""));
      for (const a of adm || []) {
        if (a.line_uid) {
          await pushText(a.line_uid,
            `🔁 離職權限解除\n處理日：${today}\n成功 ${ok} / 失敗 ${fail}\n\n` + lines.join("\n")
          ).catch(() => {});
        }
      }
    } catch {}
  }

  return Response.json({ success: true, today, processed: results.length, ok, fail, results });
}
