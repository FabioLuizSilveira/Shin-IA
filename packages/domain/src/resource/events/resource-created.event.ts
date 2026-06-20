import { createEvent } from "../../shared/create-event.js";
import type { DomainEvent } from "../../shared/domain-event.interface.js";
import type { ResourceType } from "../resource-type.enum.js";

export interface ResourceCreatedPayload extends Record<string, unknown> {
  name: string;
  type: ResourceType;
}

export function createResourceCreatedEvent(
  aggregateId: string,
  tenantId: string,
  payload: ResourceCreatedPayload,
): DomainEvent<ResourceCreatedPayload> {
  return createEvent("resource.created", aggregateId, "Resource", tenantId, payload);
}
