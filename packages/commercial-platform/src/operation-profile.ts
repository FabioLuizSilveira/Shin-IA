import type { SupabaseClient } from "@supabase/supabase-js";

// WAVE 1 — Multi-Operation Business Architecture v2 (domain layer only).
// A Tenant can run several business lines simultaneously (rental + towing +
// passenger transport, ...) under one tenant/IAM/billing/WhatsApp/Agent —
// never a Tenant-per-vertical. This is the one genuinely new table the
// initiative needs (business_profiles already covers primaryVertical/
// additionalVerticals[] and profile versioning — see business-profile.ts).
//
// Deliberately NOT named "Operation" alone — apps/web already has a real,
// wired `operations` table (a scheduled task/booking event: delivery,
// pickup, maintenance, inspection, transfer). OperationProfile is a
// business LINE, not a task instance; see the migration's own comment for
// the full rationale.

export type BusinessOperationType =
  | "vehicle_rental"
  | "motorcycle_rental"
  | "towing_service"
  | "water_tank_service"
  | "bulk_material_transport"
  | "passenger_transport"
  | "equipment_rental"
  | "forklift_operation"
  | "aerial_platform_operation"
  | "munk_operation"
  | "crane_operation"
  | "agricultural_equipment"
  | "other";

export type OperationProfileRole = "primary" | "secondary";
export type OperationProfileStatus = "active" | "suspended" | "deactivated";

// ── Characteristics: discriminated, versioned schemas per operation type ──
// Avoids completely arbitrary JSON (spec section 5) while staying additive:
// a new operation type gets a new interface here, not a migration.

export type TransportServiceModel = "on_demand" | "scheduled" | "recurring" | "mixed";
export type TransportPurpose = "corporate" | "charter" | "tourism" | "event" | "other";

export interface PassengerTransportCharacteristics {
  kind: "passenger_transport";
  version: 1;
  serviceModels: TransportServiceModel[];
  purposes: TransportPurpose[];
  fleetTypes: string[];
  supportsOneWay: boolean;
  supportsRoundTrip: boolean;
  supportsRecurringRoutes: boolean;
}

export type TowingServiceModel =
  | "internal_fleet_support"
  | "on_demand_customer_service"
  | "commercial_towing_service"
  | "mixed";

export interface TowingCharacteristics {
  kind: "towing_service";
  version: 1;
  serviceModel: TowingServiceModel;
}

// Water-tank-truck (caminhão pipa) and bulk-material transport (areia,
// pedra, brita) share towing's exact service-dispatch kernel (spec
// sections 8-9's "reused kernel" principle) — same four service models
// (own fleet / on-demand customer / commercial / mixed), reused verbatim
// rather than re-declared under a new name.
export type DispatchServiceModel = TowingServiceModel;

export interface WaterTankCharacteristics {
  kind: "water_tank_service";
  version: 1;
  serviceModel: DispatchServiceModel;
  capacityUnit: "liters";
}

export type BulkMaterialType = "sand" | "gravel" | "crushed_stone" | "soil" | "other";

export interface BulkMaterialTransportCharacteristics {
  kind: "bulk_material_transport";
  version: 1;
  serviceModel: DispatchServiceModel;
  materialTypes: BulkMaterialType[];
  capacityUnit: "cubic_meters" | "tons";
}

export interface GenericCharacteristics {
  kind: "generic";
  version: 1;
  notes?: string;
}

export type OperationProfileCharacteristics =
  | PassengerTransportCharacteristics
  | TowingCharacteristics
  | WaterTankCharacteristics
  | BulkMaterialTransportCharacteristics
  | GenericCharacteristics;

function defaultCharacteristics(type: BusinessOperationType): OperationProfileCharacteristics {
  if (type === "passenger_transport") {
    return {
      kind: "passenger_transport",
      version: 1,
      serviceModels: [],
      purposes: [],
      fleetTypes: [],
      supportsOneWay: true,
      supportsRoundTrip: true,
      supportsRecurringRoutes: false,
    };
  }
  if (type === "towing_service") {
    return { kind: "towing_service", version: 1, serviceModel: "mixed" };
  }
  if (type === "water_tank_service") {
    return {
      kind: "water_tank_service",
      version: 1,
      serviceModel: "mixed",
      capacityUnit: "liters",
    };
  }
  if (type === "bulk_material_transport") {
    return {
      kind: "bulk_material_transport",
      version: 1,
      serviceModel: "mixed",
      materialTypes: [],
      capacityUnit: "cubic_meters",
    };
  }
  return { kind: "generic", version: 1 };
}

/** Rejects a characteristics payload whose `kind` doesn't match the operation `type` — the one place this is enforced, since the DB stores it as plain jsonb. */
const DISCRIMINATED_TYPES: Partial<
  Record<BusinessOperationType, OperationProfileCharacteristics["kind"]>
> = {
  passenger_transport: "passenger_transport",
  towing_service: "towing_service",
  water_tank_service: "water_tank_service",
  bulk_material_transport: "bulk_material_transport",
};

