import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Geofence,
  GeofenceRepository,
  TrackingEvent,
  TrackingEventRepository,
} from "@shina/tracking-engine";
import { createNotification } from "@/lib/notifications/create-notification";

// Adapters wiring packages/tracking-engine's GeofenceEngine (kept — see
// supabase/migrations/20260057000000_geofences.sql) against the real
// schema. "deviceId" in the package's domain maps 1:1 to resource_id here —
// there's no separate "device" concept in the live schema, resources are
// tracked directly via resource_locations.

// tenant_activity_log.actor_id has no FK — this nil UUID marks entries the
// webhook generated itself (no signed-in staff member triggered them).
const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

interface GeofenceRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  shape: "circle" | "polygon";
  center_lat: number | null;
  center_lng: number | null;
  radius_meters: number | null;
  polygon_coordinates: Array<{ lat: number; lng: number }> | null;
  resource_ids: string[];
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

function rowToGeofence(row: GeofenceRow): Geofence {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description ?? "",
    geometry:
      row.shape === "circle"
        ? {
            shape: "circle",
            centerLat: Number(row.center_lat),
            centerLng: Number(row.center_lng),
            radiusMeters: Number(row.radius_meters),
          }
        : { shape: "polygon", coordinates: row.polygon_coordinates ?? [] },
    status: row.status,
    deviceIds: row.resource_ids,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createGeofenceRepository(db: SupabaseClient, tenantId: string): GeofenceRepository {
  return {
    async findById(id) {
      const { data } = await db.from("geofences").select("*").eq("id", id).maybeSingle();
      return data ? rowToGeofence(data as GeofenceRow) : null;
    },
    async findByTenantId(tid) {
      const { data } = await db.from("geofences").select("*").eq("tenant_id", tid);
      return (data ?? []).map((row) => rowToGeofence(row as GeofenceRow));
    },
    async findActiveByDeviceId(deviceId) {
      const { data } = await db
        .from("geofences")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .contains("resource_ids", [deviceId]);
      return (data ?? []).map((row) => rowToGeofence(row as GeofenceRow));
    },
    async save(_geofence) {
      throw new Error(
        "not implemented — geofences are created via api/geofences, not this repository",
      );
    },
    async update(_geofence) {
      throw new Error(
        "not implemented — geofences are updated via api/geofences, not this repository",
      );
    },
  };
}

export function createTrackingEventRepository(
  db: SupabaseClient,
  tenantId: string,
): TrackingEventRepository {
  return {
    async save(event: TrackingEvent) {
      const geofenceId = String(event.payload.geofenceId ?? "");
      const geofenceName = String(event.payload.geofenceName ?? "cerca");
      const action = event.type === "tracking.geofence_entered" ? "entered" : "exited";

      await db.from("tenant_activity_log").insert({
        tenant_id: tenantId,
        actor_id: SYSTEM_ACTOR_ID,
        entity_type: "geofence",
        entity_id: geofenceId,
        action,
        metadata: { resource_id: event.deviceId, ...event.payload },
      });

      void createNotification({
        tenantId,
        subject:
          action === "entered"
            ? `Veículo entrou em "${geofenceName}"`
            : `Veículo saiu de "${geofenceName}"`,
        body: `Um recurso rastreado ${action === "entered" ? "entrou em" : "saiu de"} "${geofenceName}".`,
        priority: "high",
      });

      return event;
    },
    async findByDeviceId(deviceId, limit = 50) {
      const { data } = await db
        .from("tenant_activity_log")
        .select("id, action, entity_id, metadata, created_at")
        .eq("tenant_id", tenantId)
        .eq("entity_type", "geofence")
        .contains("metadata", { resource_id: deviceId })
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data ?? []).map((row) => ({
        id: row.id,
        type: (row.action === "entered"
          ? "tracking.geofence_entered"
          : "tracking.geofence_exited") as TrackingEvent["type"],
        deviceId,
        tenantId,
        payload: row.metadata as Record<string, unknown>,
        occurredAt: row.created_at,
      }));
    },
  };
}
