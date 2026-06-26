import { describe, it, expect, vi } from "vitest";
import {
  AdapterRegistry,
  SascarAdapter,
  OmnilinkAdapter,
  TeltonikaAdapter,
  ConcoxAdapter,
  QueclinkAdapter,
  AutotracAdapter,
  PositronAdapter,
  CustomAdapter,
} from "../adapters.js";
import { GeofenceEngine } from "../geofence-engine.js";
import { TrackingRuntime } from "../tracking-runtime.js";
import type {
  Geofence,
  GeofenceRepository,
  TelemetryRepository,
  TrackingDevice,
  TrackingDeviceRepository,
  TrackingEventRepository,
  TrackingPosition,
  TrackingPositionRepository,
  TrackingProvider,
  TrackingProviderRepository,
} from "../types.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeProvider = (overrides: Partial<TrackingProvider> = {}): TrackingProvider => ({
  id: "provider-1",
  name: "teltonika",
  displayName: "Teltonika",
  tenantId: "tenant-1",
  status: "active",
  config: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeDevice = (overrides: Partial<TrackingDevice> = {}): TrackingDevice => ({
  id: "device-1",
  tenantId: "tenant-1",
  branchId: null,
  providerId: "provider-1",
  externalId: "imei-123",
  imei: "imei-123",
  serial: null,
  type: "vehicle",
  resourceId: null,
  status: "online",
  lastSeenAt: "2026-01-01T00:00:00.000Z",
  metadata: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makePosition = (overrides: Partial<TrackingPosition> = {}): TrackingPosition => ({
  id: "pos-1",
  deviceId: "device-1",
  tenantId: "tenant-1",
  latitude: -23.5505,
  longitude: -46.6333,
  altitude: null,
  speed: 60,
  heading: 90,
  accuracy: null,
  fixedAt: "2026-01-01T00:00:00.000Z",
  receivedAt: "2026-01-01T00:00:00.000Z",
  rawPayload: {},
  ...overrides,
});

const makeGeofenceCircle = (overrides: Partial<Geofence> = {}): Geofence => ({
  id: "geo-1",
  tenantId: "tenant-1",
  name: "São Paulo Centro",
  description: "",
  geometry: { shape: "circle", centerLat: -23.5505, centerLng: -46.6333, radiusMeters: 500 },
  status: "active",
  deviceIds: ["device-1"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeGeofencePolygon = (): Geofence => ({
  id: "geo-poly",
  tenantId: "tenant-1",
  name: "Polygon Zone",
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

// ─── Repo mocks ───────────────────────────────────────────────────────────────

function makeProviderRepo(
  provider: TrackingProvider | null = makeProvider(),
): TrackingProviderRepository {
  return {
    findById: vi.fn().mockResolvedValue(provider),
    findByTenantId: vi.fn().mockResolvedValue(provider ? [provider] : []),
    save: vi.fn().mockImplementation((p: TrackingProvider) => Promise.resolve(p)),
    update: vi.fn().mockImplementation((p: TrackingProvider) => Promise.resolve(p)),
  };
}

function makeDeviceRepo(device: TrackingDevice | null = makeDevice()): TrackingDeviceRepository {
  return {
    findById: vi.fn().mockResolvedValue(device),
    findByExternalId: vi.fn().mockResolvedValue(device),
    findByTenantId: vi.fn().mockResolvedValue(device ? [device] : []),
    save: vi.fn().mockImplementation((d: TrackingDevice) => Promise.resolve(d)),
    update: vi.fn().mockImplementation((d: TrackingDevice) => Promise.resolve(d)),
  };
}

function makePositionRepo(latest: TrackingPosition | null = null): TrackingPositionRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findLatestByDeviceId: vi.fn().mockResolvedValue(latest),
    findByDeviceId: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockImplementation((p: TrackingPosition) => Promise.resolve(p)),
  };
}

function makeTelemetryRepo(): TelemetryRepository {
  return {
    findByDeviceId: vi.fn().mockResolvedValue([]),
    findLatestByDeviceId: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockImplementation((t) => Promise.resolve(t)),
    saveBatch: vi.fn().mockImplementation((ts) => Promise.resolve(ts)),
  };
}

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

function makeRuntime(
  overrides: {
    providerRepo?: TrackingProviderRepository;
    deviceRepo?: TrackingDeviceRepository;
    positionRepo?: TrackingPositionRepository;
    geofenceRepo?: GeofenceRepository;
  } = {},
): { runtime: TrackingRuntime; eventRepo: TrackingEventRepository } {
  const eventRepo = makeEventRepo();
  const geofenceRepo = overrides.geofenceRepo ?? makeGeofenceRepo();
  const geofenceEngine = new GeofenceEngine(geofenceRepo, eventRepo);

  const runtime = new TrackingRuntime(
    overrides.providerRepo ?? makeProviderRepo(),
    overrides.deviceRepo ?? makeDeviceRepo(),
    overrides.positionRepo ?? makePositionRepo(),
    makeTelemetryRepo(),
    eventRepo,
    geofenceEngine,
  );

  return { runtime, eventRepo };
}

// ─── Adapter tests ────────────────────────────────────────────────────────────

describe("AdapterRegistry", () => {
  it("registers all default providers", () => {
    const registry = new AdapterRegistry();
    const providers = registry.list();
    expect(providers).toContain("sascar");
    expect(providers).toContain("omnilink");
    expect(providers).toContain("teltonika");
    expect(providers).toContain("concox");
    expect(providers).toContain("queclink");
    expect(providers).toContain("autotrac");
    expect(providers).toContain("positron");
    expect(providers).toContain("custom");
  });

  it("throws for unknown provider", () => {
    const registry = new AdapterRegistry();
    expect(() => registry.get("unknown" as never)).toThrow("no adapter registered");
  });

  it("allows registering custom adapters", () => {
    const registry = new AdapterRegistry();
    const custom = new CustomAdapter();
    registry.register(custom);
    expect(registry.has("custom")).toBe(true);
  });
});

describe("SascarAdapter", () => {
  const adapter = new SascarAdapter();

  it("normalises position from lat/lng fields", () => {
    const msg = adapter.normalise(
      {
        deviceId: "dev-1",
        lat: -23.5505,
        lng: -46.6333,
        speed: 60,
        heading: 45,
        gpsTime: "2026-01-01T00:00:00.000Z",
      },
      "2026-01-01T00:00:00.000Z",
    );
    expect(msg.externalDeviceId).toBe("dev-1");
    expect(msg.position?.latitude).toBe(-23.5505);
    expect(msg.position?.speed).toBe(60);
    expect(msg.position?.heading).toBe(45);
  });

  it("normalises position from latitude/longitude fields", () => {
    const msg = adapter.normalise({ id: "dev-2", latitude: -23.5, longitude: -46.6 }, "now");
    expect(msg.externalDeviceId).toBe("dev-2");
    expect(msg.position?.latitude).toBe(-23.5);
    expect(msg.position?.speed).toBeUndefined();
    expect(msg.position?.heading).toBeUndefined();
  });

  it("extracts ignition and odometer telemetry", () => {
    const msg = adapter.normalise(
      { deviceId: "d", ignition: true, odometer: 120000, lat: -23.5, lng: -46.6 },
      "now",
    );
    expect(msg.telemetry?.find((t) => t.key === "ignition")?.value).toBe(true);
    expect(msg.telemetry?.find((t) => t.key === "odometer")?.value).toBe(120000);
  });

  it("returns undefined telemetry when no telemetry keys", () => {
    const msg = adapter.normalise({ deviceId: "d", lat: -23.5, lng: -46.6 }, "now");
    expect(msg.telemetry).toBeUndefined();
  });

  it("returns undefined position when lat missing", () => {
    const msg = adapter.normalise({ deviceId: "d" }, "now");
    expect(msg.position).toBeUndefined();
  });
});

describe("TeltonikaAdapter", () => {
  const adapter = new TeltonikaAdapter();

  it("normalises from records array with all optional fields", () => {
    const msg = adapter.normalise(
      {
        imei: "imei-123",
        records: [
          {
            lat: -23.5,
            lon: -46.6,
            alt: 800,
            speed: 80,
            angle: 90,
            timestamp: "2026-01-01T00:00:00.000Z",
            io: { "1": 1, fuel: 75, battery: 4.2 },
          },
        ],
      },
      "2026-01-01T00:00:00.000Z",
    );
    expect(msg.externalDeviceId).toBe("imei-123");
    expect(msg.position?.latitude).toBe(-23.5);
    expect(msg.position?.altitude).toBe(800);
    expect(msg.telemetry?.find((t) => t.key === "ignition")?.value).toBe(true);
    expect(msg.telemetry?.find((t) => t.key === "fuel_level")?.value).toBe(75);
    expect(msg.telemetry?.find((t) => t.key === "battery_voltage")?.value).toBe(4.2);
  });

  it("normalises from flat payload (no records array)", () => {
    const msg = adapter.normalise(
      {
        imei: "imei-999",
        lat: -23.5,
        lon: -46.6,
        speed: 0,
        timestamp: "2026-01-01T00:00:00.000Z",
        io: {},
      },
      "2026-01-01T00:00:00.000Z",
    );
    expect(msg.position?.latitude).toBe(-23.5);
    expect(msg.position?.altitude).toBeUndefined();
    expect(msg.position?.speed).toBe(0);
    expect(msg.telemetry).toBeUndefined();
  });

  it("returns undefined position when lat missing in record", () => {
    const msg = adapter.normalise({ imei: "imei-456", records: [{ ion: 1 }] }, "now");
    expect(msg.position).toBeUndefined();
  });
});

describe("OmnilinkAdapter", () => {
  const adapter = new OmnilinkAdapter();

  it("extracts position from data sub-object", () => {
    const msg = adapter.normalise(
      { vehicleId: "v-1", data: { lat: -23.5, lng: -46.6, vel: 50, dt: "2026-01-01" } },
      "2026-01-01T00:00:00.000Z",
    );
    expect(msg.position?.latitude).toBe(-23.5);
    expect(msg.position?.speed).toBe(50);
  });

  it("extracts position from root fields when no data sub-object", () => {
    const msg = adapter.normalise(
      { vehicleId: "v-2", lat: -23.5, lng: -46.6 },
      "2026-01-01T00:00:00.000Z",
    );
    expect(msg.position?.latitude).toBe(-23.5);
    expect(msg.position?.speed).toBeUndefined();
  });

  it("returns undefined position when lat missing", () => {
    const msg = adapter.normalise({ vehicleId: "v-3" }, "now");
    expect(msg.position).toBeUndefined();
  });
});

describe("ConcoxAdapter", () => {
  const adapter = new ConcoxAdapter();

  it("extracts position from gps sub-object", () => {
    const msg = adapter.normalise(
      { imei: "i1", gps: { lat: -23.5, lng: -46.6, speed: 30 }, datetime: "2026-01-01" },
      "now",
    );
    expect(msg.position?.latitude).toBe(-23.5);
  });

  it("returns undefined position when gps missing", () => {
    const msg = adapter.normalise({ imei: "i2", device_id: "alt-id" }, "now");
    expect(msg.position).toBeUndefined();
    expect(msg.externalDeviceId).toBe("i2");
  });
});

describe("QueclinkAdapter", () => {
  const adapter = new QueclinkAdapter();

  it("extracts position with all optional fields", () => {
    const msg = adapter.normalise(
      {
        imei: "q1",
        latitude: -23.5,
        longitude: -46.6,
        speed: 40,
        course: 180,
        sendTime: "2026-01-01",
      },
      "now",
    );
    expect(msg.position?.heading).toBe(180);
    expect(msg.position?.speed).toBe(40);
  });

  it("returns undefined speed and heading when not provided", () => {
    const msg = adapter.normalise(
      { imei: "q2", latitude: -23.5, longitude: -46.6 },
      "fallback-time",
    );
    expect(msg.position?.speed).toBeUndefined();
    expect(msg.position?.heading).toBeUndefined();
    expect(msg.position?.fixedAt).toBe("fallback-time");
  });

  it("returns undefined position when latitude missing", () => {
    const msg = adapter.normalise({ imei: "q3" }, "now");
    expect(msg.position).toBeUndefined();
  });
});

describe("AutotracAdapter", () => {
  const adapter = new AutotracAdapter();

  it("extracts position from posicao sub-object", () => {
    const msg = adapter.normalise(
      { movel: "m1", posicao: { lat: -23.5, lon: -46.6, vel: 70 }, dataHora: "2026-01-01" },
      "now",
    );
    expect(msg.externalDeviceId).toBe("m1");
    expect(msg.position?.speed).toBe(70);
  });

  it("falls back to deviceId when movel missing", () => {
    const msg = adapter.normalise(
      { deviceId: "alt-device", posicao: { lat: -23.5, lon: -46.6, vel: 0 } },
      "now",
    );
    expect(msg.externalDeviceId).toBe("alt-device");
  });

  it("returns undefined position when posicao missing", () => {
    const msg = adapter.normalise({ movel: "m2" }, "now");
    expect(msg.position).toBeUndefined();
  });
});

describe("PositronAdapter", () => {
  const adapter = new PositronAdapter();

  it("extracts position from flat fields", () => {
    const msg = adapter.normalise(
      { serial: "p1", lat: -23.5, lng: -46.6, speed: 55, time: "2026-01-01" },
      "now",
    );
    expect(msg.externalDeviceId).toBe("p1");
    expect(msg.position?.speed).toBe(55);
  });

  it("falls back to device field when serial missing", () => {
    const msg = adapter.normalise({ device: "alt-p", lat: -23.5, lng: -46.6 }, "now");
    expect(msg.externalDeviceId).toBe("alt-p");
    expect(msg.position?.speed).toBeUndefined();
  });

  it("returns undefined position when lat missing", () => {
    const msg = adapter.normalise({ serial: "p2" }, "now");
    expect(msg.position).toBeUndefined();
  });
});

describe("CustomAdapter", () => {
  const adapter = new CustomAdapter();

  it("passes through canonical fields", () => {
    const msg = adapter.normalise(
      {
        deviceId: "custom-1",
        latitude: -23.5,
        longitude: -46.6,
        altitude: 800,
        speed: 30,
        heading: 270,
        fixedAt: "2026-01-01",
      },
      "now",
    );
    expect(msg.position?.altitude).toBe(800);
    expect(msg.position?.speed).toBe(30);
    expect(msg.position?.heading).toBe(270);
  });

  it("returns undefined optional fields when not provided", () => {
    const msg = adapter.normalise({ id: "alt-id", latitude: -23.5, longitude: -46.6 }, "fallback");
    expect(msg.externalDeviceId).toBe("alt-id");
    expect(msg.position?.altitude).toBeUndefined();
    expect(msg.position?.speed).toBeUndefined();
    expect(msg.position?.heading).toBeUndefined();
    expect(msg.position?.fixedAt).toBe("fallback");
  });

  it("returns undefined position when latitude missing", () => {
    const msg = adapter.normalise({ deviceId: "custom-2" }, "now");
    expect(msg.position).toBeUndefined();
  });
});

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
      // Roughly 2km apart
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

// ─── TrackingRuntime tests ────────────────────────────────────────────────────

describe("TrackingRuntime", () => {
  it("ingests message and saves position", async () => {
    const positionRepo = makePositionRepo();
    const { runtime } = makeRuntime({ positionRepo });

    const result = await runtime.ingest("teltonika", {
      imei: "imei-123",
      records: [
        { lat: -23.5505, lon: -46.6333, speed: 60, timestamp: "2026-01-01T00:00:00.000Z", io: {} },
      ],
    });

    expect(result.positionId).not.toBeNull();
    expect(result.eventsEmitted).toContain("tracking.position_received");
    expect(positionRepo.save).toHaveBeenCalledOnce();
  });

  it("emits device_online when device was offline", async () => {
    const deviceRepo = makeDeviceRepo(makeDevice({ status: "offline" }));
    const { runtime, eventRepo } = makeRuntime({ deviceRepo });

    await runtime.ingest("teltonika", {
      imei: "imei-123",
      records: [
        { lat: -23.5, lon: -46.6, speed: 0, timestamp: "2026-01-01T00:00:00.000Z", io: {} },
      ],
    });

    expect(eventRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ type: "tracking.device_online" }),
    );
  });

  it("saves telemetry readings", async () => {
    const { runtime } = makeRuntime();
    const result = await runtime.ingest("teltonika", {
      imei: "imei-123",
      records: [
        {
          lat: -23.5,
          lon: -46.6,
          speed: 0,
          timestamp: "2026-01-01T00:00:00.000Z",
          io: { "1": 1, fuel: 80 },
        },
      ],
    });

    expect(result.telemetryCount).toBeGreaterThan(0);
  });

  it("emits ignition_on when ignition telemetry is true", async () => {
    const { runtime, eventRepo } = makeRuntime();

    await runtime.ingest("teltonika", {
      imei: "imei-123",
      records: [
        { lat: -23.5, lon: -46.6, speed: 0, timestamp: "2026-01-01T00:00:00.000Z", io: { "1": 1 } },
      ],
    });

    expect(eventRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ type: "tracking.ignition_on" }),
    );
  });

  it("emits ignition_off when ignition telemetry is false", async () => {
    const { runtime, eventRepo } = makeRuntime();

    await runtime.ingest("teltonika", {
      imei: "imei-123",
      records: [
        { lat: -23.5, lon: -46.6, speed: 0, timestamp: "2026-01-01T00:00:00.000Z", io: { "1": 0 } },
      ],
    });

    expect(eventRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ type: "tracking.ignition_off" }),
    );
  });

  it("auto-provisions unknown device", async () => {
    const deviceRepo = makeDeviceRepo(null);
    const providerRepo = makeProviderRepo(makeProvider({ name: "sascar" }));
    const { runtime } = makeRuntime({ deviceRepo, providerRepo });

    const result = await runtime.ingest("sascar", {
      deviceId: "new-device",
      lat: -23.5,
      lng: -46.6,
    });

    expect(deviceRepo.save).toHaveBeenCalledOnce();
    expect(result.deviceId).toBeTruthy();
  });

  it("throws when no provider configured", async () => {
    const providerRepo = makeProviderRepo(null);
    const { runtime } = makeRuntime({ providerRepo });

    await expect(runtime.ingest("sascar", { deviceId: "d1", lat: 0, lng: 0 })).rejects.toThrow(
      "no provider configured",
    );
  });

  it("markDeviceOffline emits device_offline event", async () => {
    const { runtime, eventRepo } = makeRuntime();

    await runtime.markDeviceOffline("device-1");

    expect(eventRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ type: "tracking.device_offline" }),
    );
  });

  it("markDeviceOffline throws when device not found", async () => {
    const deviceRepo = makeDeviceRepo(null);
    const { runtime } = makeRuntime({ deviceRepo });

    await expect(runtime.markDeviceOffline("unknown")).rejects.toThrow("not found");
  });

  it("handles ingest with no position (telemetry only)", async () => {
    const providerRepo = makeProviderRepo(makeProvider({ name: "sascar" }));
    const { runtime } = makeRuntime({ providerRepo });

    const result = await runtime.ingest("sascar", {
      deviceId: "dev-1",
      ignition: false,
    });

    expect(result.positionId).toBeNull();
    expect(result.telemetryCount).toBe(1);
    expect(result.eventsEmitted).toContain("tracking.telemetry_received");
  });

  it("handles ingest with no position and no telemetry", async () => {
    const providerRepo = makeProviderRepo(makeProvider({ name: "sascar" }));
    const { runtime } = makeRuntime({ providerRepo });
    const result = await runtime.ingest("sascar", { deviceId: "dev-1" });
    expect(result.positionId).toBeNull();
    expect(result.telemetryCount).toBe(0);
  });

  it("getAdapterRegistry returns the registry", () => {
    const { runtime } = makeRuntime();
    const registry = runtime.getAdapterRegistry();
    expect(registry.has("teltonika")).toBe(true);
  });

  it("does not emit device_online when device is already online", async () => {
    const deviceRepo = makeDeviceRepo(makeDevice({ status: "online" }));
    const { runtime, eventRepo } = makeRuntime({ deviceRepo });

    await runtime.ingest("teltonika", {
      imei: "imei-123",
      records: [
        { lat: -23.5, lon: -46.6, speed: 0, timestamp: "2026-01-01T00:00:00.000Z", io: {} },
      ],
    });

    const calls = (eventRepo.save as ReturnType<typeof vi.fn>).mock.calls;
    const deviceOnlineCalls = calls.filter((c) => c[0]?.type === "tracking.device_online");
    expect(deviceOnlineCalls).toHaveLength(0);
  });
});
