import { DomainError } from "../domain-error.js";

export class Money {
  private constructor(
    readonly amount: number,
    readonly currency: string,
  ) {}

  static create(amount: number, currency: string): Money {
    if (amount < 0) throw new DomainError("MONEY_NEGATIVE", "Amount must be non-negative.");
    if (!currency || currency.trim().length !== 3)
      throw new DomainError("MONEY_INVALID_CURRENCY", "Currency must be a 3-letter ISO 4217 code.");
    return new Money(amount, currency.toUpperCase());
  }

  static zero(currency: string): Money {
    return Money.create(0, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    const result = this.amount - other.amount;
    if (result < 0)
      throw new DomainError(
        "MONEY_NEGATIVE_RESULT",
        "Subtraction would result in negative amount.",
      );
    return new Money(result, this.currency);
  }

  multiply(factor: number): Money {
    if (factor < 0)
      throw new DomainError("MONEY_NEGATIVE_FACTOR", "Multiplication factor must be non-negative.");
    return new Money(Math.round(this.amount * factor * 100) / 100, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency)
      throw new DomainError(
        "MONEY_CURRENCY_MISMATCH",
        `Cannot operate on different currencies: ${this.currency} and ${other.currency}.`,
      );
  }
}
