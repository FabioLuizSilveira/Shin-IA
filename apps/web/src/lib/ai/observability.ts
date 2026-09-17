import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModelTier } from "./model-router";

// Agent Runtime Architecture v2, Wave 6 (spec section 41 — observability
// is a stated gate, not an afterthought) — reads back the AI_AGENT_*
// events every wave since Wave 2 has already been logging via the
// existing logActivity()/tenant_activity_log pipeline (no new table, no
// parallel metrics store). This is the first real CONSUMER of
// INTENT_CLASSIFIED/TOOLS_FILTERED/MODEL_ROUTED — until this wave they
// were written but never read back anywhere.

interface ActivityLogRow {
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface RoutingMetrics {
  windowHours: number;
  totalRequests: number;
  intentClassification: {
    byMethod: Record<"deterministic" | "llm" | "none", number>;
    byConfidence: Record<"HIGH" | "MEDIUM" | "LOW", number>;
    byDomain: Record<string, number>;
  };
  toolFiltering: {
    forcedCount: number;
    fallbackCount: number;
    narrowedCount: number;
    avgCandidatesBeforeFilter: number;
    avgCandidatesAfterFilter: number;
  };
  modelRouting: Record<ModelTier, number>;
}

function emptyMetrics(windowHours: number): RoutingMetrics {
  return {
    windowHours,
    totalRequests: 0,
    intentClassification: {
      byMethod: { deterministic: 0, llm: 0, none: 0 },
      byConfidence: { HIGH: 0, MEDIUM: 0, LOW: 0 },
      byDomain: {},
    },
    toolFiltering: {
      forcedCount: 0,
      fallbackCount: 0,
      narrowedCount: 0,
      avgCandidatesBeforeFilter: 0,
      avgCandidatesAfterFilter: 0,
    },
    modelRouting: { FAST: 0, STANDARD: 0, COMPLEX: 0 },
  };
}

/** Aggregates this tenant's own AI_AGENT_INTENT_CLASSIFIED/
 * TOOLS_FILTERED/MODEL_ROUTED rows from the last `windowHours` — the
 * real evidence the master prompt's own gates ask for (tool-count
 * reduction, tier distribution, fallback rate) instead of a one-off
 * live test result that goes stale. Returns zeroed metrics (not an
 * error) when dynamic routing has never run for this tenant — a tenant
 * with the flag off is a valid, expected state, not a failure. */
export async function getRoutingMetrics(
  db: SupabaseClient,
  tenantId: string,
  windowHours = 24,
): Promise<RoutingMetrics> {
  const since = new Date(Date.now() - windowHours * 3_600_000).toISOString();
  const { data } = await db
    .from("tenant_activity_log")
    .select("action, metadata, created_at")
    .eq("tenant_id", tenantId)
    .in("action", [
      "AI_AGENT_INTENT_CLASSIFIED",
      "AI_AGENT_TOOLS_FILTERED",
      "AI_AGENT_MODEL_ROUTED",
    ])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);

  const metrics = emptyMetrics(windowHours);
  const rows = (data ?? []) as ActivityLogRow[];
  if (rows.length === 0) return metrics;

  let beforeSum = 0;
  let afterSum = 0;
  let filterEvents = 0;
  let classifiedEvents = 0;

  for (const row of rows) {
    const m = row.metadata ?? {};
    switch (row.action) {
      case "AI_AGENT_INTENT_CLASSIFIED": {
        classifiedEvents++;
        const method = m.method as string;
        if (method === "deterministic" || method === "llm" || method === "none") {
          metrics.intentClassification.byMethod[method]++;
        }
        const confidence = m.confidence as string;
        if (confidence === "HIGH" || confidence === "MEDIUM" || confidence === "LOW") {
          metrics.intentClassification.byConfidence[confidence]++;
        }
        const domain = m.domain as string | null;
        if (domain) {
          metrics.intentClassification.byDomain[domain] =
            (metrics.intentClassification.byDomain[domain] ?? 0) + 1;
        }
        break;
      }
      case "AI_AGENT_TOOLS_FILTERED": {
        filterEvents++;
        if (m.forced) metrics.toolFiltering.forcedCount++;
        if (m.isFallback) metrics.toolFiltering.fallbackCount++;
        else if (!m.forced) metrics.toolFiltering.narrowedCount++;
        beforeSum += Number(m.candidatesBeforeFilter ?? 0);
        afterSum += Number(m.candidatesAfterFilter ?? 0);
        break;
      }
      case "AI_AGENT_MODEL_ROUTED": {
        const tier = m.tier as ModelTier;
        if (tier === "FAST" || tier === "STANDARD" || tier === "COMPLEX") {
          metrics.modelRouting[tier]++;
        }
        break;
      }
    }
  }

  metrics.totalRequests = classifiedEvents;
  if (filterEvents > 0) {
    metrics.toolFiltering.avgCandidatesBeforeFilter =
      Math.round((beforeSum / filterEvents) * 10) / 10;
    metrics.toolFiltering.avgCandidatesAfterFilter =
      Math.round((afterSum / filterEvents) * 10) / 10;
  }

  return metrics;
}

// Agent Runtime v3, Wave 6 (spec section 46 — this metric list is named
// explicitly in the master prompt, "duplicate_question_rate deve ser
// medido" in particular) — the goal/workflow/entity counterpart to
// getRoutingMetrics() above, same real-evidence-not-a-one-off-test
// posture (spec section 57: "Do not falsify metrics. Report actual
// results."). Reads back the AGENT_GOAL_*/AGENT_ENTITY_*/
// AGENT_WORKFLOW_* events Wave 1-6 have been logging since they were
// introduced — no new table, no parallel metrics store.

