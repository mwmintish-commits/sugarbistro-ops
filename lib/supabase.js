import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ Supabase 環境變數未設定");
}

export const supabase = createClient(supabaseUrl || "", supabaseKey || "");
