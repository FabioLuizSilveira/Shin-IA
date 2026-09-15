import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findResourceConflicts,
  findAssetConflicts,
  type ResourceConflict,
} from "@/lib/resource-availability";

// WAVE 3 — Multi-Operation Business Architecture v2: Operation Runtime.
// A Trip IS an `operations` row (type="passenger_trip") — NOT a new
// aggregate with its own status lifecycle (spec section 18: "NÃO criar
// segundo lifecycle se Operation Engine já possui equivalente"). This
// reuses, unmodified: the resource_id (driver) + asset_id (vehicle) dual
// link, the scheduled_starts_at/ends_at window, the pending/in_progress/
// completed/cancelled/failed status enum, and — critically — the GiST
// exclusion constraints that make double-booking impossible even under a
// race (operations_no_resource_overlap / operations_no_asset_overlap).
// Maintenance conflicts (spec section 21) fall out of this for free: a
// maintenance-type operation on the same asset overlaps exactly like any
// other operation would, so findAssetConflicts already reports it.

export class TripConflictError extends Error {
  constructor(
    public readonly conflicts: ResourceConflict[],
    public readonly on: "vehicle" | "driver",
  ) {
    super(`${on} is already booked in this time window`);
  }
}

export interface CreateTripInput {
  tenantId: string;
  vehicleAssetId: string;
  driverResourceId?: string | null;
  scheduledStartsAt: string;
  scheduledEndsAt: string;
  routeId?: string | null;
  recurringServicePlanId?: string | null;
  customerOrganizationId?: string | null;
  passengerCount?: number | null;
}

export interface Trip {
  id: string;
  tenantId: string;
  branchId: string;
  vehicleAssetId: string | null;
  driverResourceId: string | null;
  scheduledStartsAt: string;
  scheduledEndsAt: string;
  status: string;
  metadata: Record<string, unknown>;
}

interface Row {
  id: string;
  tenant_id: string;
  branch_id: string;
  asset_id: string | null;
  resource_id: string | null;
  scheduled_starts_at: string;
  scheduled_ends_at: string;
  status: string;
  metadata: Record<string, unknown>;
}

function fromRow(r: Row): Trip {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    branchId: r.branch_id,
    vehicleAssetId: r.asset_id,
    driverResourceId: r.resource_id,
    scheduledStartsAt: r.scheduled_starts_at,
    scheduledEndsAt: r.scheduled_ends_at,
    status: r.status,
    metadata: r.metadata ?? {},
  };
}

/**
 * Creates a passenger-transport Trip. Runs the same app-level conflict
 * pre-check every other `operations` writer uses (findAssetConflicts/
 * findResourceConflicts) — advisory only, the GiST exclusion constraints
 * are the real guard against a concurrent race (23P01 below).
 */
export async function createTrip(db: SupabaseClient, input: CreateTripInput): Promise<Trip> {
  const { data: asset, error: assetError } = await db
    .from("assets")
    .select("id, branch_id")
    .eq("id", input.vehicleAssetId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (assetError) throw assetError;
  if (!asset) throw new Error("vehicle asset not found");

  let branchId: string = asset.branch_id as string;

  if (input.driverResourceId) {
    const { data: resource, error: resourceError } = await db
      .from("resources")
      .select("id, branch_id")
      .eq("id", input.driverResourceId)
      .eq("tenant_id", input.tenantId)
      .maybeSingle();
    if (resourceError) throw resourceError;
    if (!resource) throw new Error("driver resource not found");
    branchId = branchId ?? (resource.branch_id as string);
  }

  const assetConflicts = await findAssetConflicts(db, {
    tenantId: input.tenantId,
    assetId: input.vehicleAssetId,
    startsAt: input.scheduledStartsAt,
    endsAt: input.scheduledEndsAt,
  });
  if (assetConflicts.length > 0) throw new TripConflictError(assetConflicts, "vehicle");

  if (input.driverResourceId) {
    const driverConflicts = await findResourceConflicts(db, {
      tenantId: input.tenantId,
      resourceId: input.driverResourceId,
      startsAt: input.scheduledStartsAt,
      endsAt: input.scheduledEndsAt,
    });
    if (driverConflicts.length > 0) throw new TripConflictError(driverConflicts, "driver");
  }

  const { data, error } = await db
    .from("operations")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: input.tenantId,
      branch_id: branchId,
      asset_id: input.vehicleAssetId,
      resource_id: input.driverResourceId ?? null,
      type: "passenger_trip",
      scheduled_starts_at: input.scheduledStartsAt,
      scheduled_ends_at: input.scheduledEndsAt,
      metadata: {
        routeId: input.routeId ?? null,
        recurringServicePlanId: input.recurringServicePlanId ?? null,
        customerOrganizationId: input.customerOrganizationId ?? null,
        passengerCount: input.passengerCount ?? null,
      },
    })
    .select(
      "id, tenant_id, branch_id, asset_id, resource_id, scheduled_starts_at, scheduled_ends_at, status, metadata",
    )
    .single();
  if (error) {
    // Same race-safety pattern as api/operations/route.ts: the app-level
    // check above is a SELECT-then-INSERT race; 23P01 (exclusion_violation)
    // from the GiST constraints is the real guard.
    if (error.code === "23P01") {
      throw new TripConflictError([], "vehicle");
    }
    throw error;
  }
  if (!data) throw new Error("failed to create trip");
  return fromRow(data as Row);
}
