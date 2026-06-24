import { AggregateRoot } from "../shared/aggregate-root.js";
import { DomainError } from "../shared/domain-error.js";
import { DateRange } from "../shared/value-objects/date-range.js";
import type { TenantId } from "../tenant/tenant.js";
import type { BranchId } from "../branch/branch.js";
import type { ResourceId } from "../resource/resource.js";
import { OperationStatus } from "./operation-status.enum.js";
import { OperationType } from "./operation-type.enum.js";
import { createEvent } from "../shared/create-event.js";

export type OperationId = string & { readonly __brand: "OperationId" };

export interface CreateOperationProps {
  id: OperationId;
  tenantId: TenantId;
  branchId: BranchId;
  resourceId: ResourceId;
  type: OperationType;
  scheduledRange: DateRange;
}

interface OperationState {
  tenantId: TenantId;
  branchId: BranchId;
  resourceId: ResourceId;
  type: OperationType;
  status: OperationStatus;
  scheduledRange: DateRange;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Operation extends AggregateRoot<OperationId> {
  private _state: OperationState;

  private constructor(id: OperationId, state: OperationState) {
    super(id);
    this._state = state;
  }

  static create(props: CreateOperationProps): Operation {
    const now = new Date();
    const op = new Operation(props.id, {
      ...props,
      status: OperationStatus.Pending,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    op.raise(
      createEvent("operation.created", props.id, "Operation", props.tenantId, { type: props.type }),
    );
    return op;
  }

  get tenantId(): TenantId {
    return this._state.tenantId;
  }
  get branchId(): BranchId {
    return this._state.branchId;
  }
  get resourceId(): ResourceId {
    return this._state.resourceId;
  }
  get type(): OperationType {
    return this._state.type;
  }
  get status(): OperationStatus {
    return this._state.status;
  }
  get scheduledRange(): DateRange {
    return this._state.scheduledRange;
  }
  get startedAt(): Date | null {
    return this._state.startedAt;
  }
  get completedAt(): Date | null {
    return this._state.completedAt;
  }

  start(): void {
    if (this._state.status !== OperationStatus.Pending)
      throw new DomainError("OPERATION_NOT_PENDING", "Only pending operations can be started.");
    this._state.status = OperationStatus.InProgress;
    this._state.startedAt = new Date();
    this._state.updatedAt = new Date();
    this.raise(createEvent("operation.started", this._id, "Operation", this._state.tenantId, {}));
  }

  complete(): void {
    if (this._state.status !== OperationStatus.InProgress)
      throw new DomainError(
        "OPERATION_NOT_IN_PROGRESS",
        "Only in-progress operations can be completed.",
      );
    this._state.status = OperationStatus.Completed;
    this._state.completedAt = new Date();
    this._state.updatedAt = new Date();
    this.raise(createEvent("operation.completed", this._id, "Operation", this._state.tenantId, {}));
  }

  cancel(reason: string): void {
    if (
      this._state.status === OperationStatus.Completed ||
      this._state.status === OperationStatus.Cancelled
    )
      throw new DomainError(
        "OPERATION_ALREADY_TERMINAL",
        "Operation is already in a terminal state.",
      );
    this._state.status = OperationStatus.Cancelled;
    this._state.updatedAt = new Date();
    this.raise(
      createEvent("operation.cancelled", this._id, "Operation", this._state.tenantId, { reason }),
    );
  }
}
