import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { validateOwnership } from "@/lib/asset-owner-settlement";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["available", "in_use", "maintenance", "decommissioned"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as {
    status?: string;
    ownership_type?: string;
    owner_org_id?: string | null;
    tenant_share_pct?: number;
  };

  const { data: current, error: fetchError } = await scope.db
    .from("assets")
    .select("status")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!current) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "a valid status is required" }, { status: 422 });
    }
    if (current.status === "decommissioned") {
      return NextResponse.json(
        { error: "asset is decommissioned and cannot be changed" },
        { status: 422 },
      );
    }
    update.status = body.status;
  }

  // Ownership fields are edited independently of status — a PATCH can
  // change either, both, or neither (empty ownership fields on a
  // status-only PATCH leaves ownership untouched, same reasoning
  // validateOwnership's "own" default doesn't apply here — that default is
  // for POST /api/assets, a brand-new asset with no ownership yet).
  if (
    body.ownership_type !== undefined ||
    body.owner_org_id !== undefined ||
    body.tenant_share_pct !== undefined
  ) {
    const ownership = validateOwnership(body);
    if ("error" in ownership) {
      return NextResponse.json({ error: ownership.error }, { status: 422 });
    }
    update.ownership_type = ownership.ownership_type;
    update.owner_org_id = ownership.owner_org_id;
    update.tenant_share_pct = ownership.tenant_share_pct;
  }

  const { error: updateError } = await scope.db
    .from("assets")
    .update(update)
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (updateError) return internalError(updateError);

  return NextResponse.json({ data: { ok: true } });
}
