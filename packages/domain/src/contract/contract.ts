import { AggregateRoot } from "../shared/aggregate-root.js";
import { DomainError } from "../shared/domain-error.js";
import { DateRange } from "../shared/value-objects/date-range.js";
import { Money } from "../shared/value-objects/money.js";
import type { TenantId } from "../tenant/tenant.js";
import type { OrganizationId } from "../organization/organization.js";
import { ContractStatus } from "./contract-status.enum.js";
import { ContractType } from "./contract-type.enum.js";
import { createEvent } from "../shared/create-event.js";

export type ContractId = string & { readonly __brand: "ContractId" };

export interface CreateContractProps {
  id: ContractId;
  tenantId: TenantId;
  organizationId: OrganizationId;
  type: ContractType;
  value: Money;
  period: DateRange;
}

interface ContractState {
  tenantId: TenantId;
  organizationId: OrganizationId;
  type: ContractType;
  status: ContractStatus;
  value: Money;
  period: DateRange;
  createdAt: Date;
  updatedAt: Date;
}

export class Contract extends AggregateRoot<ContractId> {
  private _state: ContractState;

  private constructor(id: ContractId, state: ContractState) {
    super(id);
    this._state = state;
  }

  static create(props: CreateContractProps): Contract {
    const now = new Date();
    const contract = new Contract(props.id, {
      ...props,
      status: ContractStatus.Draft,
      createdAt: now,
      updatedAt: now,
    });

    contract.raise(
      createEvent("contract.created", props.id, props.tenantId, props.tenantId, {
        type: props.type,
        organizationId: props.organizationId,
      }),
    );

    return contract;
  }

  get tenantId(): TenantId {
    return this._state.tenantId;
  }
  get organizationId(): OrganizationId {
    return this._state.organizationId;
  }
  get type(): ContractType {
    return this._state.type;
  }
  get status(): ContractStatus {
    return this._state.status;
  }
  get value(): Money {
    return this._state.value;
  }
  get period(): DateRange {
    return this._state.period;
  }

  activate(): void {
    if (this._state.status !== ContractStatus.Draft)
      throw new DomainError("CONTRACT_NOT_DRAFT", "Only draft contracts can be activated.");
    this._state.status = ContractStatus.Active;
    this._state.updatedAt = new Date();
    this.raise(createEvent("contract.activated", this._id, "Contract", this._state.tenantId, {}));
  }

  terminate(reason: string): void {
    if (this._state.status !== ContractStatus.Active)
      throw new DomainError("CONTRACT_NOT_ACTIVE", "Only active contracts can be terminated.");
    this._state.status = ContractStatus.Terminated;
    this._state.updatedAt = new Date();
    this.raise(
      createEvent("contract.terminated", this._id, "Contract", this._state.tenantId, { reason }),
    );
  }
}
