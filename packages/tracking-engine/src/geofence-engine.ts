import type {
  Geofence,
  GeofenceRepository,
  TrackingEvent,
  TrackingEventRepository,
  TrackingPosition,
} from "./types.js";

export interface GeofenceCheckResult {
  geofenceId: string;
  geofenceName: string;
  inside: boolean;
  wasInside: boolean;
  event: "entered" | "exited" | "inside" | "outside" | null;
}

export class GeofenceEngine {
  constructor(
    private geofences: GeofenceRepository,
    private events: TrackingEventRepository,
  ) {}

  async checkPosition(
    deviceId: string,
    tenantId: string,
    position: TrackingPosition,
    previousPosition: TrackingPosition | null,
  ): Promise<GeofenceCheckResult[]> {
    const activeGeofences = await this.geofences.findActiveByDeviceId(deviceId);
    const results: GeofenceCheckResult[] = [];

    for (const geofence of activeGeofences) {
      const inside = this.isInsideGeofence(position, geofence);
      const wasInside = previousPosition ? this.isInsideGeofence(previousPosition, geofence) : null;

      let event: GeofenceCheckResult["event"] = null;

      if (wasInside === null) {
        event = inside ? "inside" : "outside";
      } else if (!wasInside && inside) {
        event = "entered";
        await this.emitEvent("tracking.geofence_entered", deviceId, tenantId, {
          geofenceId: geofence.id,
          geofenceName: geofence.name,
          latitude: position.latitude,
          longitude: position.longitude,
        });
      } else if (wasInside && !inside) {
        event = "exited";
        await this.emitEvent("tracking.geofence_exited", deviceId, tenantId, {
          geofenceId: geofence.id,
          geofenceName: geofence.name,
          latitude: position.latitude,
          longitude: position.longitude,
        });
      } else {
        event = inside ? "inside" : "outside";
      }

      results.push({
        geofenceId: geofence.id,
        geofenceName: geofence.name,
        inside,
        wasInside: wasInside ?? false,
        event,
      });
    }

    return results;
  }

  isInsideGeofence(position: TrackingPosition, geofence: Geofence): boolean {
    if (geofence.geometry.shape === "circle") {
      return this.isInsideCircle(position, geofence.geometry);
    }
    return this.isInsidePolygon(position, geofence.geometry.coordinates);
  }

  private isInsideCircle(
    position: TrackingPosition,
    circle: Extract<Geofence["geometry"], { shape: "circle" }>,
  ): boolean {
    const distanceMeters = this.haversineDistance(
      position.latitude,
      position.longitude,
      circle.centerLat,
      circle.centerLng,
    );
    return distanceMeters <= circle.radiusMeters;
  }

  private isInsidePolygon(
    position: TrackingPosition,
    vertices: Array<{ lat: number; lng: number }>,
  ): boolean {
    // Ray casting algorithm
    let inside = false;
    const x = position.longitude;
    const y = position.latitude;

    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i]!.lng;
      const yi = vertices[i]!.lat;
      const xj = vertices[j]!.lng;
      const yj = vertices[j]!.lat;

      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }

    return inside;
  }

  haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in metres
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  private async emitEvent(
    type: TrackingEvent["type"],
    deviceId: string,
    tenantId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.events.save({
      id: crypto.randomUUID(),
      type,
      deviceId,
      tenantId,
      payload,
      occurredAt: new Date().toISOString(),
    });
  }
}
