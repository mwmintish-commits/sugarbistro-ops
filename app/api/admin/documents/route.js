import { supabase } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const employee_id = searchParams.get("employee_id");
  if (!employee_id) return Response.json({ error: "需指定員工" }, { status: 400 });
  const { data } = await supabase.from("employee_documents")
    .select("*").eq("employee_id", employee_id).order("created_at");
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === "upload") {
    const { employee_id, doc_type, file_url, signature_url, notes } = body;
    const { data, error } = await supabase.from("employee_documents").insert({
      employee_id, doc_type, file_url, signature_url,
      signed_at: signature_url ? new Date().toISOString() : null, notes
    }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  if (body.action === "delete") {
    await supabase.from("employee_documents").delete().eq("id", body.document_id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
