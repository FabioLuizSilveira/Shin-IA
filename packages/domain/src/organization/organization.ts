import { AggregateRoot } from "../shared/aggregate-root.js";
import { DomainError } from "../shared/domain-error.js";
import { Address } from "../shared/value-objects/address.js";
import { Email } from "../shared/value-objects/email.js";
import { Phone } from "../shared/value-objects/phone.js";
import type { TenantId } from "../tenant/tenant.js";
import { OrganizationType } from "./organization-type.enum.js";
import { createOrganizationCreatedEvent } from "./events/organization-created.event.js";
import { createOrganizationUpdatedEvent } from "./events/organization-updated.event.js";

export type OrganizationId = string & { readonly __brand: "OrganizationId" };

export interface CreateOrganizationProps {
  id: OrganizationId;
  tenantId: TenantId;
  name: string;
  tradeName: string | null;
  document: string;
  type: OrganizationType;
  email: Email | null;
  phone: Phone | null;
  address: Address | null;
}

interface OrganizationState {
  tenantId: TenantId;
  name: string;
  tradeName: string | null;
  document: string;
  type: OrganizationType;
  email: Email | null;
  phone: Phone | null;
  address: Address | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Organization extends AggregateRoot<OrganizationId> {
  private _state: OrganizationState;

  private constructor(id: OrganizationId, state: OrganizationState) {
    super(id);
    this._state = state;
  }

  static create(props: CreateOrganizationProps): Organization {
    if (!props.name.trim())
      throw new DomainError("ORGANIZATION_NAME_REQUIRED", "Organization name is required.");
    if (!props.document.trim())
      throw new DomainError("ORGANIZATION_DOCUMENT_REQUIRED", "Document (CNPJ/CPF) is required.");

    const now = new Date();
    const org = new Organization(props.id, {
      ...props,
      name: props.name.trim(),
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    org.raise(
      createOrganizationCreatedEvent(props.id, props.tenantId, {
        name: props.name.trim(),
        document: props.document.trim(),
        type: props.type,
      }),
    );

    return org;
  }

  get tenantId(): TenantId {
    return this._state.tenantId;
  }
  get name(): string {
    return this._state.name;
  }
  get tradeName(): string | null {
    return this._state.tradeName;
  }
  get document(): string {
    return this._state.document;
  }
  get type(): OrganizationType {
    return this._state.type;
  }
  get email(): Email | null {
    return this._state.email;
  }
  get phone(): Phone | null {
    return this._state.phone;
  }
  get address(): Address | null {
    return this._state.address;
  }
  get active(): boolean {
    return this._state.active;
  }

  updateDetails(name: string, tradeName: string | null): void {
    if (!name.trim())
      throw new DomainError("ORGANIZATION_NAME_REQUIRED", "Organization name is required.");
    this._state.name = name.trim();
    this._state.tradeName = tradeName;
    this._state.updatedAt = new Date();
    this.raise(
      createOrganizationUpdatedEvent(this._id, this._state.tenantId, { name: name.trim() }),
    );
  }

  deactivate(): void {
    if (!this._state.active)
      throw new DomainError("ORGANIZATION_ALREADY_INACTIVE", "Organization is already inactive.");
    this._state.active = false;
    this._state.updatedAt = new Date();
  }
}
