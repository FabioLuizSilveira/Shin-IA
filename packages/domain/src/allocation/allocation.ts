import { AggregateRoot } from "../shared/aggregate-root.js";
import { DomainError } from "../shared/domain-error.js";
import { DateRange } from "../shared/value-objects/date-range.js";
import type { TenantId } from "../tenant/tenant.js";
import type { ResourceId } from "../resource/resource.js";
import type { AssetId } from "../asset/asset.js";
import { AllocationStatus } from "./allocation-status.enum.js";
import { createEvent } from "../shared/create-event.js";

export type AllocationId = string & { readonly __brand: "AllocationId" };

export interface CreateAllocationProps {
  id: AllocationId;
  tenantId: TenantId;
  resourceId: ResourceId;
  assetId: AssetId;
  period: DateRange;
}

interface AllocationState {
  tenantId: TenantId;
  resourceId: ResourceId;
  assetId: AssetId;
  period: DateRange;
  status: AllocationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Allocation extends AggregateRoot<AllocationId> {
  private _state: AllocationState;

  private constructor(id: AllocationId, state: AllocationState) {
    super(id);
    this._state = state;
  }

  static create(props: CreateAllocationProps): Allocation {
    const now = new Date();
    const allocation = new Allocation(props.id, {
      ...props,
      status: AllocationStatus.Reserved,
      createdAt: now,
      updatedAt: now,
    });

    allocation.raise(
      createEvent("allocation.created", props.id, "Allocation", props.tenantId, {
        resourceId: props.resourceId,
        assetId: props.assetId,
      }),
    );

    return allocation;
  }

  get tenantId(): TenantId {
    return this._state.tenantId;
  }
  get resourceId(): ResourceId {
    return this._state.resourceId;
  }
  get assetId(): AssetId {
    return this._state.assetId;
  }
  get period(): DateRange {
    return this._state.period;
  }
  get status(): AllocationStatus {
    return this._state.status;
  }

  activate(): void {
    if (this._state.status !== AllocationStatus.Reserved)
      throw new DomainError(
        "ALLOCATION_NOT_RESERVED",
        "Only reserved allocations can be activated.",
      );
    this._state.status = AllocationStatus.Active;
    this._state.updatedAt = new Date();
    this.raise(
      createEvent("allocation.activated", this._id, "Allocation", this._state.tenantId, {}),
    );
  }

  complete(): void {
    if (this._state.status !== AllocationStatus.Active)
      throw new DomainError("ALLOCATION_NOT_ACTIVE", "Only active allocations can be completed.");
    this._state.status = AllocationStatus.Completed;
    this._state.updatedAt = new Date();
    this.raise(
      createEvent("allocation.completed", this._id, "Allocation", this._state.tenantId, {}),
    );
  }

  cancel(): void {
    if (
      this._state.status === AllocationStatus.Completed ||
      this._state.status === AllocationStatus.Cancelled
    )
      throw new DomainError(
        "ALLOCATION_ALREADY_TERMINAL",
        "Allocation is already in a terminal state.",
      );
    this._state.status = AllocationStatus.Cancelled;
    this._state.updatedAt = new Date();
    this.raise(
      createEvent("allocation.cancelled", this._id, "Allocation", this._state.tenantId, {}),
    );
  }
}
