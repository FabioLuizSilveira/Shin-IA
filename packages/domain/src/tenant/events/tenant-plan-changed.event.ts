import { createEvent } from "../../shared/create-event.js";
import type { DomainEvent } from "../../shared/domain-event.interface.js";
import type { TenantPlan } from "../tenant-plan.enum.js";

export interface TenantPlanChangedPayload extends Record<string, unknown> {
  previousPlan: TenantPlan;
  newPlan: TenantPlan;
}

export function createTenantPlanChangedEvent(
  aggregateId: string,
  tenantId: string,
  payload: TenantPlanChangedPayload,
): DomainEvent<TenantPlanChangedPayload> {
  return createEvent("tenant.plan_changed", aggregateId, "Tenant", tenantId, payload);
}
