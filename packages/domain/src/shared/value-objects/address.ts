import { DomainError } from "../domain-error.js";

export interface AddressProps {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export class Address {
  readonly street: string;
  readonly number: string;
  readonly complement: string | null;
  readonly neighborhood: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;

  private constructor(props: AddressProps) {
    this.street = props.street;
    this.number = props.number;
    this.complement = props.complement ?? null;
    this.neighborhood = props.neighborhood;
    this.city = props.city;
    this.state = props.state;
    this.postalCode = props.postalCode.replace(/\D/g, "");
    this.country = props.country;
  }

  static create(props: AddressProps): Address {
    if (!props.street.trim())
      throw new DomainError("ADDRESS_STREET_REQUIRED", "Street is required.");
    if (!props.city.trim()) throw new DomainError("ADDRESS_CITY_REQUIRED", "City is required.");
    if (!props.postalCode.trim())
      throw new DomainError("ADDRESS_POSTAL_CODE_REQUIRED", "Postal code is required.");
    return new Address(props);
  }

  equals(other: Address): boolean {
    return (
      this.street === other.street &&
      this.number === other.number &&
      this.city === other.city &&
      this.state === other.state &&
      this.postalCode === other.postalCode &&
      this.country === other.country
    );
  }
}
