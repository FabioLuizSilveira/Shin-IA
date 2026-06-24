// ─── Provider ────────────────────────────────────────────────────────────────

export type TrackingProviderName =
  | "sascar"
  | "omnilink"
  | "autotrac"
  | "positron"
  | "teltonika"
  | "concox"
  | "queclink"
  | "custom";

export type TrackingProviderStatus = "active" | "inactive" | "error";

export interface TrackingProvider {
  id: string;
  name: TrackingProviderName;
  displayName: string;
  tenantId: string;
  status: TrackingProviderStatus;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Device ──────────────────────────────────────────────────────────────────

export type TrackingDeviceStatus = "online" | "offline" | "unknown" | "maintenance";
export type TrackingDeviceType = "vehicle" | "asset" | "person" | "container";

export interface TrackingDevice {
  id: string;
  tenantId: string;
  branchId: string | null;
  providerId: string;
  externalId: string;
  imei: string | null;
  serial: string | null;
  type: TrackingDeviceType;
  resourceId: string | null;
  status: TrackingDeviceStatus;
  lastSeenAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Position ────────────────────────────────────────────────────────────────

export interface TrackingPosition {
  id: string;
  deviceId: string;
  tenantId: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  fixedAt: string;
  receivedAt: string;
  rawPayload: Record<string, unknown>;
}

// ─── Telemetry ───────────────────────────────────────────────────────────────

export type TelemetryKey =
  | "ignition"
  | "fuel_level"
  | "odometer"
  | "engine_temp"
  | "battery_voltage"
  | "rpm"
  | "throttle"
  | "door_open"
  | "panic"
  | "tow_alert"
  | string;

export interface TelemetryReading {
  id: string;
  deviceId: string;
  tenantId: string;
  positionId: string | null;
  key: TelemetryKey;
  value: number | boolean | string;
  unit: string | null;
  measuredAt: string;
  receivedAt: string;
}

// ─── Geofence ────────────────────────────────────────────────────────────────

export type GeofenceShape = "circle" | "polygon";
export type GeofenceStatus = "active" | "inactive";

export interface GeofenceCircle {
  shape: "circle";
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
}

export interface GeofencePolygon {
  shape: "polygon";
  coordinates: Array<{ lat: number; lng: number }>;
}

export type GeofenceGeometry = GeofenceCircle | GeofencePolygon;

export interface Geofence {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  geometry: GeofenceGeometry;
  status: GeofenceStatus;
  deviceIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Tracking Events ──────────────────────────────────────────────────────────

export type TrackingEventType =
  | "tracking.position_received"
  | "tracking.ignition_on"
  | "tracking.ignition_off"
  | "tracking.geofence_entered"
  | "tracking.geofence_exited"
  | "tracking.device_online"
  | "tracking.device_offline"
  | "tracking.telemetry_received";

export interface TrackingEvent {
  id: string;
  type: TrackingEventType;
  deviceId: string;
  tenantId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

// ─── Canonical Inbound Message ────────────────────────────────────────────────

export interface CanonicalMessage {
  externalDeviceId: string;
  providerName: TrackingProviderName;
  position?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    speed?: number;
    heading?: number;
    accuracy?: number;
    fixedAt: string;
  };
  telemetry?: Array<{
    key: TelemetryKey;
    value: number | boolean | string;
    unit?: string;
    measuredAt: string;
  }>;
  rawPayload: Record<string, unknown>;
  receivedAt: string;
}

// ─── Repository interfaces ────────────────────────────────────────────────────

export interface TrackingProviderRepository {
  findById(id: string): Promise<TrackingProvider | null>;
  findByTenantId(tenantId: string): Promise<TrackingProvider[]>;
  save(provider: TrackingProvider): Promise<TrackingProvider>;
  update(provider: TrackingProvider): Promise<TrackingProvider>;
}

export interface TrackingDeviceRepository {
  findById(id: string): Promise<TrackingDevice | null>;
  findByExternalId(providerId: string, externalId: string): Promise<TrackingDevice | null>;
  findByTenantId(tenantId: string): Promise<TrackingDevice[]>;
  save(device: TrackingDevice): Promise<TrackingDevice>;
  update(device: TrackingDevice): Promise<TrackingDevice>;
}

export interface TrackingPositionRepository {
  findById(id: string): Promise<TrackingPosition | null>;
  findLatestByDeviceId(deviceId: string): Promise<TrackingPosition | null>;
  findByDeviceId(deviceId: string, limit?: number): Promise<TrackingPosition[]>;
  save(position: TrackingPosition): Promise<TrackingPosition>;
}

export interface TelemetryRepository {
  findByDeviceId(deviceId: string, key?: TelemetryKey): Promise<TelemetryReading[]>;
  findLatestByDeviceId(deviceId: string, key: TelemetryKey): Promise<TelemetryReading | null>;
  save(reading: TelemetryReading): Promise<TelemetryReading>;
  saveBatch(readings: TelemetryReading[]): Promise<TelemetryReading[]>;
}

export interface GeofenceRepository {
  findById(id: string): Promise<Geofence | null>;
  findByTenantId(tenantId: string): Promise<Geofence[]>;
  findActiveByDeviceId(deviceId: string): Promise<Geofence[]>;
  save(geofence: Geofence): Promise<Geofence>;
  update(geofence: Geofence): Promise<Geofence>;
}

export interface TrackingEventRepository {
  save(event: TrackingEvent): Promise<TrackingEvent>;
  findByDeviceId(deviceId: string, limit?: number): Promise<TrackingEvent[]>;
}
