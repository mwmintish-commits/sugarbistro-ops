import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ Supabase 環境變數未設定");
}

export const supabase = createClient(supabaseUrl || "", supabaseKey || "");

// 月末日期：eom("2026-04") → "2026-04-30"
export function eom(m) {
  const [y, mo] = m.split("-");
  return m + "-" + String(new Date(y, mo, 0).getDate()).padStart(2, "0");
}
