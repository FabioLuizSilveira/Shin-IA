import type { DomainEvent } from "./domain-event.interface.js";

export function createEvent<P extends Record<string, unknown>>(
  eventType: string,
  aggregateId: string,
  aggregateType: string,
  tenantId: string | null,
  payload: P,
): DomainEvent<P> {
  return {
    eventId: crypto.randomUUID(),
    eventType,
    occurredAt: new Date(),
    aggregateId,
    aggregateType,
    tenantId,
    version: 1,
    payload,
  };
}
