import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

// Read-only history of owner settlements for one asset — see
// lib/asset-owner-settlement.ts for how these rows get created.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("asset_owner_settlements")
    .select("id, gross_amount, tenant_share_pct, tenant_amount, owner_amount, currency, created_at")
    .eq("asset_id", id)
    .eq("tenant_id", scope.tenantId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return internalError(error);

  return NextResponse.json({ data: data ?? [] });
}
