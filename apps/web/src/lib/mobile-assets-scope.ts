import type { MobileContext } from "@/lib/mobile-context";

// Resolves which assets a mobile identity is allowed to see — only real
// existing relationships, none invented for this wave:
//   tenant_user -> all assets in tenant (route filters by tenant_id itself)
//   operator    -> operator_assignments.operator_id -> asset_id (direct link,
//                  same table Phase B already uses for operations)
//   customer    -> rental_customer_organizations -> contracts.organization_id
//                  -> contract_assets.asset_id — the purpose-built table for
//                  "which assets does this contract cover" (already used by
//                  api/contracts/[id]/assets and the customer rentals portal,
//                  lib/rentals-portal.ts). This is the correct direct link;
//                  an earlier version of this file incorrectly inferred asset
//                  visibility from scheduled operations.asset_id instead,
//                  which would miss an asset under contract with no
//                  operation scheduled yet.
export type AssetsVisibility =
  | { kind: "tenant"; tenantId: string }
  | { kind: "ids"; assetIds: string[] };

export async function resolveAssetsVisibility(
  context: MobileContext,
): Promise<AssetsVisibility | null> {
  if (context.userType === "tenant_user") {
    return { kind: "tenant", tenantId: context.tenantId };
  }

  if (context.userType === "operator") {
    const { data } = await context.db
      .from("operator_assignments")
      .select("asset_id")
      .eq("operator_id", context.operatorId)
      .not("asset_id", "is", null);
    const ids = Array.from(new Set((data ?? []).map((r) => r.asset_id as string)));
    return { kind: "ids", assetIds: ids };
  }

  if (context.userType === "customer") {
    const organizationIds = context.organizations.map((o) => o.organizationId);
    if (organizationIds.length === 0) return { kind: "ids", assetIds: [] };

    const { data: contracts } = await context.db
      .from("contracts")
      .select("id")
      .in("organization_id", organizationIds);
    const contractIds = (contracts ?? []).map((c) => c.id as string);
    if (contractIds.length === 0) return { kind: "ids", assetIds: [] };

    const { data } = await context.db
      .from("contract_assets")
      .select("asset_id")
      .in("contract_id", contractIds);
    const ids = Array.from(new Set((data ?? []).map((r) => r.asset_id as string)));
    return { kind: "ids", assetIds: ids };
  }

  return null; // unprovisioned — no assets visible at all
}