function validateCharacteristics(
  type: BusinessOperationType,
  characteristics: OperationProfileCharacteristics,
): void {
  const expectedKind = DISCRIMINATED_TYPES[type] ?? null;
  if (expectedKind && characteristics.kind !== expectedKind) {
    throw new Error(
      `characteristics.kind "${characteristics.kind}" does not match operation type "${type}" (expected "${expectedKind}")`,
    );
  }
}

export interface OperationProfileInput {
  tenantId: string;
  businessProfileId?: string | null;
  type: BusinessOperationType;
  role?: OperationProfileRole;
  assetTypes?: string[];
  assetQuantity?: number | null;
  projectedAssetQuantity?: number | null;
  characteristics?: OperationProfileCharacteristics;
  operationalCapabilities?: string[];
  branchIds?: string[] | null;
}

export interface OperationProfile {
  id: string;
  tenantId: string;
  businessProfileId: string | null;
  type: BusinessOperationType;
  role: OperationProfileRole;
  assetTypes: string[];
  assetQuantity: number | null;
  projectedAssetQuantity: number | null;
  characteristics: OperationProfileCharacteristics;
  operationalCapabilities: string[];
  branchIds: string[] | null;
  status: OperationProfileStatus;
  createdAt: string;
  updatedAt: string;
}

interface Row {
  id: string;
  tenant_id: string;
  business_profile_id: string | null;
  type: BusinessOperationType;
  role: OperationProfileRole;
  asset_types: string[];
  asset_quantity: number | null;
  projected_asset_quantity: number | null;
  characteristics: OperationProfileCharacteristics;
  operational_capabilities: string[];
  branch_ids: string[] | null;
  status: OperationProfileStatus;
  created_at: string;
  updated_at: string;
}

function fromRow(r: Row): OperationProfile {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    businessProfileId: r.business_profile_id,
    type: r.type,
    role: r.role,
    assetTypes: r.asset_types ?? [],
    assetQuantity: r.asset_quantity,
    projectedAssetQuantity: r.projected_asset_quantity,
    characteristics: r.characteristics,
    operationalCapabilities: r.operational_capabilities ?? [],
    branchIds: r.branch_ids,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Creates a new operation profile for the tenant. Defaults to role "secondary" — call setPrimaryOperationProfile explicitly to promote one, so "which operation is primary" is always a deliberate action, never an insert-order accident. */
export async function createOperationProfile(
  db: SupabaseClient,
  input: OperationProfileInput,
): Promise<OperationProfile> {
  const characteristics = input.characteristics ?? defaultCharacteristics(input.type);
  validateCharacteristics(input.type, characteristics);

  const { data, error } = await db
    .from("operation_profiles")
    .insert({
      tenant_id: input.tenantId,
      business_profile_id: input.businessProfileId ?? null,
      type: input.type,
      role: input.role ?? "secondary",
      asset_types: input.assetTypes ?? [],
      asset_quantity: input.assetQuantity ?? null,
      projected_asset_quantity: input.projectedAssetQuantity ?? null,
      characteristics,
      operational_capabilities: input.operationalCapabilities ?? [],
      branch_ids: input.branchIds ?? null,
      status: "active",
    })
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("failed to create operation profile");
  return fromRow(data as Row);
}

export async function listOperationProfiles(
  db: SupabaseClient,
  tenantId: string,
): Promise<OperationProfile[]> {
  const { data, error } = await db
    .from("operation_profiles")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Row[]).map(fromRow);
}

export async function getOperationProfile(
  db: SupabaseClient,
  tenantId: string,
  operationProfileId: string,
): Promise<OperationProfile | null> {
  const { data, error } = await db
    .from("operation_profiles")
    .select("*")
    .eq("id", operationProfileId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as Row) : null;
}

/**
 * Promotes one operation profile to PRIMARY, demoting whatever the tenant's
 * current primary was (there can be at most one — DB partial unique index
 * enforces it too). Also updates the tenant's CONFIRMED business_profiles
 * row's primary_operation_id, when one exists, so recommendation/UX/
 * analytics stay in sync without a second call.
 */
export async function setPrimaryOperationProfile(
  db: SupabaseClient,
  tenantId: string,
  operationProfileId: string,
): Promise<OperationProfile> {
  const target = await getOperationProfile(db, tenantId, operationProfileId);
  if (!target) throw new Error("operation profile not found");
  if (target.status !== "active") {
    throw new Error("cannot set a non-active operation profile as primary");
  }

  await db
    .from("operation_profiles")
    .update({ role: "secondary", updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("role", "primary")
    .neq("id", operationProfileId);

  const { data, error } = await db
    .from("operation_profiles")
    .update({ role: "primary", updated_at: new Date().toISOString() })
    .eq("id", operationProfileId)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("failed to set primary operation profile");

  await db
    .from("business_profiles")
    .update({ primary_operation_id: operationProfileId })
    .eq("tenant_id", tenantId)
    .eq("status", "confirmed");

  return fromRow(data as Row);
}

export async function setOperationProfileStatus(
  db: SupabaseClient,
  tenantId: string,
  operationProfileId: string,
  status: OperationProfileStatus,
): Promise<OperationProfile> {
  const { data, error } = await db
    .from("operation_profiles")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", operationProfileId)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("failed to update operation profile status");
  return fromRow(data as Row);
}
