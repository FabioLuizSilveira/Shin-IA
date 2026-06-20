import { createEvent } from "../../shared/create-event.js";
import type { DomainEvent } from "../../shared/domain-event.interface.js";

export interface OrganizationUpdatedPayload extends Record<string, unknown> {
  name: string;
}

export function createOrganizationUpdatedEvent(
  aggregateId: string,
  tenantId: string,
  payload: OrganizationUpdatedPayload,
): DomainEvent<OrganizationUpdatedPayload> {
  return createEvent("organization.updated", aggregateId, "Organization", tenantId, payload);
}
