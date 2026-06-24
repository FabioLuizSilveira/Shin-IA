import { createEvent } from "../../shared/create-event.js";
import type { DomainEvent } from "../../shared/domain-event.interface.js";

export interface PersonUpdatedPayload extends Record<string, unknown> {
  email: string;
}

export function createPersonUpdatedEvent(
  aggregateId: string,
  tenantId: string,
  payload: PersonUpdatedPayload,
): DomainEvent<PersonUpdatedPayload> {
  return createEvent("person.updated", aggregateId, "Person", tenantId, payload);
}
