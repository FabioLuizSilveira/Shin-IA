import type { AgentTool } from "../tool-types";
import { KpiEngine } from "@shina/reporting-engine";
import { createKpiDataProvider } from "@/lib/kpi-data-provider";

// Reuses the entire GET /api/tenant-reports pipeline (counts + KpiEngine),
// not a new reporting path — the LLM never computes these numbers itself,
// it only reads and explains this deterministic engine's output (spec's
// own Wave 7 rule, applied here too since the underlying pipeline already
// exists).
function resolvePeriod(raw?: string): { start: string; end: string } {
  if (raw) {
    const [start, end] = raw.split(",");
    if (start && end) return { start, end };
  }
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export const generateBasicReportTool: AgentTool<{ period?: string }> = {
  name: "generate_basic_report",
  description:
    "Gera um relatório operacional básico do tenant (operações, ativos, contratos, faturas e KPIs) para um período, padrão o mês corrente.",
  inputSchema: {
    type: "object",
    properties: {
      period: {
        type: "string",
        description: "Período no formato 'inicio_iso,fim_iso', opcional — padrão mês corrente",
      },
    },
  },
  requiredPermission: "tenant.reports.view",
  requiredFeature: "agent.tools.reporting",
  async execute(args, _ctx, scope) {
    const tenantId = scope.tenantId;
    const [opsRes, assetsRes, contractsRes, invoicesRes] = await Promise.all([
      scope.db.from("operations").select("status").eq("tenant_id", tenantId).is("deleted_at", null),
      scope.db.from("assets").select("category").eq("tenant_id", tenantId).is("deleted_at", null),
      scope.db
        .from("contracts")
        .select("status, value_amount")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),
      scope.db
        .from("invoices")
        .select("status, total_amount")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),
    ]);
    const firstError = [opsRes, assetsRes, contractsRes, invoicesRes].find((r) => r.error)?.error;
    if (firstError) return { ok: false, error: firstError.message };

    const countBy = (
      rows: { status?: string; category?: string }[],
      key: "status" | "category",
    ) => {
      const counts: Record<string, number> = {};
      for (const row of rows) {
        const value = row[key] ?? "unknown";
        counts[value] = (counts[value] ?? 0) + 1;
      }
      return counts;
    };

    const contractsValueByStatus: Record<string, number> = {};
    for (const c of contractsRes.data ?? []) {
      contractsValueByStatus[c.status] =
        (contractsValueByStatus[c.status] ?? 0) + Number(c.value_amount);
    }
    const invoicesAmountByStatus: Record<string, number> = {};
    for (const i of invoicesRes.data ?? []) {
      invoicesAmountByStatus[i.status] =
        (invoicesAmountByStatus[i.status] ?? 0) + Number(i.total_amount);
    }

    const period = resolvePeriod(args.period);
    const kpiEngine = new KpiEngine(createKpiDataProvider(scope.db));
    const kpis = await kpiEngine.computeAll(tenantId, period);

    return {
      ok: true,
      data: {
        operationsByStatus: countBy(opsRes.data ?? [], "status"),
        assetsByCategory: countBy(assetsRes.data ?? [], "category"),
        contractsValueByStatus,
        invoicesAmountByStatus,
        kpis,
        period,
      },
    };
  },
};
