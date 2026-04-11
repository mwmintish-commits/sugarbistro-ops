import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data } = await supabase.from("clients").select("*").eq("is_active", true).order("name");
  return Response.json({ data });
}

export async function POST(request) {
  const body = await request.json();
  if (body.action === "create") {
    const { name, type, contact_person, phone, email, address, tax_id, payment_terms, notes } = body;
    const { data, error } = await supabase.from("clients").insert({ name, type, contact_person, phone, email, address, tax_id, payment_terms, notes }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }
  if (body.action === "update") {
    const { client_id, ...updates } = body; delete updates.action;
    const { data } = await supabase.from("clients").update(updates).eq("id", client_id).select().single();
    return Response.json({ data });
  }
  if (body.action === "delete") {
    await supabase.from("clients").update({ is_active: false }).eq("id", body.client_id);
    return Response.json({ success: true });
  }
  return Response.json({ error: "Unknown" }, { status: 400 });
}
