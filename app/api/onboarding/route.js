import { supabase } from "@/lib/supabase";
import { pushText } from "@/lib/line";

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return Response.json({ error: "Missing token" }, { status: 400 });
  const { data } = await supabase.from("onboarding_records").select("*").eq("token", token).single();
  if (!data) return Response.json({ error: "Invalid token" }, { status: 404 });
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "sign") {
    const { token, signature_name } = body;
    const { data, error } = await supabase.from("onboarding_records")
      .update({ handbook_read: true, signed_at: new Date().toISOString(), signature_name, status: "signed" })
      .eq("token", token).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });

    // 通知 LINE
    if (data?.line_uid) {
      await pushText(data.line_uid, `✅ 電子簽署完成！\n\n👤 ${data.name}\n🏠 ${data.store_name}\n📋 員工行為規範與工作守則\n\n歡迎加入小食糖！請等待主管為你開通帳號。`).catch(() => {});
    }

    // 通知總部
    const { data: admins } = await supabase.from("employees").select("line_uid").in("role", ["admin", "manager"]).eq("is_active", true);
    if (admins) {
      for (const a of admins) {
        if (a.line_uid) await pushText(a.line_uid, `🆕 新人報到完成\n👤 ${data.name}\n🏠 ${data.store_name}\n📋 已簽署員工守則\n\n請到後台新增員工帳號並發送綁定碼`).catch(() => {});
      }
    }

    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
