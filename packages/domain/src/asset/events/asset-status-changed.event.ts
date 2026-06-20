import { createEvent } from "../../shared/create-event.js";
import type { DomainEvent } from "../../shared/domain-event.interface.js";
import type { AssetStatus } from "../asset-status.enum.js";

export interface AssetStatusChangedPayload extends Record<string, unknown> {
  previousStatus: AssetStatus;
  newStatus: AssetStatus;
}

export function createAssetStatusChangedEvent(
  aggregateId: string,
  tenantId: string,
  payload: AssetStatusChangedPayload,
): DomainEvent<AssetStatusChangedPayload> {
  return createEvent("asset.status_changed", aggregateId, "Asset", tenantId, payload);
}
