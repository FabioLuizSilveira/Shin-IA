import { AggregateRoot } from "../shared/aggregate-root.js";
import { DomainError } from "../shared/domain-error.js";
import type { TenantId } from "../tenant/tenant.js";
import { BranchScopeMode } from "./branch-scope-mode.enum.js";
import { createBranchCreatedEvent } from "./events/branch-created.event.js";
import { createBranchDeactivatedEvent } from "./events/branch-deactivated.event.js";
import { createBranchMovedEvent } from "./events/branch-moved.event.js";

export type BranchId = string & { readonly __brand: "BranchId" };

export interface CreateBranchProps {
  id: BranchId;
  tenantId: TenantId;
  name: string;
  code: string;
  parentId: BranchId | null;
}

interface BranchState {
  tenantId: TenantId;
  name: string;
  code: string;
  parentId: BranchId | null;
  active: boolean;
  scopeMode: BranchScopeMode;
  createdAt: Date;
  updatedAt: Date;
}

export class Branch extends AggregateRoot<BranchId> {
  private _state: BranchState;

  private constructor(id: BranchId, state: BranchState) {
    super(id);
    this._state = state;
  }

  static create(props: CreateBranchProps): Branch {
    if (!props.name.trim())
      throw new DomainError("BRANCH_NAME_REQUIRED", "Branch name is required.");
    if (!props.code.trim())
      throw new DomainError("BRANCH_CODE_REQUIRED", "Branch code is required.");

    const now = new Date();
    const branch = new Branch(props.id, {
      tenantId: props.tenantId,
      name: props.name.trim(),
      code: props.code.trim().toUpperCase(),
      parentId: props.parentId,
      active: true,
      scopeMode: BranchScopeMode.Branch,
      createdAt: now,
      updatedAt: now,
    });

    branch.raise(
      createBranchCreatedEvent(props.id, props.tenantId, {
        name: props.name.trim(),
        code: props.code.trim().toUpperCase(),
        parentId: props.parentId,
      }),
    );

    return branch;
  }

  get tenantId(): TenantId {
    return this._state.tenantId;
  }
  get name(): string {
    return this._state.name;
  }
  get code(): string {
    return this._state.code;
  }
  get parentId(): BranchId | null {
    return this._state.parentId;
  }
  get active(): boolean {
    return this._state.active;
  }
  get scopeMode(): BranchScopeMode {
    return this._state.scopeMode;
  }

  deactivate(): void {
    if (!this._state.active)
      throw new DomainError("BRANCH_ALREADY_INACTIVE", "Branch is already inactive.");
    this._state.active = false;
    this._state.updatedAt = new Date();
    this.raise(createBranchDeactivatedEvent(this._id, this._state.tenantId, {}));
  }

  moveTo(newParentId: BranchId | null): void {
    if (newParentId === this._id)
      throw new DomainError("BRANCH_CIRCULAR_PARENT", "A branch cannot be its own parent.");
    const previousParentId = this._state.parentId;
    this._state.parentId = newParentId;
    this._state.updatedAt = new Date();
    this.raise(
      createBranchMovedEvent(this._id, this._state.tenantId, { previousParentId, newParentId }),
    );
  }
}
