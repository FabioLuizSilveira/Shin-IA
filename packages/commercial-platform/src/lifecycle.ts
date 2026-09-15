import type { SupabaseClient } from "@supabase/supabase-js";

// WAVE 5 — OPERATE / EVOLVE. When a live tenant changes its operation
// (adds a vertical, grows the fleet, wants another module), the change is
// expressed as a DETERMINISTIC delta between the accepted CommercialConfiguration
// and a proposed one. The delta classifies itself: does it need a new
// contract (material), and does it need reprovisioning. Nothing here mutates
// an accepted configuration — a change always produces a new draft version
// (createCommercialConfiguration) that this compares against.

export interface ConfigurationSnapshotForDelta {
  planKey: string | null;
  planVersionId: string | null;
  extensions: string[];
  quotas: Record<string, number>;
  commitmentPeriodMonths: number | null;
  totalMonthlyCents: number | null;
  /** WAVE 4 (Multi-Operation Business Architecture v2) — distinct BusinessOperationType values the tenant runs, e.g. ["vehicle_rental", "towing_service"]. Optional/defaults to [] so pre-existing single-operation callers need no change (spec section 40's "Add Operation" lifecycle). */
  operationTypes?: string[];
}

export interface ConfigurationDelta {
  planChange: { from: string | null; to: string | null; direction: "up" | "down" | "same" } | null;
  extensionsAdded: string[];
  extensionsRemoved: string[];
  operationsAdded: string[];
  operationsRemoved: string[];
  quotaChanges: Array<{ key: string; from: number | null; to: number | null }>;
  commitmentChange: { from: number | null; to: number | null } | null;
  priceDeltaCents: number | null;
  requiresNewContract: boolean;
  requiresReprovisioning: boolean;
  reasons: string[];
}

const PLAN_RANK = ["starter", "professional"];

function planDirection(from: string | null, to: string | null): "up" | "down" | "same" {
  if (from === to || !from || !to) return "same";
  return PLAN_RANK.indexOf(to) > PLAN_RANK.indexOf(from) ? "up" : "down";
}

/** Pure, deterministic. `current` is the accepted config, `proposed` the new
 *  draft. */
export function computeConfigurationDelta(
  current: ConfigurationSnapshotForDelta,
  proposed: ConfigurationSnapshotForDelta,
): ConfigurationDelta {
  const reasons: string[] = [];

  const planChange =
    current.planKey !== proposed.planKey
      ? {
          from: current.planKey,
          to: proposed.planKey,
          direction: planDirection(current.planKey, proposed.planKey),
        }
      : null;
  if (planChange)
    reasons.push(
      `Plano: ${planChange.from ?? "—"} → ${planChange.to ?? "—"} (${planChange.direction}).`,
    );

  const curExt = new Set(current.extensions);
  const propExt = new Set(proposed.extensions);
  const extensionsAdded = [...propExt].filter((e) => !curExt.has(e)).sort();
  const extensionsRemoved = [...curExt].filter((e) => !propExt.has(e)).sort();
  if (extensionsAdded.length) reasons.push(`Extensões adicionadas: ${extensionsAdded.join(", ")}.`);
  if (extensionsRemoved.length)
    reasons.push(`Extensões removidas: ${extensionsRemoved.join(", ")}.`);

  const curOps = new Set(current.operationTypes ?? []);
  const propOps = new Set(proposed.operationTypes ?? []);
  const operationsAdded = [...propOps].filter((o) => !curOps.has(o)).sort();
  const operationsRemoved = [...curOps].filter((o) => !propOps.has(o)).sort();
  if (operationsAdded.length) reasons.push(`Operações adicionadas: ${operationsAdded.join(", ")}.`);
  if (operationsRemoved.length)
    reasons.push(`Operações removidas: ${operationsRemoved.join(", ")}.`);

  const quotaKeys = [
    ...new Set([...Object.keys(current.quotas), ...Object.keys(proposed.quotas)]),
  ].sort();
  const quotaChanges = quotaKeys
    .map((key) => ({
      key,
      from: current.quotas[key] ?? null,
      to: proposed.quotas[key] ?? null,
    }))
    .filter((c) => c.from !== c.to);
  for (const c of quotaChanges) reasons.push(`Cota "${c.key}": ${c.from ?? "—"} → ${c.to ?? "—"}.`);

  const commitmentChange =
    (current.commitmentPeriodMonths ?? null) !== (proposed.commitmentPeriodMonths ?? null)
      ? {
          from: current.commitmentPeriodMonths ?? null,
          to: proposed.commitmentPeriodMonths ?? null,
        }
      : null;
  if (commitmentChange)
    reasons.push(`Permanência: ${commitmentChange.from ?? 0} → ${commitmentChange.to ?? 0} meses.`);

  const priceDeltaCents =
    current.totalMonthlyCents !== null && proposed.totalMonthlyCents !== null
      ? proposed.totalMonthlyCents - current.totalMonthlyCents
      : null;

  // Material change (needs a fresh contract acceptance/signature): a plan
  // change, a longer commitment, any price increase, or a NEW operation
  // (spec section 40: adding a business line is a Commercial + Contract
  // Delta, not just a reprovision — the tenant is agreeing to run more than
  // it originally contracted). Removing extensions/operations or a
  // downgrade is non-material — reprovision only.
  const requiresNewContract =
    Boolean(planChange && planChange.direction !== "same") ||
    Boolean(commitmentChange && (commitmentChange.to ?? 0) > (commitmentChange.from ?? 0)) ||
    (priceDeltaCents ?? 0) > 0 ||
    operationsAdded.length > 0;

  // Reprovisioning needed whenever the installed surface changes: plan,
  // extensions, operations, or blueprint-affecting quotas.
  const requiresReprovisioning =
    Boolean(planChange) ||
    extensionsAdded.length > 0 ||
    extensionsRemoved.length > 0 ||
    operationsAdded.length > 0 ||
    operationsRemoved.length > 0 ||
    quotaChanges.length > 0;

  if (requiresNewContract)
    reasons.push("Mudança material — exige novo aceite/assinatura de contrato.");
  else if (requiresReprovisioning)
    reasons.push("Mudança operacional — exige reprovisionamento, sem novo contrato.");
  else reasons.push("Sem impacto contratual ou operacional.");

  return {
    planChange,
    extensionsAdded,
    extensionsRemoved,
    operationsAdded,
    operationsRemoved,
    quotaChanges,
    commitmentChange,
    priceDeltaCents,
    requiresNewContract,
    requiresReprovisioning,
    reasons,
  };
}

// ── offboarding / retention ──────────────────────────────────────────────
export interface OffboardingPlan {
  retentionPolicyVersion: number | null;
  actions: Array<{ dataCategory: string; retention: string; action: string }>;
  summary: string;
}

/** The data-handling plan shown to a tenant that is leaving — resolved from
 *  the current published retention policy, never improvised. */
export async function resolveOffboardingPlan(db: SupabaseClient): Promise<OffboardingPlan> {
  const { data } = await db
    .from("retention_policies")
    .select("version, rules, summary")
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) {
    return {
      retentionPolicyVersion: null,
      actions: [],
      summary: "Nenhuma política de retenção publicada.",
    };
  }
  const rules =
    (data.rules as Array<{ dataCategory: string; retention: string; action: string }>) ?? [];
  return {
    retentionPolicyVersion: data.version as number,
    actions: rules.map((r) => ({
      dataCategory: r.dataCategory,
      retention: r.retention,
      action: r.action,
    })),
    summary: (data.summary as string) ?? "",
  };
}
