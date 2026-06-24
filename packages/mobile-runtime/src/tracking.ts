import type { TrackingEvent, TrackingEventType } from "./types.js";

export interface RouteSegment {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  distanceKm: number;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class TrackingEngine {
  private readonly events: TrackingEvent[] = [];

  recordEvent(event: TrackingEvent): void {
    this.events.push({ ...event });
  }

  getEventHistory(tenantId: string, userId?: string): TrackingEvent[] {
    return this.events.filter(
      (e) => e.tenantId === tenantId && (userId === undefined || e.userId === userId),
    );
  }

  filterByType(type: TrackingEventType): TrackingEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  filterByAsset(assetId: string): TrackingEvent[] {
    return this.events.filter((e) => e.assetId === assetId);
  }

  computeRoute(userId: string, tenantId: string): RouteSegment[] {
    const locationEvents = this.events
      .filter((e) => e.tenantId === tenantId && e.userId === userId && e.type === "location")
      .filter((e) => e.latitude !== undefined && e.longitude !== undefined)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const segments: RouteSegment[] = [];
    for (let i = 1; i < locationEvents.length; i++) {
      const prev = locationEvents[i - 1]!;
      const curr = locationEvents[i]!;
      segments.push({
        from: { lat: prev.latitude!, lng: prev.longitude! },
        to: { lat: curr.latitude!, lng: curr.longitude! },
        distanceKm: haversineKm(prev.latitude!, prev.longitude!, curr.latitude!, curr.longitude!),
      });
    }
    return segments;
  }

  getTotalDistance(userId: string, tenantId: string): number {
    const segments = this.computeRoute(userId, tenantId);
    return segments.reduce((sum, s) => sum + s.distanceKm, 0);
  }

  clearHistory(tenantId: string): void {
    const toRemove = this.events.filter((e) => e.tenantId === tenantId);
    for (const e of toRemove) {
      const idx = this.events.indexOf(e);
      if (idx !== -1) this.events.splice(idx, 1);
    }
  }

  count(): number {
    return this.events.length;
  }
}
