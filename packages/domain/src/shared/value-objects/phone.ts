import { DomainError } from "../domain-error.js";

export class Phone {
  readonly value: string;
  readonly countryCode: string;

  private constructor(value: string, countryCode: string) {
    this.value = value;
    this.countryCode = countryCode;
  }

  static create(value: string, countryCode: string = "55"): Phone {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15)
      throw new DomainError("PHONE_INVALID", `"${value}" is not a valid phone number.`);
    return new Phone(digits, countryCode);
  }

  formatted(): string {
    return `+${this.countryCode}${this.value}`;
  }

  equals(other: Phone): boolean {
    return this.value === other.value && this.countryCode === other.countryCode;
  }
}
