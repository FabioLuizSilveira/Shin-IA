import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { findResourceConflicts, findAssetConflicts } from "@/lib/resource-availability";

export const dynamic = "force-dynamic";

const SELECT =
  "id, type, status, scheduled_starts_at, scheduled_ends_at, resources(name, type), assets(name, category)";

// types/domain.ts#Operation declares flat resource_name/resource_type/
// asset_name/asset_category (the join above returns them nested) — flatten
// so the response matches the type the list page/DataTable already consume.
function flattenLinks<
  T extends {
    resources: { name: string; type: string } | null;
    assets: { name: string; category: string } | null;
  },
>(
  row: T,
): Omit<T, "resources" | "assets"> & {
  resource_name?: string;
  resource_type?: string;
  asset_name?: string;
  asset_category?: string;
} {
  const { resources, assets, ...rest } = row;
  return {
    ...rest,
    resource_name: resources?.name,
    resource_type: resources?.type,
    asset_name: assets?.name,
    asset_category: assets?.category,
  };
}

type OperationLinkRow = {
  resources: { name: string; type: string } | null;
  assets: { name: string; category: string } | null;
};

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
    data: (data as unknown as OperationLinkRow[]).map(flattenLinks),
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
    asset_id?: string;
    scheduled_starts_at?: string;
    scheduled_ends_at?: string;
  };

  if (
    !body.type ||
    !VALID_TYPES.includes(body.type) ||
    (!body.resource_id && !body.asset_id) ||
    !body.scheduled_starts_at ||
    !body.scheduled_ends_at
  ) {
    return NextResponse.json(
      {
        error:
          "type, one of resource_id/asset_id, scheduled_starts_at and scheduled_ends_at are required",
      },
      { status: 422 },
    );
  }

  if (new Date(body.scheduled_starts_at) >= new Date(body.scheduled_ends_at)) {
    return NextResponse.json(
      { error: "scheduled_starts_at must be before scheduled_ends_at" },
      { status: 422 },
    );
  }

  // Fleet (resource) preferred as the branch source when both are given —
  // matches which one the caller most likely means as primary.
  let branchId: string | null = null;

  if (body.resource_id) {
    const { data: resource, error: resourceError } = await scope.db
      .from("resources")
      .select("id, branch_id")
      .eq("id", body.resource_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (resourceError) return internalError(resourceError);
    if (!resource) return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    branchId = resource.branch_id;
  }

  if (body.asset_id) {
    const { data: asset, error: assetError } = await scope.db
      .from("assets")
      .select("id, branch_id")
      .eq("id", body.asset_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (assetError) return internalError(assetError);
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    branchId = branchId ?? asset.branch_id;
  }

  try {
    if (body.resource_id) {
      const conflicts = await findResourceConflicts(scope.db, {
        tenantId,
        resourceId: body.resource_id,
        startsAt: body.scheduled_starts_at,
        endsAt: body.scheduled_ends_at,
      });
      if (conflicts.length > 0) {
        return NextResponse.json(
          { error: "Resource is already booked in this time window", conflicts },
          { status: 409 },
        );
      }
    }
    if (body.asset_id) {
      const conflicts = await findAssetConflicts(scope.db, {
        tenantId,
        assetId: body.asset_id,
        startsAt: body.scheduled_starts_at,
        endsAt: body.scheduled_ends_at,
      });
      if (conflicts.length > 0) {
        return NextResponse.json(
          { error: "Asset is already booked in this time window", conflicts },
          { status: 409 },
        );
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Availability check failed" },
      { status: 500 },
    );
  }

  const { data: created, error: insertError } = await scope.db
    .from("operations")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      branch_id: branchId,
      resource_id: body.resource_id ?? null,
      asset_id: body.asset_id ?? null,
      type: body.type,
      scheduled_starts_at: body.scheduled_starts_at,
      scheduled_ends_at: body.scheduled_ends_at,
    })
    .select(SELECT)
    .single();
  if (insertError) {
    // Security fix (MÉD-10): the app-level conflict check above is racy
    // (SELECT then INSERT) — this is the real guard, GiST exclusion
    // constraints (operations_no_resource_overlap / operations_no_asset_overlap,
    // see migrations 20260063000000 / 20260066000000) that make a
    // concurrently-double-booked INSERT fail at the database. Postgres code
    // 23P01 = exclusion_violation.
    if (insertError.code === "23P01") {
      return NextResponse.json(
        { error: "Resource or asset is already booked in this time window" },
        { status: 409 },
      );
    }
    return internalError(insertError);
  }

  return NextResponse.json(
    { data: flattenLinks(created as unknown as OperationLinkRow) },
    { status: 201 },
  );
}
