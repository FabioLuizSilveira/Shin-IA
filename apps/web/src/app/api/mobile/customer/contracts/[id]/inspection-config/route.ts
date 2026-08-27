import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";

export const dynamic = "force-dynamic";

// GET /api/mobile/customer/contracts/:id/inspection-config — tells the
// Customer Portal whether "Iniciar vistoria" should even be offered for
// this contract (tenants.customer_self_inspection_enabled) and which
// assets on the contract are eligible, without exposing the tenants
// table to the client directly. Same ownership proof as every other
// customer contract route: organization_id in the customer's own
// context.organizations.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgIds = context.organizations.map((o) => o.organizationId);
  if (orgIds.length === 0) {
    return NextResponse.json({ data: { enabled: false, assets: [] } });
  }

  const { data: contract, error: contractError } = await context.db
    .from("contracts")
    .select("id, tenant_id")
    .eq("id", id)
    .in("organization_id", orgIds)
    .maybeSingle();
  if (contractError) return internalError(contractError);
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const [{ data: tenant, error: tenantError }, { data: contractAssets, error: assetsError }] =
    await Promise.all([
      context.db
        .from("tenants")
        .select("customer_self_inspection_enabled")
        .eq("id", contract.tenant_id)
        .maybeSingle(),
      context.db
        .from("contract_assets")
        .select("assets(id, name, category)")
        .eq("contract_id", contract.id),
    ]);
  if (tenantError) return internalError(tenantError);
  if (assetsError) return internalError(assetsError);

  return NextResponse.json({
    data: {
      enabled: Boolean(tenant?.customer_self_inspection_enabled),
      assets: (contractAssets ?? []).map((r) => r.assets).filter(Boolean),
    },
  });
}
