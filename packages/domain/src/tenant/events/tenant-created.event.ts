import { createEvent } from "../../shared/create-event.js";
import type { DomainEvent } from "../../shared/domain-event.interface.js";
import type { TenantPlan } from "../tenant-plan.enum.js";

export interface TenantCreatedPayload extends Record<string, unknown> {
  name: string;
  slug: string;
  plan: TenantPlan;
}

export function createTenantCreatedEvent(
  aggregateId: string,
  tenantId: string,
  payload: TenantCreatedPayload,
): DomainEvent<TenantCreatedPayload> {
  return createEvent("tenant.created", aggregateId, "Tenant", tenantId, payload);
}
