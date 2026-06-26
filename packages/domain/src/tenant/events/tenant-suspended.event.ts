import { createEvent } from "../../shared/create-event.js";
import type { DomainEvent } from "../../shared/domain-event.interface.js";

export interface TenantSuspendedPayload extends Record<string, unknown> {
  reason: string;
}

export function createTenantSuspendedEvent(
  aggregateId: string,
  tenantId: string,
  payload: TenantSuspendedPayload,
): DomainEvent<TenantSuspendedPayload> {
  return createEvent("tenant.suspended", aggregateId, "Tenant", tenantId, payload);
}
