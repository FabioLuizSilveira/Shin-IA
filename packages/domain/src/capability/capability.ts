import { AggregateRoot } from "../shared/aggregate-root.js";
import { DomainError } from "../shared/domain-error.js";
import type { TenantId } from "../tenant/tenant.js";
import { CapabilityScope } from "./capability-scope.enum.js";
import { createEvent } from "../shared/create-event.js";

export type CapabilityId = string & { readonly __brand: "CapabilityId" };

export interface CreateCapabilityProps {
  id: CapabilityId;
  tenantId: TenantId;
  name: string;
  key: string;
  scope: CapabilityScope;
  metadata: Record<string, unknown>;
}

interface CapabilityState {
  tenantId: TenantId;
  name: string;
  key: string;
  scope: CapabilityScope;
  metadata: Record<string, unknown>;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Capability extends AggregateRoot<CapabilityId> {
  private _state: CapabilityState;

  private constructor(id: CapabilityId, state: CapabilityState) {
    super(id);
    this._state = state;
  }

  static create(props: CreateCapabilityProps): Capability {
    if (!props.name.trim())
      throw new DomainError("CAPABILITY_NAME_REQUIRED", "Capability name is required.");
    if (!props.key.trim())
      throw new DomainError("CAPABILITY_KEY_REQUIRED", "Capability key is required.");
    if (!/^[a-z][a-z0-9._-]*$/.test(props.key))
      throw new DomainError(
        "CAPABILITY_KEY_INVALID",
        "Key must be lowercase starting with a letter.",
      );

    const now = new Date();
    const cap = new Capability(props.id, {
      tenantId: props.tenantId,
      name: props.name.trim(),
      key: props.key,
      scope: props.scope,
      metadata: props.metadata,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    cap.raise(
      createEvent("capability.created", props.id, "Capability", props.tenantId, {
        name: props.name.trim(),
        key: props.key,
        scope: props.scope,
      }),
    );
    return cap;
  }

  get tenantId(): TenantId {
    return this._state.tenantId;
  }
  get name(): string {
    return this._state.name;
  }
  get key(): string {
    return this._state.key;
  }
  get scope(): CapabilityScope {
    return this._state.scope;
  }
  get metadata(): Record<string, unknown> {
    return this._state.metadata;
  }
  get active(): boolean {
    return this._state.active;
  }

  deactivate(): void {
    if (!this._state.active)
      throw new DomainError("CAPABILITY_ALREADY_INACTIVE", "Capability is already inactive.");
    this._state.active = false;
    this._state.updatedAt = new Date();
    this.raise(
      createEvent("capability.deactivated", this._id, "Capability", this._state.tenantId, {}),
    );
  }
}
