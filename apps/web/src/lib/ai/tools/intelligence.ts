import type { AgentTool } from "../tool-types";
import {
  resolvePlanDue,
  deriveHealthScoreInputs,
  computeAssetHealthScore,
  detectAssetAnomalies,
  computePredictiveRisk,
  computeAssetEconomics,
  type MaintenanceOrderStatus,
  type MaintenanceOrderType,
  type MaintenancePlan,
  type MaintenancePlanTriggerType,
} from "@shina/maintenance-engine";

// Wave 7 — Operational Intelligence. Every tool here wraps a DETERMINISTIC
// engine already live behind its own route (health-score/predictive-risk/
// economics/anomalies/insights) — same query + same engine function calls,
// never a second implementation of the math. Per the spec's own rule for
// this wave, the LLM only explains/contextualizes these numbers, it never
// computes them — confirmed via a real audit that none of these routes
// call an LLM (unlike /api/ai/insights and /api/maintenance/copilot,
// which are LLM-backed and deliberately NOT wrapped here — wrapping those
// would mean the agent silently triggers a second, separately-billed AI
// call the user never asked for).

function toEngineShape(row: Record<string, unknown>): MaintenancePlan {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    assetId: (row.asset_id as string) ?? null,
    assetTypeId: (row.asset_type_id as string) ?? null,
    name: row.name as string,
    triggerType: row.trigger_type as MaintenancePlanTriggerType,
    intervalDays: (row.interval_days as number) ?? null,
    intervalOdometer: (row.interval_odometer as number) ?? null,
    intervalHourMeter: (row.interval_hour_meter as number) ?? null,
    conditionNotes: (row.condition_notes as string) ?? null,
    lastTriggeredAt: (row.last_triggered_at as string) ?? null,
    lastTriggeredOdometer: (row.last_triggered_odometer as number) ?? null,
    lastTriggeredHourMeter: (row.last_triggered_hour_meter as number) ?? null,
    active: row.active as boolean,
  };
}

interface OrderRow {
  id: string;
  type: MaintenanceOrderType;
  status: MaintenanceOrderStatus;
  opened_at: string;
  total_cost_cents: number;
  downtime_start: string | null;
  downtime_end: string | null;
  odometer: number | null;
  maintenance_items: { component: string }[] | null;
}

async function loadAssetAndOrders(
  scope: { db: import("@supabase/supabase-js").SupabaseClient; tenantId: string },
  assetId: string,
) {
  const { data: asset } = await scope.db
    .from("assets")
    .select("id, odometer, hour_meter, acquisition_cost_cents, created_at")
    .eq("id", assetId)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (!asset) return null;

  const [{ data: orders }, { data: plans }] = await Promise.all([
    scope.db
      .from("maintenance_orders")
      .select(
        "id, type, status, opened_at, total_cost_cents, downtime_start, downtime_end, odometer, maintenance_items(component)",
      )
      .eq("tenant_id", scope.tenantId)
      .eq("asset_id", assetId)
      .is("deleted_at", null),
    scope.db
      .from("maintenance_plans")
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("asset_id", assetId)
      .eq("active", true)
      .is("deleted_at", null),
  ]);
  return { asset, orders: (orders ?? []) as unknown as OrderRow[], plans: plans ?? [] };
}

export const getAssetHealthScoreTool: AgentTool<{ assetId: string }> = {
  name: "get_asset_health_score",
  description:
    "Score de saúde (0-100) de um ativo, com detalhamento das deduções (manutenção preventiva atrasada, frequência de corretivas, downtime, ordens abertas antigas).",
  inputSchema: {
    type: "object",
    properties: { assetId: { type: "string", description: "UUID do ativo" } },
    required: ["assetId"],
  },
  requiredPermission: "tenant.maintenance.view",
  requiredFeature: "agent.tools.intelligence",
  async execute(args, _ctx, scope) {
    const loaded = await loadAssetAndOrders(scope, args.assetId);
    if (!loaded) return { ok: false, error: "asset not found" };
    const now = new Date();
    const plansDue = loaded.plans.map((row) => ({
      result: resolvePlanDue(toEngineShape(row), {
        now,
        currentOdometer: loaded.asset.odometer,
        currentHourMeter: loaded.asset.hour_meter,
      }),
    }));
    const engineOrders = loaded.orders.map((r) => ({
      type: r.type,
      status: r.status,
      downtimeStart: r.downtime_start,
      downtimeEnd: r.downtime_end,
      openedAt: r.opened_at,
    }));
    const input = deriveHealthScoreInputs({ now, plansDue, orders: engineOrders });
    const result = computeAssetHealthScore(input);
    return { ok: true, data: { ...result, computedAt: now.toISOString() } };
  },
};

