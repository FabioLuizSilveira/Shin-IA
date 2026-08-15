import type { MobileContext } from "@/lib/mobile-context";

// Resolves which operations a mobile identity is allowed to see — never
// invented, only real existing relationships:
//   customer -> rental_customer_organizations -> contracts.organization_id
//            -> tenant_contract_requirements.contract_id -> operation_id
//   operator -> operator_assignments.operator_id -> operation_id
// Both tables already exist (contract engine, Fase A/I of the previous
// session) and were simply never queried from a mobile-facing route before.
export type OperationsVisibility =
  | { kind: "tenant"; tenantId: string }
  | { kind: "ids"; operationIds: string[] };

export async function resolveOperationsVisibility(
  context: MobileContext,
): Promise<OperationsVisibility | null> {
  if (context.userType === "tenant_user") {
    return { kind: "tenant", tenantId: context.tenantId };
  }

  if (context.userType === "operator") {
    const { data } = await context.db
      .from("operator_assignments")
      .select("operation_id")
      .eq("operator_id", context.operatorId)
      .not("operation_id", "is", null);
    const ids = Array.from(new Set((data ?? []).map((r) => r.operation_id as string)));
    return { kind: "ids", operationIds: ids };
  }

  if (context.userType === "customer") {
    const organizationIds = context.organizations.map((o) => o.organizationId);
    if (organizationIds.length === 0) return { kind: "ids", operationIds: [] };

    const { data: contracts } = await context.db
      .from("contracts")
      .select("id")
      .in("organization_id", organizationIds);
    const contractIds = (contracts ?? []).map((c) => c.id as string);
    if (contractIds.length === 0) return { kind: "ids", operationIds: [] };

    const { data: requirements } = await context.db
      .from("tenant_contract_requirements")
      .select("operation_id")
      .in("contract_id", contractIds)
      .not("operation_id", "is", null);
    const ids = Array.from(new Set((requirements ?? []).map((r) => r.operation_id as string)));
    return { kind: "ids", operationIds: ids };
  }

  return null; // unprovisioned — no operations visible at all
}
