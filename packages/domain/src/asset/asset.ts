import { AggregateRoot } from "../shared/aggregate-root.js";
import { DomainError } from "../shared/domain-error.js";
import type { TenantId } from "../tenant/tenant.js";
import type { BranchId } from "../branch/branch.js";
import type { AssetTypeId } from "./asset-type.js";
import { AssetCategory } from "./asset-category.enum.js";
import { AssetStatus } from "./asset-status.enum.js";
import { createAssetCreatedEvent } from "./events/asset-created.event.js";
import { createAssetStatusChangedEvent } from "./events/asset-status-changed.event.js";

export type AssetId = string & { readonly __brand: "AssetId" };

export interface CreateAssetProps {
  id: AssetId;
  tenantId: TenantId;
  branchId: BranchId;
  assetTypeId: AssetTypeId;
  name: string;
  serialNumber: string | null;
  category: AssetCategory;
}

interface AssetState {
  tenantId: TenantId;
  branchId: BranchId;
  assetTypeId: AssetTypeId;
  name: string;
  serialNumber: string | null;
  category: AssetCategory;
  status: AssetStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Asset extends AggregateRoot<AssetId> {
  private _state: AssetState;

  private constructor(id: AssetId, state: AssetState) {
    super(id);
    this._state = state;
  }

  static create(props: CreateAssetProps): Asset {
    if (!props.name.trim()) throw new DomainError("ASSET_NAME_REQUIRED", "Asset name is required.");

    const now = new Date();
    const asset = new Asset(props.id, {
      ...props,
      name: props.name.trim(),
      status: AssetStatus.Available,
      createdAt: now,
      updatedAt: now,
    });

    asset.raise(
      createAssetCreatedEvent(props.id, props.tenantId, {
        name: props.name.trim(),
        serialNumber: props.serialNumber,
        category: props.category,
      }),
    );

    return asset;
  }

  get tenantId(): TenantId {
    return this._state.tenantId;
  }
  get branchId(): BranchId {
    return this._state.branchId;
  }
  get assetTypeId(): AssetTypeId {
    return this._state.assetTypeId;
  }
  get name(): string {
    return this._state.name;
  }
  get serialNumber(): string | null {
    return this._state.serialNumber;
  }
  get category(): AssetCategory {
    return this._state.category;
  }
  get status(): AssetStatus {
    return this._state.status;
  }

  changeStatus(newStatus: AssetStatus): void {
    const previousStatus = this._state.status;
    if (previousStatus === newStatus)
      throw new DomainError("ASSET_STATUS_UNCHANGED", "New status is the same as current status.");
    this._state.status = newStatus;
    this._state.updatedAt = new Date();
    this.raise(
      createAssetStatusChangedEvent(this._id, this._state.tenantId, { previousStatus, newStatus }),
    );
  }
}
