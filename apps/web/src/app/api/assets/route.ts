import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const SELECT =
  "id, name, serial_number, category, status, branch_id, asset_type_id, asset_types(name)";

function flattenType<T extends { asset_types: { name: string } | null }>(
  row: T,
): Omit<T, "asset_types"> & { type_name?: string } {
  const { asset_types, ...rest } = row;
  return { ...rest, type_name: asset_types?.name };
}

export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("assets")
    .select(SELECT)
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error) return internalError(error);

  return NextResponse.json({
    data: (data as unknown as { asset_types: { name: string } | null }[]).map(flattenType),
  });
}

const VALID_CATEGORIES = ["vehicle", "equipment", "tool", "property", "technology"];

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  const tenantId = scope.tenantId;

  const body = (await req.json()) as {
    name?: string;
    category?: string;
    asset_type_id?: string;
    serial_number?: string;
  };

  if (
    !body.name?.trim() ||
    !body.category ||
    !VALID_CATEGORIES.includes(body.category) ||
    !body.asset_type_id
  ) {
    return NextResponse.json(
      { error: "name, category and asset_type_id are required" },
      { status: 422 },
    );
  }

  const { data: branch, error: branchError } = await scope.db
    .from("branches")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (branchError) return internalError(branchError);
  if (!branch) {
    return NextResponse.json(
      { error: "Tenant has no branch to assign this asset to" },
      { status: 422 },
    );
  }

  const { data: created, error: insertError } = await scope.db
    .from("assets")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      branch_id: branch.id,
      asset_type_id: body.asset_type_id,
      name: body.name.trim(),
      serial_number: body.serial_number?.trim() || null,
      category: body.category,
    })
    .select(SELECT)
    .single();
  if (insertError) return internalError(insertError);

  void logActivity(scope.db, {
    tenantId,
    actorId: scope.userId,
    entityType: "asset",
    entityId: created.id,
    action: "created",
    metadata: { name: body.name.trim(), category: body.category },
  });

  return NextResponse.json(
    { data: flattenType(created as unknown as { asset_types: { name: string } | null }) },
    { status: 201 },
  );
}
