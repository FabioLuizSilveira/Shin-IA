import { createEvent } from "../../shared/create-event.js";
import type { DomainEvent } from "../../shared/domain-event.interface.js";
import type { AssetCategory } from "../asset-category.enum.js";

export interface AssetCreatedPayload extends Record<string, unknown> {
  name: string;
  serialNumber: string | null;
  category: AssetCategory;
}

export function createAssetCreatedEvent(
  aggregateId: string,
  tenantId: string,
  payload: AssetCreatedPayload,
): DomainEvent<AssetCreatedPayload> {
  return createEvent("asset.created", aggregateId, "Asset", tenantId, payload);
}
