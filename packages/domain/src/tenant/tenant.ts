import { AggregateRoot } from "../shared/aggregate-root.js";
import { DomainError } from "../shared/domain-error.js";
import { TenantPlan } from "./tenant-plan.enum.js";
import { TenantStatus } from "./tenant-status.enum.js";
import { createTenantActivatedEvent } from "./events/tenant-activated.event.js";
import { createTenantCreatedEvent } from "./events/tenant-created.event.js";
import { createTenantPlanChangedEvent } from "./events/tenant-plan-changed.event.js";
import { createTenantSuspendedEvent } from "./events/tenant-suspended.event.js";

export type TenantId = string & { readonly __brand: "TenantId" };

export interface CreateTenantProps {
  id: TenantId;
  name: string;
  slug: string;
  plan: TenantPlan;
}

interface TenantState {
  name: string;
  slug: string;
  plan: TenantPlan;
  status: TenantStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Tenant extends AggregateRoot<TenantId> {
  private _state: TenantState;

  private constructor(id: TenantId, state: TenantState) {
    super(id);
    this._state = state;
  }

  static create(props: CreateTenantProps): Tenant {
    if (!props.name.trim())
      throw new DomainError("TENANT_NAME_REQUIRED", "Tenant name is required.");
    if (!props.slug.trim())
      throw new DomainError("TENANT_SLUG_REQUIRED", "Tenant slug is required.");
    if (!/^[a-z0-9-]+$/.test(props.slug))
      throw new DomainError(
        "TENANT_SLUG_INVALID",
        "Slug must be lowercase alphanumeric with hyphens.",
      );

    const now = new Date();
    const tenant = new Tenant(props.id, {
      name: props.name.trim(),
      slug: props.slug,
      plan: props.plan,
      status: TenantStatus.Trialing,
      createdAt: now,
      updatedAt: now,
    });

    tenant.raise(
      createTenantCreatedEvent(props.id, props.id, {
        name: props.name.trim(),
        slug: props.slug,
        plan: props.plan,
      }),
    );

    return tenant;
  }

  get name(): string {
    return this._state.name;
  }
  get slug(): string {
    return this._state.slug;
  }
  get plan(): TenantPlan {
    return this._state.plan;
  }
  get status(): TenantStatus {
    return this._state.status;
  }
  get createdAt(): Date {
    return this._state.createdAt;
  }
  get updatedAt(): Date {
    return this._state.updatedAt;
  }

  activate(): void {
    if (this._state.status === TenantStatus.Active)
      throw new DomainError("TENANT_ALREADY_ACTIVE", "Tenant is already active.");
    if (this._state.status === TenantStatus.Cancelled)
      throw new DomainError("TENANT_CANCELLED", "A cancelled tenant cannot be activated.");
    this._state.status = TenantStatus.Active;
    this._state.updatedAt = new Date();
    this.raise(createTenantActivatedEvent(this._id, this._id, {}));
  }

  suspend(reason: string): void {
    if (this._state.status === TenantStatus.Suspended)
      throw new DomainError("TENANT_ALREADY_SUSPENDED", "Tenant is already suspended.");
    if (this._state.status === TenantStatus.Cancelled)
      throw new DomainError("TENANT_CANCELLED", "A cancelled tenant cannot be suspended.");
    this._state.status = TenantStatus.Suspended;
    this._state.updatedAt = new Date();
    this.raise(createTenantSuspendedEvent(this._id, this._id, { reason }));
  }

  changePlan(newPlan: TenantPlan): void {
    const previousPlan = this._state.plan;
    if (previousPlan === newPlan)
      throw new DomainError("TENANT_PLAN_UNCHANGED", "New plan is the same as current plan.");
    this._state.plan = newPlan;
    this._state.updatedAt = new Date();
    this.raise(createTenantPlanChangedEvent(this._id, this._id, { previousPlan, newPlan }));
  }
}
