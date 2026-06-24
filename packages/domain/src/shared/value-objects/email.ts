import { DomainError } from "../domain-error.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(raw: string): Email {
    const trimmed = raw.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmed))
      throw new DomainError("EMAIL_INVALID", `"${raw}" is not a valid email address.`);
    return new Email(trimmed);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
