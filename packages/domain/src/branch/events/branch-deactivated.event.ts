import { createEvent } from "../../shared/create-event.js";
import type { DomainEvent } from "../../shared/domain-event.interface.js";

export interface BranchDeactivatedPayload extends Record<string, unknown> {}

export function createBranchDeactivatedEvent(
  aggregateId: string,
  tenantId: string,
  payload: BranchDeactivatedPayload,
): DomainEvent<BranchDeactivatedPayload> {
  return createEvent("branch.deactivated", aggregateId, "Branch", tenantId, payload);
}
