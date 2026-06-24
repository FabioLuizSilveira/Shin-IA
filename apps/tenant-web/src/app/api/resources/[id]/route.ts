import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getTenantId } from "@/lib/auth/get-tenant-id";
import type { ResourceDetail, ResourceStatus } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = await getTenantId();
  const admin = createAdminClient();

  const { data: resource, error } = await admin
    .from("resources")
    .select("id, name, type, status, branch_id, created_at")
    .eq("id", params.id)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .single();

  if (error || !resource) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: ops } = await admin
    .from("operations")
    .select("id, type, status, scheduled_starts_at, scheduled_ends_at")
    .eq("resource_id", params.id)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5);

  const result: ResourceDetail = {
    ...(resource as ResourceDetail),
    recent_operations: (ops ?? []) as ResourceDetail["recent_operations"],
  };

  return NextResponse.json({ data: result });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { name?: string; status?: ResourceStatus };
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) update.name = body.name;
  if (body.status !== undefined) update.status = body.status;

  const tenantId = await getTenantId();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("resources")
    .update(update)
    .eq("id", params.id)
    .eq("tenant_id", tenantId)
    .select("id, name, type, status, branch_id, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = await getTenantId();
  const admin = createAdminClient();

  const { error } = await admin
    .from("resources")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("tenant_id", tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