export const getAssetPredictiveRiskTool: AgentTool<{ assetId: string }> = {
  name: "get_asset_predictive_risk",
  description:
    "Estimativa determinística de risco (não é probabilidade de falha) de um ativo, combinando score de saúde, anomalias e proximidade de manutenção preventiva.",
  inputSchema: {
    type: "object",
    properties: { assetId: { type: "string", description: "UUID do ativo" } },
    required: ["assetId"],
  },
  requiredPermission: "tenant.maintenance.ai_use",
  requiredFeature: "agent.tools.intelligence",
  async execute(args, _ctx, scope) {
    const loaded = await loadAssetAndOrders(scope, args.assetId);
    if (!loaded) return { ok: false, error: "asset not found" };
    const now = new Date();
    const anomalyOrders = loaded.orders.map((r) => ({
      id: r.id,
      type: r.type,
      openedAt: r.opened_at,
      totalCostCents: r.total_cost_cents,
      downtimeStart: r.downtime_start,
      downtimeEnd: r.downtime_end,
      odometer: r.odometer,
      items: r.maintenance_items ?? [],
    }));
    const healthOrders = loaded.orders.map((r) => ({
      type: r.type,
      status: r.status,
      downtimeStart: r.downtime_start,
      downtimeEnd: r.downtime_end,
      openedAt: r.opened_at,
    }));
    const planContexts = loaded.plans.map((row) => ({
      result: resolvePlanDue(toEngineShape(row), {
        now,
        currentOdometer: loaded.asset.odometer,
        currentHourMeter: loaded.asset.hour_meter,
      }),
      intervalOdometer: (row.interval_odometer as number) ?? null,
      intervalHourMeter: (row.interval_hour_meter as number) ?? null,
      intervalDays: (row.interval_days as number) ?? null,
    }));
    const healthScoreInput = deriveHealthScoreInputs({
      now,
      plansDue: planContexts.map((p) => ({ result: p.result })),
      orders: healthOrders,
    });
    const healthScore = computeAssetHealthScore(healthScoreInput);
    const anomalies = detectAssetAnomalies(anomalyOrders);
    const risk = computePredictiveRisk({ now, healthScore, anomalies, plans: planContexts });
    return { ok: true, data: risk };
  },
};

export const getAssetEconomicsTool: AgentTool<{ assetId: string }> = {
  name: "get_asset_economics",
  description:
    "Custo total de manutenção e indicadores de TCO (custo total de propriedade) de um ativo.",
  inputSchema: {
    type: "object",
    properties: { assetId: { type: "string", description: "UUID do ativo" } },
    required: ["assetId"],
  },
  requiredPermission: "tenant.maintenance.analytics_view",
  requiredFeature: "agent.tools.intelligence",
  async execute(args, _ctx, scope) {
    const { data: asset } = await scope.db
      .from("assets")
      .select("id, odometer, hour_meter, acquisition_cost_cents, created_at")
      .eq("id", args.assetId)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();
    if (!asset) return { ok: false, error: "asset not found" };

    const { data: orders } = await scope.db
      .from("maintenance_orders")
      .select("total_cost_cents")
      .eq("tenant_id", scope.tenantId)
      .eq("asset_id", args.assetId)
      .is("deleted_at", null);
    const totalMaintenanceCostCents = (orders ?? []).reduce(
      (sum, o) => sum + ((o.total_cost_cents as number) ?? 0),
      0,
    );
    const ownershipDays = asset.created_at
      ? (Date.now() - new Date(asset.created_at).getTime()) / 86_400_000
      : null;

    const economics = computeAssetEconomics({
      totalMaintenanceCostCents,
      acquisitionCostCents: asset.acquisition_cost_cents,
      ownershipDays,
      odometer: asset.odometer,
      hourMeter: asset.hour_meter,
    });
    return { ok: true, data: economics };
  },
};

export const getAssetAnomaliesTool: AgentTool<{ assetId: string }> = {
  name: "get_asset_anomalies",
  description:
    "Anomalias detectadas no histórico de manutenção de um ativo (custo fora do padrão, downtime fora do padrão, componente recorrente, regressão de odômetro, alta taxa de corretivas).",
  inputSchema: {
    type: "object",
    properties: { assetId: { type: "string", description: "UUID do ativo" } },
    required: ["assetId"],
  },
  requiredPermission: "tenant.maintenance.view",
  requiredFeature: "agent.tools.intelligence",
  async execute(args, _ctx, scope) {
    const { data: asset } = await scope.db
      .from("assets")
      .select("id")
      .eq("id", args.assetId)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();
    if (!asset) return { ok: false, error: "asset not found" };

    const { data: orders, error } = await scope.db
      .from("maintenance_orders")
      .select(
        "id, type, status, opened_at, total_cost_cents, downtime_start, downtime_end, odometer, maintenance_items(component)",
      )
      .eq("tenant_id", scope.tenantId)
      .eq("asset_id", args.assetId)
      .is("deleted_at", null);
    if (error) return { ok: false, error: error.message };

    const rows = (orders ?? []) as unknown as OrderRow[];
    const anomalies = detectAssetAnomalies(
      rows.map((r) => ({
        id: r.id,
        type: r.type,
        openedAt: r.opened_at,
        totalCostCents: r.total_cost_cents,
        downtimeStart: r.downtime_start,
        downtimeEnd: r.downtime_end,
        odometer: r.odometer,
        items: r.maintenance_items ?? [],
      })),
    );
    return { ok: true, data: anomalies };
  },
};

