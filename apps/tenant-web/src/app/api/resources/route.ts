import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/auth/get-tenant-id";
import type { Resource, ResourceType, ResourceStatus } from "@/types/domain";

export const dynamic = "force-dynamic";

const DEMO_BRANCH_ID = "20000000-0000-0000-0000-000000000001";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = await getTenantId();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("resources")
    .select("id, name, type, status, branch_id, created_at")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data as Resource[] });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string; type?: ResourceType; status?: ResourceStatus };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, type, status = "available" } = body;
  if (!name || !type) {
    return NextResponse.json({ error: "name and type are required" }, { status: 400 });
  }

  const tenantId = await getTenantId();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("resources")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      branch_id: DEMO_BRANCH_ID,
      name,
      type,
      status,
    })
    .select("id, name, type, status, branch_id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: data as Resource }, { status: 201 });
}
