export abstract class Entity<TId extends string> {
  protected constructor(protected readonly _id: TId) {}

  get id(): TId {
    return this._id;
  }

  equals(other: Entity<TId>): boolean {
    return this._id === other._id;
  }
}