export const getMaintenanceInsightsTool: AgentTool<{ status?: string }> = {
  name: "get_maintenance_insights",
  description:
    "Lista os insights de manutenção do tenant (gerados pelo Maintenance Auditor determinístico) — ativos com saúde crítica, clusters de alto risco, saúde geral baixa da frota, recomendações antigas não tratadas.",
  inputSchema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        description: "Status do insight (padrão: open)",
        enum: ["open", "acknowledged", "dismissed", "all"],
      },
    },
  },
  requiredPermission: "tenant.maintenance.view",
  requiredFeature: "agent.tools.intelligence",
  async execute(args, _ctx, scope) {
    const status = args.status ?? "open";
    let q = scope.db.from("maintenance_insights").select("*").eq("tenant_id", scope.tenantId);
    if (status !== "all") q = q.eq("status", status);
    const { data, error } = await q
      .order("severity", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data ?? [] };
  },
};

interface AttentionItem {
  source: { type: string; id: string };
  reason: string;
  severity: "low" | "medium" | "high";
  recommendedAction: string;
}

// The cross-domain aggregator the spec's "o que precisa da minha atenção
// hoje" example asks for. No such aggregator existed anywhere in the
// codebase (confirmed by audit) — this fans out to 3 real, cheap,
// deterministic reads (maintenance_insights, contracts expiring soon,
// signature requests stuck pending) and normalizes each into the spec's
// {source, reason, severity, recommendedAction} shape. Deliberately never
// calls /api/ai/insights or /api/maintenance/auditor/run — those are an
// LLM call and a write/compute action respectively, neither of which this
// read-only summary may silently trigger.
export const getAttentionSummaryTool: AgentTool<Record<string, never>> = {
  name: "get_attention_summary",
  description:
    "Resumo do que precisa de atenção hoje: insights de manutenção abertos, contratos vencendo em breve, e assinaturas de contrato pendentes há muito tempo. Cada item tem origem, motivo, severidade e ação recomendada.",
  inputSchema: { type: "object", properties: {} },
  requiredFeature: "agent.tools.intelligence",
  async execute(_args, _ctx, scope) {
    const items: AttentionItem[] = [];

    const { data: insights } = await scope.db
      .from("maintenance_insights")
      .select("id, asset_id, type, severity, message")
      .eq("tenant_id", scope.tenantId)
      .eq("status", "open");
    for (const i of insights ?? []) {
      items.push({
        source: { type: i.asset_id ? "asset" : "fleet", id: i.asset_id ?? i.id },
        reason: i.message,
        severity: i.severity === "high" ? "high" : "medium",
        recommendedAction:
          i.type === "critical_health_asset"
            ? "Revisar plano de manutenção do ativo"
            : i.type === "stale_recommendations"
              ? "Tratar recomendações de manutenção pendentes"
              : "Revisar saúde geral da frota",
      });
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() + 15 * 86_400_000);
    const { data: contracts } = await scope.db
      .from("contracts")
      .select("id, period_ends_at, organizations(name)")
      .eq("tenant_id", scope.tenantId)
      .eq("status", "active")
      .is("deleted_at", null)
      .gte("period_ends_at", now.toISOString())
      .lte("period_ends_at", cutoff.toISOString());
    for (const c of contracts ?? []) {
      const org = c.organizations as unknown as { name: string } | null;
      items.push({
        source: { type: "contract", id: c.id },
        reason: `Contrato${org?.name ? ` de ${org.name}` : ""} vence em ${new Date(c.period_ends_at as string).toLocaleDateString("pt-BR")}.`,
        severity: "medium",
        recommendedAction: "Verificar renovação ou encerramento do contrato",
      });
    }

    const staleCutoff = new Date(now.getTime() - 3 * 86_400_000).toISOString();
    const { data: pendingSignatures } = await scope.db
      .from("signature_requests")
      .select(
        "id, contract_id, status, created_at, contracts!inner(id, tenant_id, organizations(name))",
      )
      .eq("contracts.tenant_id", scope.tenantId)
      .in("status", ["sent", "in_progress"])
      .lte("created_at", staleCutoff);
    for (const s of pendingSignatures ?? []) {
      const contract = s.contracts as unknown as {
        id: string;
        organizations: { name: string } | null;
      };
      items.push({
        source: { type: "contract", id: s.contract_id as string },
        reason: `Assinatura do contrato${contract?.organizations?.name ? ` de ${contract.organizations.name}` : ""} está pendente há mais de 3 dias.`,
        severity: "medium",
        recommendedAction: "Cobrar assinatura ou reenviar solicitação",
      });
    }

    const severityOrder = { high: 0, medium: 1, low: 2 };
    items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return { ok: true, data: items };
  },
};
