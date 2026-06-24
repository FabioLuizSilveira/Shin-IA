import type { DomainEvent } from "./domain-event.interface.js";

export abstract class AggregateRoot<TId extends string> {
  private readonly _domainEvents: DomainEvent[] = [];

  protected constructor(protected readonly _id: TId) {}

  get id(): TId {
    return this._id;
  }

  get domainEvents(): ReadonlyArray<DomainEvent> {
    return this._domainEvents;
  }

  protected raise(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  clearEvents(): void {
    this._domainEvents.length = 0;
  }

  equals(other: AggregateRoot<TId>): boolean {
    return this._id === other._id;
  }
}
