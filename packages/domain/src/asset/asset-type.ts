import { AggregateRoot } from "../shared/aggregate-root.js";
import { DomainError } from "../shared/domain-error.js";
import type { TenantId } from "../tenant/tenant.js";
import { AssetCategory } from "./asset-category.enum.js";
import { createEvent } from "../shared/create-event.js";

export type AssetTypeId = string & { readonly __brand: "AssetTypeId" };

export interface CreateAssetTypeProps {
  id: AssetTypeId;
  tenantId: TenantId;
  name: string;
  category: AssetCategory;
  attributes: Record<string, string>;
}

interface AssetTypeState {
  tenantId: TenantId;
  name: string;
  category: AssetCategory;
  attributes: Record<string, string>;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class AssetType extends AggregateRoot<AssetTypeId> {
  private _state: AssetTypeState;

  private constructor(id: AssetTypeId, state: AssetTypeState) {
    super(id);
    this._state = state;
  }

  static create(props: CreateAssetTypeProps): AssetType {
    if (!props.name.trim())
      throw new DomainError("ASSET_TYPE_NAME_REQUIRED", "Asset type name is required.");

    const now = new Date();
    const assetType = new AssetType(props.id, {
      tenantId: props.tenantId,
      name: props.name.trim(),
      category: props.category,
      attributes: props.attributes,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    assetType.raise(
      createEvent("asset_type.created", props.id, "AssetType", props.tenantId, {
        name: props.name.trim(),
        category: props.category,
      }),
    );

    return assetType;
  }

  get tenantId(): TenantId {
    return this._state.tenantId;
  }
  get name(): string {
    return this._state.name;
  }
  get category(): AssetCategory {
    return this._state.category;
  }
  get attributes(): Record<string, string> {
    return this._state.attributes;
  }
  get active(): boolean {
    return this._state.active;
  }

  deactivate(): void {
    if (!this._state.active)
      throw new DomainError("ASSET_TYPE_ALREADY_INACTIVE", "AssetType is already inactive.");
    this._state.active = false;
    this._state.updatedAt = new Date();
  }
}
