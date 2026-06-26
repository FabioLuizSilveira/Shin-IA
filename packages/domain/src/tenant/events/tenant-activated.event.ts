import { createEvent } from "../../shared/create-event.js";
import type { DomainEvent } from "../../shared/domain-event.interface.js";

export interface TenantActivatedPayload extends Record<string, unknown> {}

export function createTenantActivatedEvent(
  aggregateId: string,
  tenantId: string,
  payload: TenantActivatedPayload,
): DomainEvent<TenantActivatedPayload> {
  return createEvent("tenant.activated", aggregateId, "Tenant", tenantId, payload);
}
