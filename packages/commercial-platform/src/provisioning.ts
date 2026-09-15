import type { SupabaseClient } from "@supabase/supabase-js";
import { hashContent } from "./hash.js";
import { resolveRequiredContract } from "./contract-requirement.js";
import {
  resolveOperationProfilesForProfile,
  type ResolvedOperationProfile,
} from "./operation-type-mapping.js";

// WAVE 4 — the provisioning GATE + run log. The actual orchestration
// (blueprint install, feature flags) lives in the app layer because it needs
// @shina/blueprint-runtime wired to the DB; this package owns the parts that
// are pure policy: is the contract settled, and what should be provisioned.

export interface ProvisioningReadiness {
  ready: boolean;
  reason: string | null;
  executionMode: "click_accept" | "electronic_signature" | null;
  contractSnapshotId: string | null;
  contentHash: string | null;
}

interface FrozenSnapshotRow {
  id: string;
  tenant_id: string;
  commercial_configuration_id: string;
  contract_version_id: string;
  execution_mode: "click_accept" | "electronic_signature";
  composed_content: string;
  content_hash: string;
  status: string;
}

/**
 * The provisioning gate (STOP condition: provisioning-before-contract).
 * Passes only when:
 *  - a `frozen` onboarding_contract_snapshot exists for the config,
 *  - its stored hash still matches its content (hash-mismatch-ignored),
 *  - click_accept  → a contract_acceptance row exists for the tenant on the
 *                    currently-published platform contract version,
 *  - electronic_signature → a signature_request in status `signed` exists
 *                    for the tenant referencing this contract version.
 */
export async function checkProvisioningReadiness(
  db: SupabaseClient,
  input: { tenantId: string; commercialConfigurationId: string },
): Promise<ProvisioningReadiness> {
  const fail = (reason: string): ProvisioningReadiness => ({
    ready: false,
    reason,
    executionMode: null,
    contractSnapshotId: null,
    contentHash: null,
  });

  const { data: snap, error } = await db
    .from("onboarding_contract_snapshots")
    .select(
      "id, tenant_id, commercial_configuration_id, contract_version_id, execution_mode, composed_content, content_hash, status",
    )
    .eq("commercial_configuration_id", input.commercialConfigurationId)
    .eq("tenant_id", input.tenantId)
    .eq("status", "frozen")
    .maybeSingle();
  if (error) throw error;
  if (!snap) return fail("no frozen contract snapshot for this commercial configuration");

  const snapshot = snap as FrozenSnapshotRow;

  const recomputed = await hashContent(snapshot.composed_content);
  if (recomputed !== snapshot.content_hash) {
    return fail(
      `contract snapshot hash mismatch (stored ${snapshot.content_hash}, recomputed ${recomputed})`,
    );
  }

  const base: Omit<ProvisioningReadiness, "ready" | "reason"> = {
    executionMode: snapshot.execution_mode,
    contractSnapshotId: snapshot.id,
    contentHash: snapshot.content_hash,
  };

  if (snapshot.execution_mode === "click_accept") {
    const current = await resolveRequiredContract(db, "platform").catch(() => null);
    if (!current) return { ...base, ready: false, reason: "no published platform contract" };
    const { data: acceptance } = await db
      .from("contract_acceptances")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .eq("product", "platform")
      .eq("contract_version_id", current.id)
      .limit(1)
      .maybeSingle();
    if (!acceptance) {
      return { ...base, ready: false, reason: "contract not yet accepted (click-accept)" };
    }
    return { ...base, ready: true, reason: null };
  }

  // electronic_signature
  const { data: signed } = await db
    .from("signature_requests")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("contract_version_id", snapshot.contract_version_id)
    .eq("status", "signed")
    .limit(1)
    .maybeSingle();
  if (!signed) {
    return { ...base, ready: false, reason: "contract not yet signed (electronic signature)" };
  }
  return { ...base, ready: true, reason: null };
}

