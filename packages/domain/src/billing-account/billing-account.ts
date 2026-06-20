import { AggregateRoot } from "../shared/aggregate-root.js";
import { DomainError } from "../shared/domain-error.js";
import { Money } from "../shared/value-objects/money.js";
import type { TenantId } from "../tenant/tenant.js";
import type { OrganizationId } from "../organization/organization.js";
import { BillingAccountStatus } from "./billing-account-status.enum.js";
import { BillingCycle } from "./billing-cycle.enum.js";
import { createEvent } from "../shared/create-event.js";

export type BillingAccountId = string & { readonly __brand: "BillingAccountId" };

export interface CreateBillingAccountProps {
  id: BillingAccountId;
  tenantId: TenantId;
  organizationId: OrganizationId;
  cycle: BillingCycle;
  creditLimit: Money;
}

interface BillingAccountState {
  tenantId: TenantId;
  organizationId: OrganizationId;
  cycle: BillingCycle;
  status: BillingAccountStatus;
  creditLimit: Money;
  balance: Money;
  createdAt: Date;
  updatedAt: Date;
}

export class BillingAccount extends AggregateRoot<BillingAccountId> {
  private _state: BillingAccountState;

  private constructor(id: BillingAccountId, state: BillingAccountState) {
    super(id);
    this._state = state;
  }

  static create(props: CreateBillingAccountProps): BillingAccount {
    const now = new Date();
    const account = new BillingAccount(props.id, {
      ...props,
      status: BillingAccountStatus.Active,
      balance: Money.create(0, props.creditLimit.currency),
      createdAt: now,
      updatedAt: now,
    });

    account.raise(
      createEvent("billing_account.created", props.id, "BillingAccount", props.tenantId, {
        organizationId: props.organizationId,
        cycle: props.cycle,
      }),
    );

    return account;
  }

  get tenantId(): TenantId {
    return this._state.tenantId;
  }
  get organizationId(): OrganizationId {
    return this._state.organizationId;
  }
  get cycle(): BillingCycle {
    return this._state.cycle;
  }
  get status(): BillingAccountStatus {
    return this._state.status;
  }
  get creditLimit(): Money {
    return this._state.creditLimit;
  }
  get balance(): Money {
    return this._state.balance;
  }

  suspend(): void {
    if (this._state.status !== BillingAccountStatus.Active)
      throw new DomainError("BILLING_ACCOUNT_NOT_ACTIVE", "Only active accounts can be suspended.");
    this._state.status = BillingAccountStatus.Suspended;
    this._state.updatedAt = new Date();
    this.raise(
      createEvent(
        "billing_account.suspended",
        this._id,
        "BillingAccount",
        this._state.tenantId,
        {},
      ),
    );
  }

  close(): void {
    if (this._state.status === BillingAccountStatus.Closed)
      throw new DomainError("BILLING_ACCOUNT_ALREADY_CLOSED", "Account is already closed.");
    this._state.status = BillingAccountStatus.Closed;
    this._state.updatedAt = new Date();
    this.raise(
      createEvent("billing_account.closed", this._id, "BillingAccount", this._state.tenantId, {}),
    );
  }

  applyCredit(amount: Money): void {
    this._state.balance = this._state.balance.add(amount);
    this._state.updatedAt = new Date();
  }
}
