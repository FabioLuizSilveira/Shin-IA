import type { MobileContext } from "@/lib/mobile-context";
import { resolveOperationsVisibility } from "@/lib/mobile-operations-scope";

// Wave 3 Phase C — resources and assets are separate, unlinked tables in
// this schema (confirmed in Wave 2 Phase C's audit: nothing connects an
// asset row to a resource_id). The only real relationship a customer or
// operator has to a trackable resource is through the operations they can
// already see (operations.resource_id) — reuses resolveOperationsVisibility
// (Wave 2 Phase B) rather than inventing a new chain. tenant_user sees every
// resource in their own tenant, same as the existing staff-only
// /api/resources/locations.
export type TrackingVisibility =
  | { kind: "tenant"; tenantId: string }
  | { kind: "ids"; resourceIds: string[] };

export async function resolveTrackingVisibility(
  context: MobileContext,
): Promise<TrackingVisibility | null> {
  if (context.userType === "tenant_user") {
    return { kind: "tenant", tenantId: context.tenantId };
  }

  if (context.userType === "customer" || context.userType === "operator") {
    const visibility = await resolveOperationsVisibility(context);
    const operationIds = visibility?.kind === "ids" ? visibility.operationIds : [];
    if (operationIds.length === 0) return { kind: "ids", resourceIds: [] };

    const { data } = await context.db
      .from("operations")
      .select("resource_id")
      .in("id", operationIds)
      .not("resource_id", "is", null);
    const ids = Array.from(new Set((data ?? []).map((r) => r.resource_id as string)));
    return { kind: "ids", resourceIds: ids };
  }

  return null; // unprovisioned — no tracking visible at all
}
