import { describe, it, expect, vi } from "vitest";
import { GeofenceEngine } from "../geofence-engine.js";
import type {
  Geofence,
  GeofenceRepository,
  TrackingEventRepository,
  TrackingPosition,
} from "../types.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makePosition = (overrides: Partial<TrackingPosition> = {}): TrackingPosition => ({
  id: "pos-1",
  deviceId: "device-1",
  tenantId: "tenant-1",
  latitude: -23.5505,
  longitude: -46.6333,
  altitude: null,
  speed: null,
  heading: null,
  accuracy: null,
  fixedAt: "2026-01-01T00:00:00.000Z",
  receivedAt: "2026-01-01T00:00:00.000Z",
  rawPayload: {},
  ...overrides,
});

const makeGeofenceCircle = (overrides: Partial<Geofence> = {}): Geofence => ({
  id: "geo-1",
  tenantId: "tenant-1",
  name: "Base",
  description: "",
  geometry: { shape: "circle", centerLat: -23.5505, centerLng: -46.6333, radiusMeters: 500 },
  status: "active",
  deviceIds: ["device-1"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeGeofencePolygon = (): Geofence => ({
  id: "geo-2",
  tenantId: "tenant-1",
  name: "Zone",
  description: "",
  geometry: {
    shape: "polygon",
    coordinates: [
      { lat: -23.54, lng: -46.64 },
      { lat: -23.54, lng: -46.62 },
      { lat: -23.56, lng: -46.62 },
      { lat: -23.56, lng: -46.64 },
    ],
  },
  status: "active",
  deviceIds: ["device-1"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

function makeGeofenceRepo(geofences: Geofence[] = []): GeofenceRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByTenantId: vi.fn().mockResolvedValue(geofences),
    findActiveByDeviceId: vi.fn().mockResolvedValue(geofences),
    save: vi.fn().mockImplementation((g: Geofence) => Promise.resolve(g)),
    update: vi.fn().mockImplementation((g: Geofence) => Promise.resolve(g)),
  };
}

function makeEventRepo(): TrackingEventRepository {
  return {
    save: vi.fn().mockImplementation((e) => Promise.resolve(e)),
    findByDeviceId: vi.fn().mockResolvedValue([]),
  };
}

// ─── GeofenceEngine tests ─────────────────────────────────────────────────────

describe("GeofenceEngine", () => {
  describe("isInsideGeofence (circle)", () => {
    it("returns true when position is inside circle", () => {
      const eventRepo = makeEventRepo();
      const engine = new GeofenceEngine(makeGeofenceRepo([makeGeofenceCircle()]), eventRepo);
      const position = makePosition({ latitude: -23.5505, longitude: -46.6333 });
      expect(engine.isInsideGeofence(position, makeGeofenceCircle())).toBe(true);
    });

    it("returns false when position is outside circle", () => {
      const engine = new GeofenceEngine(makeGeofenceRepo(), makeEventRepo());
      const position = makePosition({ latitude: -23.6, longitude: -46.7 });
      expect(engine.isInsideGeofence(position, makeGeofenceCircle())).toBe(false);
    });
  });

  describe("isInsideGeofence (polygon)", () => {
    it("returns true when inside polygon", () => {
      const engine = new GeofenceEngine(makeGeofenceRepo(), makeEventRepo());
      const position = makePosition({ latitude: -23.55, longitude: -46.63 });
      expect(engine.isInsideGeofence(position, makeGeofencePolygon())).toBe(true);
    });

    it("returns false when outside polygon", () => {
      const engine = new GeofenceEngine(makeGeofenceRepo(), makeEventRepo());
      const position = makePosition({ latitude: -24.0, longitude: -47.0 });
      expect(engine.isInsideGeofence(position, makeGeofencePolygon())).toBe(false);
    });
  });

  describe("haversineDistance", () => {
    it("returns ~0 for same point", () => {
      const engine = new GeofenceEngine(makeGeofenceRepo(), makeEventRepo());
      expect(engine.haversineDistance(-23.5505, -46.6333, -23.5505, -46.6333)).toBe(0);
    });

    it("returns reasonable distance between two São Paulo points", () => {
      const engine = new GeofenceEngine(makeGeofenceRepo(), makeEventRepo());
      const d = engine.haversineDistance(-23.5505, -46.6333, -23.5687, -46.6432);
      expect(d).toBeGreaterThan(1000);
      expect(d).toBeLessThan(5000);
    });
  });

  describe("checkPosition", () => {
    it("emits geofence_entered when crossing into geofence", async () => {
      const geo = makeGeofenceCircle();
      const geoRepo = makeGeofenceRepo([geo]);
      const eventRepo = makeEventRepo();
      const engine = new GeofenceEngine(geoRepo, eventRepo);

      const outside = makePosition({ latitude: -24.0, longitude: -47.0 });
      const inside = makePosition({ latitude: -23.5505, longitude: -46.6333 });

      const results = await engine.checkPosition("device-1", "tenant-1", inside, outside);
      expect(results[0]?.event).toBe("entered");
      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ type: "tracking.geofence_entered" }),
      );
    });

    it("emits geofence_exited when leaving geofence", async () => {
      const geo = makeGeofenceCircle();
      const eventRepo = makeEventRepo();
      const engine = new GeofenceEngine(makeGeofenceRepo([geo]), eventRepo);

      const inside = makePosition({ latitude: -23.5505, longitude: -46.6333 });
      const outside = makePosition({ latitude: -24.0, longitude: -47.0 });

      const results = await engine.checkPosition("device-1", "tenant-1", outside, inside);
      expect(results[0]?.event).toBe("exited");
    });

    it("returns inside/outside when no previous position", async () => {
      const engine = new GeofenceEngine(makeGeofenceRepo([makeGeofenceCircle()]), makeEventRepo());
      const inside = makePosition({ latitude: -23.5505, longitude: -46.6333 });
      const results = await engine.checkPosition("device-1", "tenant-1", inside, null);
      expect(results[0]?.event).toBe("inside");
    });

    it("returns outside when no previous position and device is outside", async () => {
      const engine = new GeofenceEngine(makeGeofenceRepo([makeGeofenceCircle()]), makeEventRepo());
      const outside = makePosition({ latitude: -24.0, longitude: -47.0 });
      const results = await engine.checkPosition("device-1", "tenant-1", outside, null);
      expect(results[0]?.event).toBe("outside");
    });

    it("returns inside when device stays inside geofence", async () => {
      const engine = new GeofenceEngine(makeGeofenceRepo([makeGeofenceCircle()]), makeEventRepo());
      const pos1 = makePosition({ latitude: -23.5505, longitude: -46.6333 });
      const pos2 = makePosition({ id: "pos-2", latitude: -23.5506, longitude: -46.6334 });
      const results = await engine.checkPosition("device-1", "tenant-1", pos2, pos1);
      expect(results[0]?.event).toBe("inside");
    });

    it("returns outside when device stays outside geofence", async () => {
      const engine = new GeofenceEngine(makeGeofenceRepo([makeGeofenceCircle()]), makeEventRepo());
      const pos1 = makePosition({ latitude: -24.0, longitude: -47.0 });
      const pos2 = makePosition({ id: "pos-2", latitude: -24.1, longitude: -47.1 });
      const results = await engine.checkPosition("device-1", "tenant-1", pos2, pos1);
      expect(results[0]?.event).toBe("outside");
    });

    it("returns empty array when no geofences configured", async () => {
      const engine = new GeofenceEngine(makeGeofenceRepo([]), makeEventRepo());
      const pos = makePosition();
      const results = await engine.checkPosition("device-1", "tenant-1", pos, null);
      expect(results).toHaveLength(0);
    });
  });
});
