import { createEvent } from "../../shared/create-event.js";
import type { DomainEvent } from "../../shared/domain-event.interface.js";
import type { OrganizationType } from "../organization-type.enum.js";

export interface OrganizationCreatedPayload extends Record<string, unknown> {
  name: string;
  document: string;
  type: OrganizationType;
}

export function createOrganizationCreatedEvent(
  aggregateId: string,
  tenantId: string,
  payload: OrganizationCreatedPayload,
): DomainEvent<OrganizationCreatedPayload> {
  return createEvent("organization.created", aggregateId, "Organization", tenantId, payload);
}
