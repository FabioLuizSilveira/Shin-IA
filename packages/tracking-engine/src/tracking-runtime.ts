import type {
  CanonicalMessage,
  TelemetryReading,
  TelemetryRepository,
  TrackingDevice,
  TrackingDeviceRepository,
  TrackingEvent,
  TrackingEventRepository,
  TrackingPosition,
  TrackingPositionRepository,
  TrackingProviderName,
  TrackingProviderRepository,
} from "./types.js";
import { AdapterRegistry } from "./adapters.js";
import { GeofenceEngine } from "./geofence-engine.js";

export interface IngestResult {
  deviceId: string;
  positionId: string | null;
  telemetryCount: number;
  eventsEmitted: string[];
}

export class TrackingRuntime {
  private adapterRegistry: AdapterRegistry;

  constructor(
    private providers: TrackingProviderRepository,
    private devices: TrackingDeviceRepository,
    private positions: TrackingPositionRepository,
    private telemetry: TelemetryRepository,
    private events: TrackingEventRepository,
    private geofenceEngine: GeofenceEngine,
    adapterRegistry?: AdapterRegistry,
  ) {
    this.adapterRegistry = adapterRegistry ?? new AdapterRegistry();
  }

  async ingest(
    providerName: TrackingProviderName,
    rawPayload: Record<string, unknown>,
  ): Promise<IngestResult> {
    const receivedAt = new Date().toISOString();
    const adapter = this.adapterRegistry.get(providerName);
    const canonical = adapter.normalise(rawPayload, receivedAt);

    const device = await this.resolveDevice(canonical);
    const eventsEmitted: string[] = [];

    // Update device online status
    const wasOffline = device.status === "offline" || device.status === "unknown";
    if (wasOffline) {
      await this.devices.update({
        ...device,
        status: "online",
        lastSeenAt: receivedAt,
        updatedAt: receivedAt,
      });
      await this.emitEvent("tracking.device_online", device.id, device.tenantId, {
        providerId: device.providerId,
      });
      eventsEmitted.push("tracking.device_online");
    } else {
      await this.devices.update({ ...device, lastSeenAt: receivedAt, updatedAt: receivedAt });
    }

    // Persist position
    let savedPosition: TrackingPosition | null = null;
    if (canonical.position) {
      const prevPosition = await this.positions.findLatestByDeviceId(device.id);

      savedPosition = await this.positions.save({
        id: crypto.randomUUID(),
        deviceId: device.id,
        tenantId: device.tenantId,
        latitude: canonical.position.latitude,
        longitude: canonical.position.longitude,
        altitude: canonical.position.altitude ?? null,
        speed: canonical.position.speed ?? null,
        heading: canonical.position.heading ?? null,
        accuracy: canonical.position.accuracy ?? null,
        fixedAt: canonical.position.fixedAt,
        receivedAt,
        rawPayload: canonical.rawPayload,
      });

      await this.emitEvent("tracking.position_received", device.id, device.tenantId, {
        positionId: savedPosition.id,
        latitude: savedPosition.latitude,
        longitude: savedPosition.longitude,
        speed: savedPosition.speed,
      });
      eventsEmitted.push("tracking.position_received");

      // Geofence check
      await this.geofenceEngine.checkPosition(
        device.id,
        device.tenantId,
        savedPosition,
        prevPosition,
      );
    }

    // Persist telemetry
    let telemetryCount = 0;
    if (canonical.telemetry && canonical.telemetry.length > 0) {
      const readings: TelemetryReading[] = canonical.telemetry.map((t) => ({
        id: crypto.randomUUID(),
        deviceId: device.id,
        tenantId: device.tenantId,
        positionId: savedPosition?.id ?? null,
        key: t.key,
        value: t.value,
        unit: t.unit ?? null,
        measuredAt: t.measuredAt,
        receivedAt,
      }));

      await this.telemetry.saveBatch(readings);
      telemetryCount = readings.length;
      eventsEmitted.push("tracking.telemetry_received");

      // Emit ignition events
      for (const reading of readings) {
        if (reading.key === "ignition") {
          const eventType = reading.value ? "tracking.ignition_on" : "tracking.ignition_off";
          await this.emitEvent(eventType, device.id, device.tenantId, {
            positionId: savedPosition?.id ?? null,
          });
          eventsEmitted.push(eventType);
        }
      }
    }

    return {
      deviceId: device.id,
      positionId: savedPosition?.id ?? null,
      telemetryCount,
      eventsEmitted,
    };
  }

  async markDeviceOffline(deviceId: string): Promise<TrackingDevice> {
    const device = await this.devices.findById(deviceId);
    if (!device) throw new Error(`device ${deviceId} not found`);

    const now = new Date().toISOString();
    const updated = await this.devices.update({
      ...device,
      status: "offline",
      updatedAt: now,
    });

    await this.emitEvent("tracking.device_offline", device.id, device.tenantId, {
      lastSeenAt: device.lastSeenAt,
    });

    return updated;
  }

  getAdapterRegistry(): AdapterRegistry {
    return this.adapterRegistry;
  }

  private async resolveDevice(canonical: CanonicalMessage): Promise<TrackingDevice> {
    // Find provider for this provider name (use first active one)
    const providers = await this.providers.findByTenantId("*");
    const provider = providers.find((p) => p.name === canonical.providerName);

    if (!provider) {
      throw new Error(`no provider configured for: ${canonical.providerName}`);
    }

    const existing = await this.devices.findByExternalId(provider.id, canonical.externalDeviceId);

    if (existing) return existing;

    // Auto-provision unknown device
    const now = new Date().toISOString();
    return this.devices.save({
      id: crypto.randomUUID(),
      tenantId: provider.tenantId,
      branchId: null,
      providerId: provider.id,
      externalId: canonical.externalDeviceId,
      imei: null,
      serial: null,
      type: "vehicle",
      resourceId: null,
      status: "online",
      lastSeenAt: now,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });
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
