import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const SELECT = "id, type, status, scheduled_starts_at, scheduled_ends_at, resources(name, type)";

// types/domain.ts#Operation declares flat resource_name/resource_type (the
// join above returns them nested) — flatten so the response matches the
// type the list page/DataTable already consume.
function flattenResource<T extends { resources: { name: string; type: string } | null }>(
  row: T,
): Omit<T, "resources"> & { resource_name?: string; resource_type?: string } {
  const { resources, ...rest } = row;
  return { ...rest, resource_name: resources?.name, resource_type: resources?.type };
}

export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("operations")
    .select(SELECT)
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null)
    .order("scheduled_starts_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    data: (data as unknown as { resources: { name: string; type: string } | null }[]).map(
      flattenResource,
    ),
  });
}

const VALID_TYPES = ["delivery", "pickup", "maintenance", "inspection", "transfer"];

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  const tenantId = scope.tenantId;

  const body = (await req.json()) as {
    type?: string;
    resource_id?: string;
    scheduled_starts_at?: string;
    scheduled_ends_at?: string;
  };

  if (
    !body.type ||
    !VALID_TYPES.includes(body.type) ||
    !body.resource_id ||
    !body.scheduled_starts_at ||
    !body.scheduled_ends_at
  ) {
    return NextResponse.json(
      { error: "type, resource_id, scheduled_starts_at and scheduled_ends_at are required" },
      { status: 422 },
    );
  }

  if (new Date(body.scheduled_starts_at) >= new Date(body.scheduled_ends_at)) {
    return NextResponse.json(
      { error: "scheduled_starts_at must be before scheduled_ends_at" },
      { status: 422 },
    );
  }

  const { data: resource, error: resourceError } = await scope.db
    .from("resources")
    .select("id, branch_id")
    .eq("id", body.resource_id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (resourceError) return NextResponse.json({ error: resourceError.message }, { status: 500 });
  if (!resource) return NextResponse.json({ error: "Resource not found" }, { status: 404 });

  const { data: created, error: insertError } = await scope.db
    .from("operations")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      branch_id: resource.branch_id,
      resource_id: body.resource_id,
      type: body.type,
      scheduled_starts_at: body.scheduled_starts_at,
      scheduled_ends_at: body.scheduled_ends_at,
    })
    .select(SELECT)
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json(
    {
      data: flattenResource(
        created as unknown as { resources: { name: string; type: string } | null },
      ),
    },
    { status: 201 },
  );
}
