import { createEvent } from "../../shared/create-event.js";
import type { DomainEvent } from "../../shared/domain-event.interface.js";

export interface BranchMovedPayload extends Record<string, unknown> {
  previousParentId: string | null;
  newParentId: string | null;
}

export function createBranchMovedEvent(
  aggregateId: string,
  tenantId: string,
  payload: BranchMovedPayload,
): DomainEvent<BranchMovedPayload> {
  return createEvent("branch.moved", aggregateId, "Branch", tenantId, payload);
}
