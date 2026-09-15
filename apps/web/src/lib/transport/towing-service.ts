import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findResourceConflicts,
  findAssetConflicts,
  type ResourceConflict,
} from "@/lib/resource-availability";

// Towing's own dispatch runtime — the piece flagged as open after Wave 3
// (which only built Passenger Transport's Route/Schedule/Trip). A towing
// Service Request IS an operations row (type="towing_service_request"),
// exactly the same design as trip-service.ts's Trip: same resource_id
// (operator) + asset_id (tow truck) dual link, same GiST double-booking
// guards, same status lifecycle — no second aggregate, no new table.
//
// Towing's own flow (spec sections 8-9) is simpler than Passenger
// Transport's: no Route/Schedule/recurring — a service request is
// on-demand by nature (section 8: "A) atender ativo da própria empresa;
// B) atender cliente da locação; C) atender cliente externo; D) operar
// comercialmente"), so origin/destination/description live in metadata
// rather than a reusable Route row.

export class TowingConflictError extends Error {
  constructor(
    public readonly conflicts: ResourceConflict[],
    public readonly on: "vehicle" | "operator",
  ) {
    super(`${on} is already booked in this time window`);
  }
}

export interface CreateTowingServiceRequestInput {
  tenantId: string;
  towTruckAssetId: string;
  operatorResourceId?: string | null;
  scheduledStartsAt: string;
  scheduledEndsAt: string;
  origin?: string | null;
  destination?: string | null;
  description?: string | null;
  customerOrganizationId?: string | null;
  rentalContractId?: string | null;
}

export interface TowingServiceRequest {
  id: string;
  tenantId: string;
  branchId: string;
  towTruckAssetId: string | null;
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

function fromRow(r: Row): TowingServiceRequest {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    branchId: r.branch_id,
    towTruckAssetId: r.asset_id,
    operatorResourceId: r.resource_id,
    scheduledStartsAt: r.scheduled_starts_at,
    scheduledEndsAt: r.scheduled_ends_at,
    status: r.status,
    metadata: r.metadata ?? {},
  };
}

/**
 * Creates a towing Service Request. Same app-level pre-check + DB-level
 * GiST exclusion race guard as trip-service.ts's createTrip() — a
 * maintenance operation on the same tow truck already blocks this for
 * free, exactly like it does for a passenger Trip.
 */
export async function createTowingServiceRequest(
  db: SupabaseClient,
  input: CreateTowingServiceRequestInput,
): Promise<TowingServiceRequest> {
  const { data: asset, error: assetError } = await db
    .from("assets")
    .select("id, branch_id")
    .eq("id", input.towTruckAssetId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (assetError) throw assetError;
  if (!asset) throw new Error("tow truck asset not found");

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
    assetId: input.towTruckAssetId,
    startsAt: input.scheduledStartsAt,
    endsAt: input.scheduledEndsAt,
  });
  if (vehicleConflicts.length > 0) throw new TowingConflictError(vehicleConflicts, "vehicle");

  if (input.operatorResourceId) {
    const operatorConflicts = await findResourceConflicts(db, {
      tenantId: input.tenantId,
      resourceId: input.operatorResourceId,
      startsAt: input.scheduledStartsAt,
      endsAt: input.scheduledEndsAt,
    });
    if (operatorConflicts.length > 0) throw new TowingConflictError(operatorConflicts, "operator");
  }

  const { data, error } = await db
    .from("operations")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: input.tenantId,
      branch_id: branchId,
      asset_id: input.towTruckAssetId,
      resource_id: input.operatorResourceId ?? null,
      type: "towing_service_request",
      scheduled_starts_at: input.scheduledStartsAt,
      scheduled_ends_at: input.scheduledEndsAt,
      metadata: {
        origin: input.origin ?? null,
        destination: input.destination ?? null,
        description: input.description ?? null,
        customerOrganizationId: input.customerOrganizationId ?? null,
        rentalContractId: input.rentalContractId ?? null,
      },
    })
    .select(
      "id, tenant_id, branch_id, asset_id, resource_id, scheduled_starts_at, scheduled_ends_at, status, metadata",
    )
    .single();
  if (error) {
    if (error.code === "23P01") throw new TowingConflictError([], "vehicle");
    throw error;
  }
  if (!data) throw new Error("failed to create towing service request");
  return fromRow(data as Row);
}
