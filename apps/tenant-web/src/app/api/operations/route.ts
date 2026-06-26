import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/auth/get-tenant-id";
import type { Operation, OperationType } from "@/types/domain";

export const dynamic = "force-dynamic";

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
    .from("operations")
    .select(
      `id, type, status, scheduled_starts_at, scheduled_ends_at,
       resources!inner(name, type)`,
    )
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("scheduled_starts_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const operations: Operation[] = (
    data as unknown as Array<{
      id: string;
      type: OperationType;
      status: Operation["status"];
      scheduled_starts_at: string;
      scheduled_ends_at: string;
      resources: { name: string; type: string };
    }>
  ).map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status,
    scheduled_starts_at: row.scheduled_starts_at,
    scheduled_ends_at: row.scheduled_ends_at,
    resource_name: row.resources?.name,
    resource_type: row.resources?.type,
  }));

  return NextResponse.json({ data: operations });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    type?: OperationType;
    resource_id?: string;
    scheduled_starts_at?: string;
    scheduled_ends_at?: string;
    branch_id?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, resource_id, scheduled_starts_at, scheduled_ends_at } = body;
  if (!type || !resource_id || !scheduled_starts_at || !scheduled_ends_at) {
    return NextResponse.json(
      { error: "type, resource_id, scheduled_starts_at, scheduled_ends_at are required" },
      { status: 400 },
    );
  }

  const tenantId = await getTenantId();
  const admin = createAdminClient();

  // Resolve branch_id: use provided or default branch for tenant
  let branchId = body.branch_id;
  if (!branchId) {
    const { data: branch } = await admin
      .from("branches")
      .select("id")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .limit(1)
      .single();
    branchId = (branch?.id as string | undefined) ?? undefined;
  }

  if (!branchId) {
    return NextResponse.json({ error: "No branch found for tenant" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("operations")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      branch_id: branchId,
      resource_id,
      type,
      scheduled_starts_at,
      scheduled_ends_at,
    })
    .select("id, type, status, scheduled_starts_at, scheduled_ends_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
