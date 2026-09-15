import type { SupabaseClient } from "@supabase/supabase-js";

// WAVE 1 — "how the tenant's operation works". Versioned and permanent: it
// is NOT discarded after onboarding. A later change (e.g. a rental operator
// adding a second vertical) creates v2, which feeds the same resolvers and
// produces a commercial/contract delta — never overwrites a confirmed
// version. tenantId is never a caller-supplied argument at the route layer;
// it is resolved server-side and passed straight through here.

export type BusinessProfileSource = "self_service" | "assisted" | "demo";
export type BusinessProfileStatus = "draft" | "confirmed" | "superseded";

export interface BusinessProfileAnswer {
  questionKey: string;
  value: unknown;
}

export interface BusinessProfileInput {
  tenantId: string;
  primaryVertical: string;
  additionalVerticals?: string[];
  assetTypes?: string[];
  assetQuantity?: number | null;
  projectedAssetQuantity?: number | null;
  users?: number | null;
  branches?: number | null;
  operationalCapabilities?: string[];
  integrationNeeds?: string[];
  answers?: BusinessProfileAnswer[];
  source: BusinessProfileSource;
  createdBy: string;
}

export interface BusinessProfile {
  id: string;
  tenantId: string;
  version: number;
  primaryVertical: string;
  additionalVerticals: string[];
  assetTypes: string[];
  assetQuantity: number | null;
  projectedAssetQuantity: number | null;
  users: number | null;
  branches: number | null;
  operationalCapabilities: string[];
  integrationNeeds: string[];
  answers: BusinessProfileAnswer[];
  source: BusinessProfileSource;
  status: BusinessProfileStatus;
  createdBy: string;
  createdAt: string;
  confirmedAt: string | null;
  /** WAVE 1 (Multi-Operation Business Architecture v2) — points at the tenant's
   *  current primary OperationProfile (operation-profile.ts). Null until a
   *  caller explicitly promotes one via setPrimaryOperationProfile(); legacy
   *  primaryVertical/additionalVerticals[] remain the source of truth for
   *  the existing discovery/blueprint-resolver flow and are untouched. */
  primaryOperationId: string | null;
}

interface Row {
  id: string;
  tenant_id: string;
  version: number;
  primary_vertical: string;
  additional_verticals: string[];
  asset_types: string[];
  asset_quantity: number | null;
  projected_asset_quantity: number | null;
  users: number | null;
  branches: number | null;
  operational_capabilities: string[];
  integration_needs: string[];
  answers: BusinessProfileAnswer[];
  source: BusinessProfileSource;
  status: BusinessProfileStatus;
  created_by: string;
  created_at: string;
  confirmed_at: string | null;
  primary_operation_id: string | null;
}

function fromRow(r: Row): BusinessProfile {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    version: r.version,
    primaryVertical: r.primary_vertical,
    additionalVerticals: r.additional_verticals ?? [],
    assetTypes: r.asset_types ?? [],
    assetQuantity: r.asset_quantity,
    projectedAssetQuantity: r.projected_asset_quantity,
    users: r.users,
    branches: r.branches,
    operationalCapabilities: r.operational_capabilities ?? [],
    integrationNeeds: r.integration_needs ?? [],
    answers: r.answers ?? [],
    source: r.source,
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    confirmedAt: r.confirmed_at,
    primaryOperationId: r.primary_operation_id ?? null,
  };
}

async function nextVersion(db: SupabaseClient, tenantId: string): Promise<number> {
  const { data } = await db
    .from("business_profiles")
    .select("version")
    .eq("tenant_id", tenantId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.version ?? 0) + 1;
}

/** Creates the next DRAFT version for the tenant — never touches an existing row. */
export async function createBusinessProfileVersion(
  db: SupabaseClient,
  input: BusinessProfileInput,
): Promise<BusinessProfile> {
  const version = await nextVersion(db, input.tenantId);
  const { data, error } = await db
    .from("business_profiles")
    .insert({
      tenant_id: input.tenantId,
      version,
      primary_vertical: input.primaryVertical,
      additional_verticals: input.additionalVerticals ?? [],
      asset_types: input.assetTypes ?? [],
      asset_quantity: input.assetQuantity ?? null,
      projected_asset_quantity: input.projectedAssetQuantity ?? null,
      users: input.users ?? null,
      branches: input.branches ?? null,
      operational_capabilities: input.operationalCapabilities ?? [],
      integration_needs: input.integrationNeeds ?? [],
      answers: input.answers ?? [],
      source: input.source,
      created_by: input.createdBy,
      status: "draft",
    })
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("failed to create business profile");
  return fromRow(data as Row);
}

/**
 * Confirms a draft version: supersedes whatever confirmed version the tenant
 * had (there can be at most one — DB partial unique index enforces it too),
 * then flips this one to confirmed. Never mutates a superseded version's data.
 */
export async function confirmBusinessProfile(
  db: SupabaseClient,
  profileId: string,
): Promise<BusinessProfile> {
  const { data: profile, error: fetchError } = await db
    .from("business_profiles")
    .select("id, tenant_id, status")
    .eq("id", profileId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!profile) throw new Error("business profile not found");
  if (profile.status === "superseded") throw new Error("cannot confirm a superseded profile");

  await db
    .from("business_profiles")
    .update({ status: "superseded" })
    .eq("tenant_id", profile.tenant_id)
    .eq("status", "confirmed")
    .neq("id", profileId);

  const { data, error } = await db
    .from("business_profiles")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", profileId)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("failed to confirm business profile");
  return fromRow(data as Row);
}

export async function getConfirmedBusinessProfile(
  db: SupabaseClient,
  tenantId: string,
): Promise<BusinessProfile | null> {
  const { data } = await db
    .from("business_profiles")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "confirmed")
    .maybeSingle();
  return data ? fromRow(data as Row) : null;
}
