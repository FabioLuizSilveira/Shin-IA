import { DomainError } from "../domain-error.js";

export class Coordinates {
  private constructor(
    readonly lat: number,
    readonly lng: number,
  ) {}

  static create(lat: number, lng: number): Coordinates {
    if (lat < -90 || lat > 90)
      throw new DomainError(
        "COORDINATES_INVALID_LAT",
        `Latitude ${lat} is out of range [-90, 90].`,
      );
    if (lng < -180 || lng > 180)
      throw new DomainError(
        "COORDINATES_INVALID_LNG",
        `Longitude ${lng} is out of range [-180, 180].`,
      );
    return new Coordinates(lat, lng);
  }

  distanceKmTo(other: Coordinates): number {
    const R = 6371;
    const dLat = toRad(other.lat - this.lat);
    const dLng = toRad(other.lng - this.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(this.lat)) * Math.cos(toRad(other.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  equals(other: Coordinates): boolean {
    return this.lat === other.lat && this.lng === other.lng;
  }
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
