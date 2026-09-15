import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findResourceConflicts,
  findAssetConflicts,
  type ResourceConflict,
} from "@/lib/resource-availability";

// Water-tank-truck's own dispatch runtime — same "wave 2" treatment as
// towing-service.ts's Service Request. A water tank service request IS an
// operations row (type="water_tank_service_request"): same resource_id
// (operator) + asset_id (water tank truck) dual link, same GiST
// double-booking guards, same status lifecycle.
//
// Unlike towing (matched by fleet-type tag only — a tow truck either is
// or isn't one), a water-tank dispatch cares about CAPACITY: how many
// liters the customer needs vs. how many the truck holds
// (metadata.capacityLiters, matched via resource-matching.ts's
// matchVehiclesByCapacityField — the same generic function water/bulk
// material transport already reuses, not a third near-duplicate).

export class WaterTankConflictError extends Error {
  constructor(
    public readonly conflicts: ResourceConflict[],
    public readonly on: "vehicle" | "operator",
  ) {
    super(`${on} is already booked in this time window`);
  }
}

export interface CreateWaterTankServiceRequestInput {
  tenantId: string;
  waterTankAssetId: string;
  operatorResourceId?: string | null;
  scheduledStartsAt: string;
  scheduledEndsAt: string;
  deliveryLocation?: string | null;
  litersRequested?: number | null;
  description?: string | null;
  customerOrganizationId?: string | null;
}

export interface WaterTankServiceRequest {
  id: string;
  tenantId: string;
  branchId: string;
  waterTankAssetId: string | null;
  operatorResourceId: string | null;
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

function fromRow(r: Row): WaterTankServiceRequest {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    branchId: r.branch_id,
    waterTankAssetId: r.asset_id,
    operatorResourceId: r.resource_id,
    scheduledStartsAt: r.scheduled_starts_at,
    scheduledEndsAt: r.scheduled_ends_at,
    status: r.status,
    metadata: r.metadata ?? {},
  };
}

/**
 * Creates a water-tank Service Request. Same app-level pre-check + DB-level
 * GiST exclusion race guard as trip-service.ts/towing-service.ts — a
 * maintenance operation on the same truck already blocks this for free.
 */
export async function createWaterTankServiceRequest(
  db: SupabaseClient,
  input: CreateWaterTankServiceRequestInput,
): Promise<WaterTankServiceRequest> {
  const { data: asset, error: assetError } = await db
    .from("assets")
    .select("id, branch_id")
    .eq("id", input.waterTankAssetId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (assetError) throw assetError;
  if (!asset) throw new Error("water tank truck asset not found");

  let branchId: string = asset.branch_id as string;

  if (input.operatorResourceId) {
    const { data: resource, error: resourceError } = await db
      .from("resources")
      .select("id, branch_id")
      .eq("id", input.operatorResourceId)
      .eq("tenant_id", input.tenantId)
      .maybeSingle();
    if (resourceError) throw resourceError;
    if (!resource) throw new Error("operator resource not found");
    branchId = branchId ?? (resource.branch_id as string);
  }

  const vehicleConflicts = await findAssetConflicts(db, {
    tenantId: input.tenantId,
    assetId: input.waterTankAssetId,
    startsAt: input.scheduledStartsAt,
    endsAt: input.scheduledEndsAt,
  });
  if (vehicleConflicts.length > 0) throw new WaterTankConflictError(vehicleConflicts, "vehicle");

  if (input.operatorResourceId) {
    const operatorConflicts = await findResourceConflicts(db, {
      tenantId: input.tenantId,
      resourceId: input.operatorResourceId,
      startsAt: input.scheduledStartsAt,
      endsAt: input.scheduledEndsAt,
    });
    if (operatorConflicts.length > 0) {
      throw new WaterTankConflictError(operatorConflicts, "operator");
    }
  }

  const { data, error } = await db
    .from("operations")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: input.tenantId,
      branch_id: branchId,
      asset_id: input.waterTankAssetId,
      resource_id: input.operatorResourceId ?? null,
      type: "water_tank_service_request",
      scheduled_starts_at: input.scheduledStartsAt,
      scheduled_ends_at: input.scheduledEndsAt,
      metadata: {
        deliveryLocation: input.deliveryLocation ?? null,
        litersRequested: input.litersRequested ?? null,
        description: input.description ?? null,
        customerOrganizationId: input.customerOrganizationId ?? null,
      },
    })
    .select(
      "id, tenant_id, branch_id, asset_id, resource_id, scheduled_starts_at, scheduled_ends_at, status, metadata",
    )
    .single();
  if (error) {
    if (error.code === "23P01") throw new WaterTankConflictError([], "vehicle");
    throw error;
  }
  if (!data) throw new Error("failed to create water tank service request");
  return fromRow(data as Row);
}
