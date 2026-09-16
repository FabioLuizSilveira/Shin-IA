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
