import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findResourceConflicts,
  findAssetConflicts,
  type ResourceConflict,
} from "@/lib/resource-availability";

// Concrete-mixer-truck's (betoneira) own dispatch runtime — same treatment
// as towing-service.ts / water-tank-service.ts / bulk-material-service.ts.
// A concrete mixer service request IS an operations row
// (type="concrete_mixer_service_request"): same resource_id (operator) +
// asset_id (truck) dual link, same GiST double-booking guards.
//
// Matched by CAPACITY in cubic meters only — concrete, unlike bulk
// material (which can be quoted in m³ or tons), is always measured in m³,
// so this reuses matchVehiclesByCapacityField against capacityCubicMeters
// directly, no unit-selection logic needed.

export class ConcreteMixerConflictError extends Error {
  constructor(
    public readonly conflicts: ResourceConflict[],
    public readonly on: "vehicle" | "operator",
  ) {
    super(`${on} is already booked in this time window`);
  }
}

export interface CreateConcreteMixerServiceRequestInput {
  tenantId: string;
  truckAssetId: string;
  operatorResourceId?: string | null;
  scheduledStartsAt: string;
  scheduledEndsAt: string;
  deliveryLocation?: string | null;
  cubicMetersRequested?: number | null;
  description?: string | null;
  customerOrganizationId?: string | null;
}

export interface ConcreteMixerServiceRequest {
  id: string;
  tenantId: string;
  branchId: string;
  truckAssetId: string | null;
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

function fromRow(r: Row): ConcreteMixerServiceRequest {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    branchId: r.branch_id,
    truckAssetId: r.asset_id,
    operatorResourceId: r.resource_id,
    scheduledStartsAt: r.scheduled_starts_at,
    scheduledEndsAt: r.scheduled_ends_at,
    status: r.status,
    metadata: r.metadata ?? {},
  };
}

/**
 * Creates a concrete-mixer Service Request. Same app-level pre-check +
 * DB-level GiST exclusion race guard as every other dispatch-based
 * operation's own request creator.
 */
export async function createConcreteMixerServiceRequest(
  db: SupabaseClient,
  input: CreateConcreteMixerServiceRequestInput,
): Promise<ConcreteMixerServiceRequest> {
  const { data: asset, error: assetError } = await db
    .from("assets")
    .select("id, branch_id")
    .eq("id", input.truckAssetId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (assetError) throw assetError;
  if (!asset) throw new Error("concrete mixer truck asset not found");

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
    assetId: input.truckAssetId,
    startsAt: input.scheduledStartsAt,
    endsAt: input.scheduledEndsAt,
  });
  if (vehicleConflicts.length > 0) {
    throw new ConcreteMixerConflictError(vehicleConflicts, "vehicle");
  }

  if (input.operatorResourceId) {
    const operatorConflicts = await findResourceConflicts(db, {
      tenantId: input.tenantId,
      resourceId: input.operatorResourceId,
      startsAt: input.scheduledStartsAt,
      endsAt: input.scheduledEndsAt,
    });
    if (operatorConflicts.length > 0) {
      throw new ConcreteMixerConflictError(operatorConflicts, "operator");
    }
  }

  const { data, error } = await db
    .from("operations")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: input.tenantId,
      branch_id: branchId,
      asset_id: input.truckAssetId,
      resource_id: input.operatorResourceId ?? null,
      type: "concrete_mixer_service_request",
      scheduled_starts_at: input.scheduledStartsAt,
      scheduled_ends_at: input.scheduledEndsAt,
      metadata: {
        deliveryLocation: input.deliveryLocation ?? null,
        cubicMetersRequested: input.cubicMetersRequested ?? null,
        description: input.description ?? null,
        customerOrganizationId: input.customerOrganizationId ?? null,
      },
    })
    .select(
      "id, tenant_id, branch_id, asset_id, resource_id, scheduled_starts_at, scheduled_ends_at, status, metadata",
    )
    .single();
  if (error) {
    if (error.code === "23P01") throw new ConcreteMixerConflictError([], "vehicle");
    throw error;
  }
  if (!data) throw new Error("failed to create concrete mixer service request");
  return fromRow(data as Row);
}
