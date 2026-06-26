import { createEvent } from "../../shared/create-event.js";
import type { DomainEvent } from "../../shared/domain-event.interface.js";

export interface BranchCreatedPayload extends Record<string, unknown> {
  name: string;
  code: string;
  parentId: string | null;
}

export function createBranchCreatedEvent(
  aggregateId: string,
  tenantId: string,
  payload: BranchCreatedPayload,
): DomainEvent<BranchCreatedPayload> {
  return createEvent("branch.created", aggregateId, "Branch", tenantId, payload);
}
