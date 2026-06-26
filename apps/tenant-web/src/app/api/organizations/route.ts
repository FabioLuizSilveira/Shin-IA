import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/auth/get-tenant-id";
import type { Organization } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = await getTenantId();
  const admin = createAdminClient();

  const url = new URL(req.url);
  const activeFilter = url.searchParams.get("active");

  let query = admin
    .from("organizations")
    .select("id, name, type, document, email, address_city, address_state, active, created_at")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (activeFilter === "true") {
    query = query.eq("active", true);
  } else if (activeFilter === "false") {
    query = query.eq("active", false);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data as Organization[] });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = await getTenantId();
  const admin = createAdminClient();

  const body = (await req.json()) as {
    name?: string;
    document?: string;
    type?: string;
    email?: string;
    address_city?: string;
    address_state?: string;
    address_country?: string;
  };

  const { name, document, type, email, address_city, address_state, address_country } = body;

  if (!name || !document || !type || !address_city || !address_state) {
    return NextResponse.json(
      { error: "Campos obrigatórios: name, document, type, address_city, address_state" },
      { status: 400 },
    );
  }

  const { data, error } = await admin
    .from("organizations")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      name,
      document,
      type,
      email: email ?? null,
      address_city,
      address_state,
      address_country: address_country ?? "BR",
      active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
