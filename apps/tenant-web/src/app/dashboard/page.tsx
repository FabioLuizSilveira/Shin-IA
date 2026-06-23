"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionHeader } from "@/components/ui/section-header";
import { ActivityTimeline } from "@/components/ui/activity-timeline";
import { ChartContainer } from "@/components/ui/chart-container";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { DonutChart } from "@/components/ui/donut-chart";
import { BarChart } from "@/components/ui/bar-chart";
import { ProgressBar } from "@/components/ui/progress-bar";
import { FileText, Truck, DollarSign, Zap } from "lucide-react";
import type { Operation, OperationStatus, Asset, Contract, AnalyticsData } from "@/types/domain";

function opStatusToUi(status: OperationStatus): "active" | "inactive" | "pending" | "warning" {
  switch (status) {
    case "in_progress":
      return "active";
    case "pending":
      return "pending";
    case "completed":
      return "inactive";
    default:
      return "warning";
  }
}

function opStatusLabel(status: OperationStatus): string {
  switch (status) {
    case "in_progress":
      return "Em andamento";
    case "pending":
      return "Pendente";
    case "completed":
      return "Concluída";
    case "cancelled":
      return "Cancelada";
    case "failed":
      return "Falhou";
    default:
      return status;
  }
}

type OpRow = {
  id: string;
  type: string;
  resource: string;
  uiStatus: "active" | "inactive" | "pending" | "warning";
  rawStatus: OperationStatus;
  date: string;
};

const OP_COLUMNS = [
  {
    key: "id",
    label: "Operação",
    render: (row: OpRow) => row.id.slice(0, 8).toUpperCase(),
  },
  { key: "type", label: "Tipo" },
  { key: "resource", label: "Recurso" },
  {
    key: "uiStatus",
    label: "Status",
    render: (row: OpRow) => (
      <StatusBadge status={row.uiStatus} label={opStatusLabel(row.rawStatus)} />
    ),
  },
  { key: "date", label: "Data" },
];

type TimelineItem = {
  time: string;
  title: string;
  description: string;
  type: "info" | "success" | "warning" | "error";
};

function operationsToTimeline(ops: Operation[]): TimelineItem[] {
  return ops.slice(0, 5).map((op) => {
    const isCompleted = op.status === "completed";
    const isInProgress = op.status === "in_progress";
    return {
      time: new Date(op.scheduled_starts_at).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      title: `Operação ${op.type} ${isCompleted ? "concluída" : isInProgress ? "em andamento" : "pendente"}`,
      description: op.resource_name ? `Recurso: ${op.resource_name}` : "Sem recurso associado",
      type: isCompleted
        ? ("success" as const)
        : isInProgress
          ? ("info" as const)
          : ("warning" as const),
    };
  });
}