export interface GoalMetrics {
  windowHours: number;
  goalsStarted: number;
  goalsCompleted: number;
  goalCompletionRate: number;
  averageTurnsPerGoal: number;
  /** A goal asking for the SAME missing field twice in a row without any
   * real progress in between — the master prompt's own regression
   * definition ("perguntar novamente nome/documento de um Customer já
   * resolvido é regressão"). Structurally rare by design
   * (computeNextBestAction only ever asks for a genuinely still-missing
   * field), so a non-zero rate here is a real signal something's wrong,
   * not just a KPI to watch. */
  duplicateQuestionRate: number;
  entityResolutionSuccessRate: number;
  entityAmbiguityRate: number;
  workflowResumeSuccessRate: number;
}

function emptyGoalMetrics(windowHours: number): GoalMetrics {
  return {
    windowHours,
    goalsStarted: 0,
    goalsCompleted: 0,
    goalCompletionRate: 0,
    averageTurnsPerGoal: 0,
    duplicateQuestionRate: 0,
    entityResolutionSuccessRate: 0,
    entityAmbiguityRate: 0,
    workflowResumeSuccessRate: 0,
  };
}

interface GoalActivityRow {
  action: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function getGoalMetrics(
  db: SupabaseClient,
  tenantId: string,
  windowHours = 24,
): Promise<GoalMetrics> {
  const since = new Date(Date.now() - windowHours * 3_600_000).toISOString();
  const { data } = await db
    .from("tenant_activity_log")
    .select("action, entity_id, metadata, created_at")
    .eq("tenant_id", tenantId)
    .in("action", [
      "AGENT_WORKFLOW_STARTED",
      "AGENT_WORKFLOW_RESUMED",
      "AGENT_WORKFLOW_STEP_COMPLETED",
      "AGENT_GOAL_COMPLETED",
      "AGENT_NEXT_ACTION_SELECTED",
      "AGENT_ENTITY_RESOLVED",
      "AGENT_ENTITY_AMBIGUOUS",
    ])
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(5000);

  const metrics = emptyGoalMetrics(windowHours);
  const rows = (data ?? []) as GoalActivityRow[];
  if (rows.length === 0) return metrics;

  let entityResolved = 0;
  let entityAmbiguous = 0;
  const startedGoalIds = new Set<string>();
  const completedGoalIds = new Set<string>();
  const resumedGoalIds = new Set<string>();
  const progressedAfterResumeGoalIds = new Set<string>();
  const turnsPerGoal = new Map<string, number>();
  // Per-goal ordered ASK_USER history — detects the SAME missingKey
  // asked twice with no WORKFLOW_STEP_COMPLETED in between.
  const lastAskedKeyPerGoal = new Map<string, string>();
  const stepSeenSinceLastAsk = new Set<string>();
  let askUserEvents = 0;
  let duplicateAskEvents = 0;

  for (const row of rows) {
    const m = row.metadata ?? {};
    const goalId = row.entity_id;
    switch (row.action) {
      case "AGENT_ENTITY_RESOLVED":
        entityResolved++;
        break;
      case "AGENT_ENTITY_AMBIGUOUS":
        entityAmbiguous++;
        break;
      case "AGENT_WORKFLOW_STARTED":
        if (goalId) startedGoalIds.add(goalId);
        break;
      case "AGENT_WORKFLOW_RESUMED":
        if (goalId) resumedGoalIds.add(goalId);
        break;
      case "AGENT_GOAL_COMPLETED":
        if (goalId) completedGoalIds.add(goalId);
        break;
      case "AGENT_WORKFLOW_STEP_COMPLETED":
        if (goalId) {
          stepSeenSinceLastAsk.add(goalId);
          if (resumedGoalIds.has(goalId)) progressedAfterResumeGoalIds.add(goalId);
        }
        break;
      case "AGENT_NEXT_ACTION_SELECTED":
        if (goalId) {
          turnsPerGoal.set(goalId, (turnsPerGoal.get(goalId) ?? 0) + 1);
          if (m.action === "ASK_USER" && typeof m.missingKey === "string") {
            askUserEvents++;
            const lastKey = lastAskedKeyPerGoal.get(goalId);
            if (lastKey === m.missingKey && !stepSeenSinceLastAsk.has(goalId)) {
              duplicateAskEvents++;
            }
            lastAskedKeyPerGoal.set(goalId, m.missingKey);
            stepSeenSinceLastAsk.delete(goalId);
          }
        }
        break;
    }
  }

  metrics.goalsStarted = startedGoalIds.size;
  metrics.goalsCompleted = completedGoalIds.size;
  metrics.goalCompletionRate =
    startedGoalIds.size > 0
      ? Math.round((completedGoalIds.size / startedGoalIds.size) * 1000) / 1000
      : 0;
  const totalTurns = [...turnsPerGoal.values()].reduce((a, b) => a + b, 0);
  metrics.averageTurnsPerGoal =
    turnsPerGoal.size > 0 ? Math.round((totalTurns / turnsPerGoal.size) * 10) / 10 : 0;
  metrics.duplicateQuestionRate =
    askUserEvents > 0 ? Math.round((duplicateAskEvents / askUserEvents) * 1000) / 1000 : 0;
  const entityTotal = entityResolved + entityAmbiguous;
  metrics.entityResolutionSuccessRate =
    entityTotal > 0 ? Math.round((entityResolved / entityTotal) * 1000) / 1000 : 0;
  metrics.entityAmbiguityRate =
    entityTotal > 0 ? Math.round((entityAmbiguous / entityTotal) * 1000) / 1000 : 0;
  metrics.workflowResumeSuccessRate =
    resumedGoalIds.size > 0
      ? Math.round((progressedAfterResumeGoalIds.size / resumedGoalIds.size) * 1000) / 1000
      : 0;

  return metrics;
}
