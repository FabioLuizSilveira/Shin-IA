import { AggregateRoot } from "../shared/aggregate-root.js";
import { DomainError } from "../shared/domain-error.js";
import { Email } from "../shared/value-objects/email.js";
import { Phone } from "../shared/value-objects/phone.js";
import type { TenantId } from "../tenant/tenant.js";
import { PersonStatus } from "./person-status.enum.js";
import { createPersonCreatedEvent } from "./events/person-created.event.js";
import { createPersonUpdatedEvent } from "./events/person-updated.event.js";

export type PersonId = string & { readonly __brand: "PersonId" };

export interface CreatePersonProps {
  id: PersonId;
  tenantId: TenantId;
  firstName: string;
  lastName: string;
  email: Email;
  phone: Phone | null;
  document: string | null;
}

interface PersonState {
  tenantId: TenantId;
  firstName: string;
  lastName: string;
  email: Email;
  phone: Phone | null;
  document: string | null;
  status: PersonStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Person extends AggregateRoot<PersonId> {
  private _state: PersonState;

  private constructor(id: PersonId, state: PersonState) {
    super(id);
    this._state = state;
  }

  static create(props: CreatePersonProps): Person {
    if (!props.firstName.trim())
      throw new DomainError("PERSON_FIRST_NAME_REQUIRED", "First name is required.");
    if (!props.lastName.trim())
      throw new DomainError("PERSON_LAST_NAME_REQUIRED", "Last name is required.");

    const now = new Date();
    const person = new Person(props.id, {
      tenantId: props.tenantId,
      firstName: props.firstName.trim(),
      lastName: props.lastName.trim(),
      email: props.email,
      phone: props.phone,
      document: props.document,
      status: PersonStatus.Active,
      createdAt: now,
      updatedAt: now,
    });

    person.raise(
      createPersonCreatedEvent(props.id, props.tenantId, {
        firstName: props.firstName.trim(),
        lastName: props.lastName.trim(),
        email: props.email.value,
      }),
    );

    return person;
  }

  get tenantId(): TenantId {
    return this._state.tenantId;
  }
  get firstName(): string {
    return this._state.firstName;
  }
  get lastName(): string {
    return this._state.lastName;
  }
  get fullName(): string {
    return `${this._state.firstName} ${this._state.lastName}`;
  }
  get email(): Email {
    return this._state.email;
  }
  get phone(): Phone | null {
    return this._state.phone;
  }
  get document(): string | null {
    return this._state.document;
  }
  get status(): PersonStatus {
    return this._state.status;
  }

  updateContact(email: Email, phone: Phone | null): void {
    this._state.email = email;
    this._state.phone = phone;
    this._state.updatedAt = new Date();
    this.raise(createPersonUpdatedEvent(this._id, this._state.tenantId, { email: email.value }));
  }

  block(): void {
    if (this._state.status === PersonStatus.Blocked)
      throw new DomainError("PERSON_ALREADY_BLOCKED", "Person is already blocked.");
    this._state.status = PersonStatus.Blocked;
    this._state.updatedAt = new Date();
  }
}
