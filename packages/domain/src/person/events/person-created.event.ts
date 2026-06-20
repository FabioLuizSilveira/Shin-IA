import { createEvent } from "../../shared/create-event.js";
import type { DomainEvent } from "../../shared/domain-event.interface.js";

export interface PersonCreatedPayload extends Record<string, unknown> {
  firstName: string;
  lastName: string;
  email: string;
}

export function createPersonCreatedEvent(
  aggregateId: string,
  tenantId: string,
  payload: PersonCreatedPayload,
): DomainEvent<PersonCreatedPayload> {
  return createEvent("person.created", aggregateId, "Person", tenantId, payload);
}
