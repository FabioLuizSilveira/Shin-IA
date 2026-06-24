import { DomainError } from "../domain-error.js";

export class DateRange {
  private constructor(
    readonly from: Date,
    readonly to: Date,
  ) {}

  static create(from: Date, to: Date): DateRange {
    if (from > to)
      throw new DomainError(
        "DATE_RANGE_INVALID",
        "Start date must be before or equal to end date.",
      );
    return new DateRange(from, to);
  }

  contains(date: Date): boolean {
    return date >= this.from && date <= this.to;
  }

  overlaps(other: DateRange): boolean {
    return this.from <= other.to && this.to >= other.from;
  }

  durationDays(): number {
    const ms = this.to.getTime() - this.from.getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }

  equals(other: DateRange): boolean {
    return this.from.getTime() === other.from.getTime() && this.to.getTime() === other.to.getTime();
  }
}
