import type { SupabaseClient } from "@supabase/supabase-js";

// WAVE 1 — the EDITABLE pre-acceptance draft of exactly what is being
// contracted. This is NOT a separate "Pedido Comercial" module: while
// `draft`/`confirmed` it can be re-priced and edited; on acceptance a
// commercial_terms_snapshots row (the immutable evidence that already
// exists) is produced and linked back here, and this config flips to
// `accepted` and becomes read-only.

export type CommercialConfigSource = "self_service" | "assisted";
export type CommercialConfigStatus = "draft" | "confirmed" | "accepted" | "superseded";

export interface CommercialQuotas {
  assets?: number;
  users?: number;
  branches?: number;
  storageGb?: number;
  aiCredits?: number;
}

/** WAVE 4 (Multi-Operation Business Architecture v2) — a per-operation line item (spec section 31). Deliberately descriptive only: this prompt does not define per-operation pricing rules, so there is no price field here — pricing stays in the flat `prices`/plan mechanism until a real per-operation pricing model is designed. */
export interface OperationConfigLineItem {
  operationType: string;
  assetQuantity?: number | null;
}

export interface CommercialConfigInput {
  tenantId: string;
  businessProfileId?: string | null;
  planId?: string | null;
  planVersionId?: string | null;
  extensions?: string[];
  operationConfigurations?: OperationConfigLineItem[];
  quotas?: CommercialQuotas;
  integrations?: string[];
  billingCycle?: "monthly" | "yearly" | null;
  prices?: Record<string, unknown>;
  discounts?: Record<string, unknown>;
  commitmentPeriodMonths?: number | null;
  pricingVersion?: number | null;
  effectiveAt?: string | null;
  source: CommercialConfigSource;
  createdBy: string;
}

export interface CommercialConfiguration {
  id: string;
  tenantId: string;
  version: number;
  businessProfileId: string | null;
  planId: string | null;
  planVersionId: string | null;
  extensions: string[];
  operationConfigurations: OperationConfigLineItem[];
  quotas: CommercialQuotas;
  integrations: string[];
  billingCycle: "monthly" | "yearly" | null;
  prices: Record<string, unknown>;
  discounts: Record<string, unknown>;
  commitmentPeriodMonths: number | null;
  pricingVersion: number | null;
  effectiveAt: string | null;
  source: CommercialConfigSource;
  status: CommercialConfigStatus;
  commercialTermsSnapshotId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface Row {
  id: string;
  tenant_id: string;
  version: number;
  business_profile_id: string | null;
  plan_id: string | null;
  plan_version_id: string | null;
  extensions: string[];
  operation_configurations: OperationConfigLineItem[];
  quotas: CommercialQuotas;
  integrations: string[];
  billing_cycle: "monthly" | "yearly" | null;
  prices: Record<string, unknown>;
  discounts: Record<string, unknown>;
  commitment_period_months: number | null;
  pricing_version: number | null;
  effective_at: string | null;
  source: CommercialConfigSource;
  status: CommercialConfigStatus;
  commercial_terms_snapshot_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function fromRow(r: Row): CommercialConfiguration {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    version: r.version,
    businessProfileId: r.business_profile_id,
    planId: r.plan_id,
    planVersionId: r.plan_version_id,
    extensions: r.extensions ?? [],
    operationConfigurations: r.operation_configurations ?? [],
    quotas: r.quotas ?? {},
    integrations: r.integrations ?? [],
    billingCycle: r.billing_cycle,
    prices: r.prices ?? {},
    discounts: r.discounts ?? {},
    commitmentPeriodMonths: r.commitment_period_months,
    pricingVersion: r.pricing_version,
    effectiveAt: r.effective_at,
    source: r.source,
    status: r.status,
    commercialTermsSnapshotId: r.commercial_terms_snapshot_id,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function nextVersion(db: SupabaseClient, tenantId: string): Promise<number> {
  const { data } = await db
    .from("commercial_configurations")
    .select("version")
    .eq("tenant_id", tenantId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.version ?? 0) + 1;
}

export async function createCommercialConfiguration(
  db: SupabaseClient,
  input: CommercialConfigInput,
): Promise<CommercialConfiguration> {
  const version = await nextVersion(db, input.tenantId);
  const { data, error } = await db
    .from("commercial_configurations")
    .insert({
      tenant_id: input.tenantId,
      version,
      business_profile_id: input.businessProfileId ?? null,
      plan_id: input.planId ?? null,
      plan_version_id: input.planVersionId ?? null,
      extensions: input.extensions ?? [],
      operation_configurations: input.operationConfigurations ?? [],
      quotas: input.quotas ?? {},
      integrations: input.integrations ?? [],
      billing_cycle: input.billingCycle ?? null,
      prices: input.prices ?? {},
      discounts: input.discounts ?? {},
      commitment_period_months: input.commitmentPeriodMonths ?? null,
      pricing_version: input.pricingVersion ?? null,
      effective_at: input.effectiveAt ?? null,
      source: input.source,
      created_by: input.createdBy,
      status: "draft",
    })
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("failed to create commercial configuration");
  return fromRow(data as Row);
}

/** Patch a DRAFT config (re-pricing, plan/extension edits). Refuses once accepted. */
export async function updateCommercialConfiguration(
  db: SupabaseClient,
  configId: string,
  patch: Partial<CommercialConfigInput>,
): Promise<CommercialConfiguration> {
  const { data: current } = await db
    .from("commercial_configurations")
    .select("status")
    .eq("id", configId)
    .maybeSingle();
  if (!current) throw new Error("commercial configuration not found");
  if (current.status === "accepted" || current.status === "superseded") {
    throw new Error(`cannot edit a "${current.status}" commercial configuration`);
  }

  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.planId !== undefined) dbPatch.plan_id = patch.planId;
  if (patch.planVersionId !== undefined) dbPatch.plan_version_id = patch.planVersionId;
  if (patch.extensions !== undefined) dbPatch.extensions = patch.extensions;
  if (patch.operationConfigurations !== undefined)
    dbPatch.operation_configurations = patch.operationConfigurations;
  if (patch.quotas !== undefined) dbPatch.quotas = patch.quotas;
  if (patch.integrations !== undefined) dbPatch.integrations = patch.integrations;
  if (patch.billingCycle !== undefined) dbPatch.billing_cycle = patch.billingCycle;
  if (patch.prices !== undefined) dbPatch.prices = patch.prices;
  if (patch.discounts !== undefined) dbPatch.discounts = patch.discounts;
  if (patch.commitmentPeriodMonths !== undefined)
    dbPatch.commitment_period_months = patch.commitmentPeriodMonths;
  if (patch.pricingVersion !== undefined) dbPatch.pricing_version = patch.pricingVersion;

  const { data, error } = await db
    .from("commercial_configurations")
    .update(dbPatch)
    .eq("id", configId)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("failed to update commercial configuration");
  return fromRow(data as Row);
}

/** Links the accepted config to its immutable snapshot and freezes it. */
export async function markCommercialConfigurationAccepted(
  db: SupabaseClient,
  configId: string,
  commercialTermsSnapshotId: string,
): Promise<void> {
  const { error } = await db
    .from("commercial_configurations")
    .update({
      status: "accepted",
      commercial_terms_snapshot_id: commercialTermsSnapshotId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", configId)
    .neq("status", "accepted");
  if (error) throw error;
}
