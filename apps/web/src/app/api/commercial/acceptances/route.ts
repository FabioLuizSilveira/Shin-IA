import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

// Contract Center data source (item 27): every acceptance this tenant has
// on file — contract + plan version + who/when — for both products, plus
// plan-change history alongside it.
export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data: acceptances, error: acceptancesError } = await scope.db
    .from("contract_acceptances")
    .select(
      "id, product, accepted_at, representative_name, representative_role, document_hash, " +
        "contract_versions(id, title, version, material_change), " +
        "plan_versions(id, name, price_cents, currency)",
    )
    .eq("tenant_id", scope.tenantId)
    .order("accepted_at", { ascending: false });
  if (acceptancesError) return internalError(acceptancesError);

  // Two FKs to plan_versions on this table (from/to) — fetched without
  // embedding to avoid PostgREST's ambiguous-relationship resolution, then
  // resolved against the same plan_versions list the UI already needs.
  const { data: planChanges, error: planChangesError } = await scope.db
    .from("plan_change_acceptances")
    .select("id, product, accepted_at, from_plan_version_id, to_plan_version_id")
    .eq("tenant_id", scope.tenantId)
    .order("accepted_at", { ascending: false });
  if (planChangesError) return internalError(planChangesError);

  return NextResponse.json({
    data: { acceptances: acceptances ?? [], planChanges: planChanges ?? [] },
  });
}
