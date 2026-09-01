import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["available", "busy", "offline", "suspended"];

// Etapa 10 (Tracking -> Manutenção): linking a resource to an asset here
// is what opts a GPS-tracked resource into the fleet-location webhook's
// odometer auto-sync -- see that route's own comment. assetId: null
// unlinks.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as { status?: string; assetId?: string | null };
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "a valid status is required" }, { status: 422 });
    }
    update.status = body.status;
  }

  if (body.assetId !== undefined) {
    if (body.assetId) {
      const { data: asset, error: assetError } = await scope.db
        .from("assets")
        .select("id")
        .eq("id", body.assetId)
        .eq("tenant_id", scope.tenantId)
        .maybeSingle();
      if (assetError) return internalError(assetError);
      if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    update.asset_id = body.assetId;
  }

  if (update.status === undefined && update.asset_id === undefined) {
    return NextResponse.json({ error: "status or assetId is required" }, { status: 422 });
  }

  const { error } = await scope.db
    .from("resources")
    .update(update)
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (error) return internalError(error);

  return NextResponse.json({ data: { ok: true } });
}
