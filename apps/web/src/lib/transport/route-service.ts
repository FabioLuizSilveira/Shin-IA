import type { SupabaseClient } from "@supabase/supabase-js";

// WAVE 3 — Multi-Operation Business Architecture v2: Operation Runtime.
// A Route is a reusable origin/destination(+stops) definition (spec section
// 17) — NOT a GPS trace (tracking-engine's GeofenceEngine owns that).
// Reused by one-off trips and by RecurringServicePlan instances alike.

export interface GeoPoint {
  label: string;
  lat?: number;
  lng?: number;
}

export interface RouteInput {
  tenantId: string;
  operationProfileId?: string | null;
  name?: string | null;
  origin: GeoPoint;
  destination: GeoPoint;
  stops?: GeoPoint[];
  estimatedDistanceKm?: number | null;
  estimatedDurationMinutes?: number | null;
}

export interface Route {
  id: string;
  tenantId: string;
  operationProfileId: string | null;
  name: string | null;
  origin: GeoPoint;
  destination: GeoPoint;
  stops: GeoPoint[];
  estimatedDistanceKm: number | null;
  estimatedDurationMinutes: number | null;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

interface Row {
  id: string;
  tenant_id: string;
  operation_profile_id: string | null;
  name: string | null;
  origin: GeoPoint;
  destination: GeoPoint;
  stops: GeoPoint[];
  estimated_distance_km: number | null;
  estimated_duration_minutes: number | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

function fromRow(r: Row): Route {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    operationProfileId: r.operation_profile_id,
    name: r.name,
    origin: r.origin,
    destination: r.destination,
    stops: r.stops ?? [],
    estimatedDistanceKm: r.estimated_distance_km,
    estimatedDurationMinutes: r.estimated_duration_minutes,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function createRoute(db: SupabaseClient, input: RouteInput): Promise<Route> {
  const { data, error } = await db
    .from("routes")
    .insert({
      tenant_id: input.tenantId,
      operation_profile_id: input.operationProfileId ?? null,
      name: input.name ?? null,
      origin: input.origin,
      destination: input.destination,
      stops: input.stops ?? [],
      estimated_distance_km: input.estimatedDistanceKm ?? null,
      estimated_duration_minutes: input.estimatedDurationMinutes ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("failed to create route");
  return fromRow(data as Row);
}

export async function listRoutes(db: SupabaseClient, tenantId: string): Promise<Route[]> {
  const { data, error } = await db
    .from("routes")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Row[]).map(fromRow);
}

export async function getRoute(
  db: SupabaseClient,
  tenantId: string,
  routeId: string,
): Promise<Route | null> {
  const { data, error } = await db
    .from("routes")
    .select("*")
    .eq("id", routeId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as Row) : null;
}
