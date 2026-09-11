import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkProvisioningReadiness,
  resolveProvisioningPlan,
  createProvisioningRun,
  finishProvisioningRun,
  markCommercialConfigurationAccepted,
  type ProvisioningStep,
} from "@shina/commercial-platform";
import { createBlueprintRuntime } from "@/lib/blueprint-runtime-factory";
import { applyBlueprintToAssetTypes } from "@/lib/apply-blueprint-to-asset-types";
import { logActivity } from "@/lib/activity-log";
import { ONBOARDING_AUDIT_EVENTS } from "@/lib/audit-event";

// WAVE 4 — the ProvisioningOrchestrator. Runs only behind the gate
// (checkProvisioningReadiness): frozen + hash-valid contract snapshot AND a
// matching acceptance/signature. Each step is idempotent — a blueprint
// already installed is a `skipped` step, not a failure — so a failed run can
// be re-attempted. Nothing here is a production cutover: it configures an
// already-existing tenant's operation.

export interface RunProvisioningInput {
  tenantId: string;
  commercialConfigurationId: string;
  correlationId?: string | null;
  actorId: string;
}

export interface RunProvisioningResult {
  ok: boolean;
  runId?: string;
  reason?: string;
  steps: ProvisioningStep[];
}

export async function runOnboardingProvisioning(
  db: SupabaseClient,
  input: RunProvisioningInput,
): Promise<RunProvisioningResult> {
  const readiness = await checkProvisioningReadiness(db, {
    tenantId: input.tenantId,
    commercialConfigurationId: input.commercialConfigurationId,
  });
  if (!readiness.ready || !readiness.contractSnapshotId) {
    return { ok: false, reason: readiness.reason ?? "not ready", steps: [] };
  }

  const plan = await resolveProvisioningPlan(db, {
    tenantId: input.tenantId,
    commercialConfigurationId: input.commercialConfigurationId,
  });

  const run = await createProvisioningRun(db, {
    tenantId: input.tenantId,
    onboardingContractSnapshotId: readiness.contractSnapshotId,
    commercialConfigurationId: input.commercialConfigurationId,
    correlationId: input.correlationId ?? null,
    createdBy: input.actorId,
  });

  await logActivity(db, {
    tenantId: input.tenantId,
    actorId: input.actorId,
    actorType: "tenant_user",
    correlationId: input.correlationId ?? undefined,
    entityType: "onboarding_provisioning",
    entityId: run.id,
    action: ONBOARDING_AUDIT_EVENTS.PROVISIONING_STARTED,
    metadata: { blueprintIds: plan.blueprintIds, featureFlags: plan.featureFlags },
  });

  const steps: ProvisioningStep[] = [];
  try {
    // 1. blueprints
    const runtime = createBlueprintRuntime(db);
    for (const blueprintId of plan.blueprintIds) {
      let manifest;
      try {
        manifest = runtime.getBlueprint(blueprintId);
      } catch {
        steps.push({
          step: `blueprint:${blueprintId}`,
          status: "failed",
          detail: "unknown blueprint",
        });
        continue;
      }
      try {
        await runtime.install(input.tenantId, blueprintId, {}, input.actorId);
        await applyBlueprintToAssetTypes(db, input.tenantId, manifest);
        steps.push({ step: `blueprint:${blueprintId}`, status: "ok" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // already-installed is idempotent success
        steps.push({
          step: `blueprint:${blueprintId}`,
          status: /already installed/i.test(msg) ? "skipped" : "failed",
          detail: msg,
        });
      }
    }

    // 2. feature flags (control plane) — enable each, upsert
    for (const flag of plan.featureFlags) {
      const { error } = await db
        .from("tenant_feature_flags")
        .upsert(
          {
            tenant_id: input.tenantId,
            flag_key: flag,
            enabled: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,flag_key" },
        );
      steps.push({ step: `flag:${flag}`, status: error ? "failed" : "ok", detail: error?.message });
    }

    // 3. freeze the commercial configuration (accepted → read-only). The
    //    commercial_terms_snapshot link is resolved from the acceptance if
    //    present; otherwise null (assisted pilot may not have one yet).
    const { data: acc } = await db
      .from("contract_acceptances")
      .select("commercial_terms_snapshot_id")
      .eq("tenant_id", input.tenantId)
      .eq("product", "platform")
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (acc?.commercial_terms_snapshot_id) {
      await markCommercialConfigurationAccepted(
        db,
        input.commercialConfigurationId,
        acc.commercial_terms_snapshot_id as string,
      );
      steps.push({ step: "commercial_config:accepted", status: "ok" });
    } else {
      steps.push({
        step: "commercial_config:accepted",
        status: "skipped",
        detail: "no commercial_terms_snapshot on acceptance",
      });
    }

    const failed = steps.some((s) => s.status === "failed");
    await finishProvisioningRun(db, run.id, {
      status: failed ? "failed" : "completed",
      steps,
      error: failed ? "one or more steps failed" : undefined,
    });
    await logActivity(db, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      actorType: "tenant_user",
      correlationId: input.correlationId ?? undefined,
      entityType: "onboarding_provisioning",
      entityId: run.id,
      action: failed
        ? ONBOARDING_AUDIT_EVENTS.PROVISIONING_FAILED
        : ONBOARDING_AUDIT_EVENTS.PROVISIONING_COMPLETED,
      metadata: { steps },
    });

    return { ok: !failed, runId: run.id, steps };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishProvisioningRun(db, run.id, { status: "failed", steps, error: msg });
    await logActivity(db, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      actorType: "tenant_user",
      correlationId: input.correlationId ?? undefined,
      entityType: "onboarding_provisioning",
      entityId: run.id,
      action: ONBOARDING_AUDIT_EVENTS.PROVISIONING_FAILED,
      metadata: { error: msg },
    });
    return { ok: false, runId: run.id, reason: msg, steps };
  }
}