export default function DashboardPage() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const [opsRes, assetsRes, contractsRes, analyticsRes] = await Promise.all([
          fetch("/api/operations"),
          fetch("/api/assets"),
          fetch("/api/contracts"),
          fetch("/api/analytics"),
        ]);

        if (opsRes.ok) {
          const json = (await opsRes.json()) as { data: Operation[] };
          setOperations(json.data ?? []);
        }
        if (assetsRes.ok) {
          const json = (await assetsRes.json()) as { data: Asset[] };
          setAssets(json.data ?? []);
        }
        if (contractsRes.ok) {
          const json = (await contractsRes.json()) as { data: Contract[] };
          setContracts(json.data ?? []);
        }
        if (analyticsRes.ok) {
          const json = (await analyticsRes.json()) as { data: AnalyticsData };
          setAnalytics(json.data);
        }
      } catch {
        // silently keep empty state
      } finally {
        setLoading(false);
      }
    }
    void fetchAll();
  }, []);

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const activeContracts = contracts.filter((c) => c.status === "active");
  const availableAssets = assets.filter((a) => a.status === "available");
  const openOps = operations.filter((o) => o.status === "pending" || o.status === "in_progress");
  const totalContractValue = activeContracts.reduce((sum, c) => sum + c.value_amount, 0);

  const recentOpsRows: OpRow[] = operations.slice(0, 5).map((op) => ({
    id: op.id,
    type: op.type,
    resource: op.resource_name ?? "—",
    uiStatus: opStatusToUi(op.status),
    rawStatus: op.status,
    date: new Date(op.scheduled_starts_at).toLocaleDateString("pt-BR"),
  }));

  const timeline = operationsToTimeline(operations);

  return (
    <AppShell title="Dashboard">
      <SectionHeader
        title="Dashboard"
        description={today.charAt(0).toUpperCase() + today.slice(1)}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Contratos Ativos"
          value={loading ? "—" : String(activeContracts.length)}
          trend="up"
          icon={<FileText className="w-5 h-5" />}
        />
        <MetricCard
          title="Ativos Disponíveis"
          value={loading ? "—" : `${availableAssets.length}/${assets.length}`}
          changeLabel="ativos"
          trend="neutral"
          icon={<Truck className="w-5 h-5" />}
        />
        <MetricCard
          title="Valor Contratos"
          value={
            loading
              ? "—"
              : new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(totalContractValue)
          }
          trend="up"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          title="Operações Abertas"
          value={loading ? "—" : String(openOps.length)}
          trend="up"
          icon={<Zap className="w-5 h-5" />}
        />
      </div>

      {/* Analytics row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Status das Operações</h3>
          {analytics ? (
            <DonutChart
              data={[
                {
                  label: "Em andamento",
                  value: analytics.operations.byStatus.in_progress,
                  color: "#2563EB",
                },
                {
                  label: "Pendentes",
                  value: analytics.operations.byStatus.pending,
                  color: "#F59E0B",
                },
                {
                  label: "Concluídas",
                  value: analytics.operations.byStatus.completed,
                  color: "#10B981",
                },
                {
                  label: "Canceladas",
                  value: analytics.operations.byStatus.cancelled,
                  color: "#EF4444",
                },
              ].filter((d) => d.value > 0)}
              centerValue={analytics.operations.total}
              centerLabel="Total"
            />
          ) : (
            <div className="h-24 bg-slate-50 rounded-lg animate-pulse" />
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Status da Frota</h3>
          {analytics ? (
            <BarChart
              data={[
                {
                  label: "Disponível",
                  value: analytics.assets.byStatus.available,
                  color: "#10B981",
                },
                { label: "Em uso", value: analytics.assets.byStatus.in_use, color: "#2563EB" },
                {
                  label: "Manutenção",
                  value: analytics.assets.byStatus.maintenance,
                  color: "#F59E0B",
                },
                {
                  label: "Inativo",
                  value: analytics.assets.byStatus.decommissioned,
                  color: "#94A3B8",
                },
              ]}
            />
          ) : (
            <div className="h-24 bg-slate-50 rounded-lg animate-pulse" />
          )}
        </div>
      </div>

      {/* Contract & rate summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Contratos Ativos</h3>
        {analytics ? (
          <div className="space-y-3">
            <ProgressBar
              label="Taxa de conclusão de operações"
              value={analytics.operations.completionRate}
              max={100}
              color="#10B981"
            />
            <ProgressBar
              label="Taxa de utilização da frota"
              value={analytics.assets.utilizationRate}
              max={100}
              color="#2563EB"
            />
            <ProgressBar
              label="Contratos ativos vs total"
              value={analytics.contracts.activeCount}
              max={analytics.contracts.total || 1}
              color="#06B6D4"
              showPercent={false}
            />
          </div>
        ) : (
          <div className="h-20 bg-slate-50 rounded-lg animate-pulse" />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartContainer
          title="Atividade Recente"
          description={today.charAt(0).toUpperCase() + today.slice(1)}
        >
          {loading ? (
            <div className="animate-pulse space-y-3 p-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 rounded" />
              ))}
            </div>
          ) : timeline.length > 0 ? (
            <ActivityTimeline items={timeline} />
          ) : (
            <p className="text-slate-400 text-sm p-4">Nenhuma atividade recente.</p>
          )}
        </ChartContainer>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-900 font-display">
              Próximas Operações
            </h3>
          </div>
          <div className="divide-y divide-slate-50 p-4 space-y-3">
            {loading ? (
              <div className="animate-pulse space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-8 bg-slate-100 rounded" />
                ))}
              </div>
            ) : openOps.length === 0 ? (
              <p className="text-slate-400 text-sm py-4 text-center">Nenhuma operação pendente.</p>
            ) : (
              openOps.slice(0, 5).map((op) => (
                <div key={op.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${op.status === "in_progress" ? "bg-shina-blue" : "bg-amber-400"}`}
                    />
                    <p className="text-sm text-slate-700">
                      {op.type} — {op.resource_name ?? "sem recurso"}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(op.scheduled_starts_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900 font-display">
            Operações Recentes
          </h3>
        </div>
        <DataTable
          columns={OP_COLUMNS as Parameters<typeof DataTable>[0]["columns"]}
          data={recentOpsRows as Parameters<typeof DataTable>[0]["data"]}
          loading={loading}
        />
      </div>
    </AppShell>
  );
}