// ── provisioning plan ────────────────────────────────────────────────────
export interface ProvisioningPlan {
  blueprintIds: string[];
  featureFlags: string[];
  quotas: Record<string, number>;
  planId: string | null;
  planVersionId: string | null;
  /** WAVE 4 (Multi-Operation Business Architecture v2) — the operation profiles this tenant's confirmed BusinessProfile implies (one per distinct operation type across primaryVertical + additionalVerticals). Resolution only here; the app-layer orchestrator (runOnboardingProvisioning) is what actually persists operation_profiles rows, idempotently. */
  operationProfiles: ResolvedOperationProfile[];
}

/** What to provision, derived from the frozen config + its business profile's
 *  resolved blueprint. Deterministic — reads only stored rows. */
export async function resolveProvisioningPlan(
  db: SupabaseClient,
  input: { tenantId: string; commercialConfigurationId: string },
): Promise<ProvisioningPlan> {
  const { data: config } = await db
    .from("commercial_configurations")
    .select("plan_id, plan_version_id, extensions, quotas, business_profile_id")
    .eq("id", input.commercialConfigurationId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (!config) throw new Error("commercial configuration not found");

  const extensions = (config.extensions as string[]) ?? [];
  const quotas = (config.quotas as Record<string, number>) ?? {};

  let blueprintIds: string[] = [];
  let operationProfiles: ResolvedOperationProfile[] = [];
  if (config.business_profile_id) {
    const { data: profile } = await db
      .from("business_profiles")
      .select("primary_vertical, additional_verticals")
      .eq("id", config.business_profile_id)
      .maybeSingle();
    if (profile) {
      const primaryVertical = profile.primary_vertical as string;
      const additionalVerticals = (profile.additional_verticals as string[]) ?? [];
      const verticalKeys = [primaryVertical, ...additionalVerticals];
      const { data: verticals } = await db
        .from("verticals")
        .select("key, blueprint_id")
        .in("key", verticalKeys);
      blueprintIds = [...new Set((verticals ?? []).map((v) => v.blueprint_id as string))].sort();
      operationProfiles = resolveOperationProfilesForProfile({
        primaryVertical,
        additionalVerticals,
      });
    }
  }

  const featureFlags = [
    ...new Set(extensions.map((e) => `ext.${e}`).concat(blueprintIds.map((b) => `blueprint.${b}`))),
  ].sort();

  return {
    blueprintIds,
    featureFlags,
    quotas,
    planId: (config.plan_id as string) ?? null,
    planVersionId: (config.plan_version_id as string) ?? null,
    operationProfiles,
  };
}

// ── run log ──────────────────────────────────────────────────────────────
export interface ProvisioningStep {
  step: string;
  status: "ok" | "skipped" | "failed";
  detail?: string;
}

export async function createProvisioningRun(
  db: SupabaseClient,
  input: {
    tenantId: string;
    onboardingContractSnapshotId: string;
    commercialConfigurationId: string;
    correlationId?: string | null;
    createdBy: string;
  },
): Promise<{ id: string }> {
  const { data, error } = await db
    .from("onboarding_provisioning_runs")
    .insert({
      tenant_id: input.tenantId,
      onboarding_contract_snapshot_id: input.onboardingContractSnapshotId,
      commercial_configuration_id: input.commercialConfigurationId,
      correlation_id: input.correlationId ?? null,
      created_by: input.createdBy,
      status: "running",
      started_at: new Date().toISOString(),
      steps: [],
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") {
      throw new Error("a provisioning run already exists for this contract snapshot");
    }
    throw error ?? new Error("failed to create provisioning run");
  }
  return { id: data.id as string };
}

export async function finishProvisioningRun(
  db: SupabaseClient,
  runId: string,
  result: { status: "completed" | "failed"; steps: ProvisioningStep[]; error?: string },
): Promise<void> {
  await db
    .from("onboarding_provisioning_runs")
    .update({
      status: result.status,
      steps: result.steps,
      error: result.error ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
}
