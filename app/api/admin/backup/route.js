import { supabase } from "@/lib/supabase";

const CORE_TABLES = [
  "employees", "stores", "daily_settlements", "deposits", "expenses",
  "payroll_records", "schedules", "shifts", "leave_requests", "leave_balances",
  "attendances", "overtime_records", "stock_counts", "stock_count_lines",
  "stock_items", "stock_deliveries", "stock_sales", "announcements",
  "system_settings", "audit_logs", "clients", "client_orders",
  "recipes", "products", "performance_reviews", "bonus_records",
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const key = searchParams.get("key");

  // Cron 自動備份（每天凌晨跑）
  if (action === "auto" && (key === process.env.CRON_SECRET || key === "sugarbistro-cron-2026")) {
    return doBackup("auto");
  }

  // 手動下載備份
  if (action === "download") {
    const backup = {};
    const counts = {};
    for (const table of CORE_TABLES) {
      try {
        const { data, error } = await supabase.from(table).select("*");
        if (!error && data) {
          backup[table] = data;
          counts[table] = data.length;
        }
      } catch { counts[table] = "error"; }
    }
    backup._meta = {
      exported_at: new Date().toISOString(),
      tables: counts,
      total_records: Object.values(counts).filter(v => typeof v === "number").reduce((a, b) => a + b, 0),
    };
    return new Response(JSON.stringify(backup, null, 0), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="sugarbistro-backup-${new Date().toLocaleDateString("sv-SE")}.json"`,
      },
    });
  }

  // 列出備份清單
  if (action === "list") {
    const { data } = await supabase.storage.from("receipts").list("backups", { limit: 30, sortBy: { column: "name", order: "desc" } });
    return Response.json({ data: data || [] });
  }

  // 下載特定備份
  if (action === "get" && searchParams.get("file")) {
    const { data } = supabase.storage.from("receipts").getPublicUrl("backups/" + searchParams.get("file"));
    return Response.json({ url: data?.publicUrl });
  }

  return Response.json({ error: "Missing action" }, { status: 400 });
}

async function doBackup(source) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const backup = {};
  const counts = {};
  let totalRecords = 0;

  for (const table of CORE_TABLES) {
    try {
      const { data, error } = await supabase.from(table).select("*");
      if (!error && data) {
        backup[table] = data;
        counts[table] = data.length;
        totalRecords += data.length;
      } else {
        counts[table] = 0;
      }
    } catch {
      counts[table] = "error";
    }
  }

  backup._meta = {
    date: today,
    source,
    exported_at: new Date().toISOString(),
    tables: counts,
    total_records: totalRecords,
  };

  // 存到 Supabase Storage
  const json = JSON.stringify(backup);
  const buf = Buffer.from(json, "utf-8");
  const path = `backups/${today}.json`;

  const { error: uploadErr } = await supabase.storage.from("receipts")
    .upload(path, buf, { contentType: "application/json", upsert: true });

  // 清理 30 天前的備份
  try {
    const { data: files } = await supabase.storage.from("receipts").list("backups", { limit: 100, sortBy: { column: "name", order: "asc" } });
    if (files && files.length > 30) {
      const toDelete = files.slice(0, files.length - 30).map(f => "backups/" + f.name);
      await supabase.storage.from("receipts").remove(toDelete);
    }
  } catch {}

  const sizeKB = Math.round(buf.length / 1024);

  return Response.json({
    success: !uploadErr,
    date: today,
    path,
    size_kb: sizeKB,
    tables: Object.keys(counts).length,
    total_records: totalRecords,
    error: uploadErr?.message,
  });
}

// Cron POST（Zeabur/Vercel Cron 用）
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (body.action === "backup") {
    return doBackup("manual");
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
