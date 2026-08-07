import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { findResourceConflicts } from "@/lib/resource-availability";

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
  if (error) return internalError(error);

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
  if (resourceError) return internalError(resourceError);
  if (!resource) return NextResponse.json({ error: "Resource not found" }, { status: 404 });

  let conflicts;
  try {
    conflicts = await findResourceConflicts(scope.db, {
      tenantId,
      resourceId: body.resource_id,
      startsAt: body.scheduled_starts_at,
      endsAt: body.scheduled_ends_at,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Availability check failed" },
      { status: 500 },
    );
  }
  if (conflicts.length > 0) {
    return NextResponse.json(
      {
        error: "Resource is already booked in this time window",
        conflicts,
      },
      { status: 409 },
    );
  }

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
  if (insertError) {
    // Security fix (MÉD-10): the app-level conflict check above is racy
    // (SELECT then INSERT) — this is the real guard, a GiST exclusion
    // constraint (operations_no_resource_overlap, see migration
    // 20260063000000) that makes a concurrently-double-booked INSERT fail
    // at the database. Postgres code 23P01 = exclusion_violation.
    if (insertError.code === "23P01") {
      return NextResponse.json(
        { error: "Resource is already booked in this time window" },
        { status: 409 },
      );
    }
    return internalError(insertError);
  }

  return NextResponse.json(
    {
      data: flattenResource(
        created as unknown as { resources: { name: string; type: string } | null },
      ),
    },
    { status: 201 },
  );
}
