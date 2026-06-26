import { AggregateRoot } from "../shared/aggregate-root.js";
import { DomainError } from "../shared/domain-error.js";
import type { TenantId } from "../tenant/tenant.js";
import type { BranchId } from "../branch/branch.js";
import type { PersonId } from "../person/person.js";
import { ResourceStatus } from "./resource-status.enum.js";
import { ResourceType } from "./resource-type.enum.js";
import { createResourceCreatedEvent } from "./events/resource-created.event.js";
import { createEvent } from "../shared/create-event.js";

export type ResourceId = string & { readonly __brand: "ResourceId" };

export interface CreateResourceProps {
  id: ResourceId;
  tenantId: TenantId;
  branchId: BranchId;
  name: string;
  type: ResourceType;
  personId: PersonId | null;
}

interface ResourceState {
  tenantId: TenantId;
  branchId: BranchId;
  name: string;
  type: ResourceType;
  status: ResourceStatus;
  personId: PersonId | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Resource extends AggregateRoot<ResourceId> {
  private _state: ResourceState;

  private constructor(id: ResourceId, state: ResourceState) {
    super(id);
    this._state = state;
  }

  static create(props: CreateResourceProps): Resource {
    if (!props.name.trim())
      throw new DomainError("RESOURCE_NAME_REQUIRED", "Resource name is required.");

    const now = new Date();
    const resource = new Resource(props.id, {
      tenantId: props.tenantId,
      branchId: props.branchId,
      name: props.name.trim(),
      type: props.type,
      status: ResourceStatus.Available,
      personId: props.personId,
      createdAt: now,
      updatedAt: now,
    });

    resource.raise(
      createResourceCreatedEvent(props.id, props.tenantId, {
        name: props.name.trim(),
        type: props.type,
      }),
    );
    return resource;
  }

  get tenantId(): TenantId {
    return this._state.tenantId;
  }
  get branchId(): BranchId {
    return this._state.branchId;
  }
  get name(): string {
    return this._state.name;
  }
  get type(): ResourceType {
    return this._state.type;
  }
  get status(): ResourceStatus {
    return this._state.status;
  }
  get personId(): PersonId | null {
    return this._state.personId;
  }

  goOffline(): void {
    if (this._state.status === ResourceStatus.Offline)
      throw new DomainError("RESOURCE_ALREADY_OFFLINE", "Resource is already offline.");
    this._state.status = ResourceStatus.Offline;
    this._state.updatedAt = new Date();
    this.raise(
      createEvent("resource.went_offline", this._id, "Resource", this._state.tenantId, {}),
    );
  }

  comeOnline(): void {
    if (this._state.status !== ResourceStatus.Offline)
      throw new DomainError("RESOURCE_NOT_OFFLINE", "Resource is not offline.");
    this._state.status = ResourceStatus.Available;
    this._state.updatedAt = new Date();
    this.raise(createEvent("resource.came_online", this._id, "Resource", this._state.tenantId, {}));
  }
}
