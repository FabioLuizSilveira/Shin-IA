import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const SELECT = "id, tenant_id, key, name, asset_type_id, status, version, created_at";

// GET returns both the global catalog (tenant_id null) and the tenant's
// own templates — same "catalog + overlay" shape the RLS policies already
// enforce (idiom 5, see 20260098000000_inspection_engine.sql), the route
// just makes it explicit which is which for the Inspection Builder UI.
export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("inspection_templates")
    .select(SELECT)
    .or(`tenant_id.is.null,tenant_id.eq.${scope.tenantId}`)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error) return internalError(error);

  return NextResponse.json({
    data: (data ?? []).map((t) => ({ ...t, isGlobal: t.tenant_id === null })),
  });
}

interface CreateTemplateBody {
  key?: string;
  name?: string;
  assetTypeId?: string;
}

// POST always creates a TENANT template (tenant_id = scope.tenantId) —
// there is no route to create a global template; those only ever come
// from a migration seed (item 4 of the spec's Blueprint→Template config,
// see docs/architecture/INSPECTION_ENGINE.md Fase A §4).
export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.inspections.manage_templates"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as CreateTemplateBody;
  if (!body.key || !body.name) {
    return NextResponse.json({ error: "key and name are required" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const { error } = await scope.db.from("inspection_templates").insert({
    id,
    tenant_id: scope.tenantId,
    key: body.key,
    name: body.name,
    asset_type_id: body.assetTypeId ?? null,
    status: "draft",
    version: 1,
  });
  if (error) return internalError(error);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "inspection_template",
    entityId: id,
    action: "created",
    metadata: { key: body.key },
  });

  return NextResponse.json({ data: { id } }, { status: 201 });
}
