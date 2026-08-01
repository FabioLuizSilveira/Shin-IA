"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { DonutChart } from "@/components/ui/donut-chart";
import { BarChart } from "@/components/ui/bar-chart";
import { MetricCard } from "@/components/ui/metric-card";
import { Activity, Boxes, DollarSign, Award, Gauge, Radio } from "lucide-react";

interface Kpi {
  type: "operations" | "assets" | "revenue" | "commissions" | "utilization" | "tracking";
  label: string;
  value: number;
  unit: string;
  previousValue: number | null;
  changePercent: number | null;
}

interface TenantReports {
  operationsByStatus: Record<string, number>;
  assetsByCategory: Record<string, number>;
  contractsValueByStatus: Record<string, number>;
  invoicesAmountByStatus: Record<string, number>;
  kpis: Kpi[];
}

const KPI_LABEL: Record<Kpi["type"], string> = {
  operations: "Operações no período",
  assets: "Ativos (acumulado)",
  revenue: "Receita recebida",
  commissions: "Comissões geradas",
  utilization: "Utilização da frota",
  tracking: "Veículos rastreados",
};

const KPI_ICON: Record<Kpi["type"], typeof Activity> = {
  operations: Activity,
  assets: Boxes,
  revenue: DollarSign,
  commissions: Award,
  utilization: Gauge,
  tracking: Radio,
};

function formatKpiValue(kpi: Kpi): string {
  if (kpi.unit === "BRL") return brl(kpi.value);
  if (kpi.unit === "%") return `${kpi.value}%`;
  return String(kpi.value);
}

const OPERATION_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
  failed: "Falhou",
};

const ASSET_CATEGORY_LABEL: Record<string, string> = {
  vehicle: "Veículo",
  equipment: "Equipamento",
  tool: "Ferramenta",
  property: "Imóvel",
  technology: "Tecnologia",
};

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  expired: "Expirado",
  terminated: "Rescindido",
  suspended: "Suspenso",
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  issued: "Emitida",
  paid: "Paga",
  overdue: "Vencida",
  cancelled: "Cancelada",
  voided: "Anulada",
};

const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#94a3b8"];

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function toSlices(counts: Record<string, number>, labels: Record<string, string>) {
  return Object.entries(counts).map(([key, value], i) => ({
    label: labels[key] ?? key,
    value,
    color: PALETTE[i % PALETTE.length],
  }));
}

function toBars(amounts: Record<string, number>, labels: Record<string, string>) {
  return Object.entries(amounts).map(([key, value], i) => ({
    label: labels[key] ?? key,
    value,
    color: PALETTE[i % PALETTE.length],
  }));
}

export default function TenantReportsPage() {
  const [data, setData] = useState<TenantReports | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tenant-reports")
      .then((r) => r.json())
      .then((json: { data?: TenantReports }) => setData(json.data ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="Relatórios">
      <SectionHeader
        title="Relatórios"
        description="Visão consolidada de operações, ativos, contratos e faturas."
      />

      {!loading && data && data.kpis.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {data.kpis.map((kpi) => {
            const Icon = KPI_ICON[kpi.type];
            const trend =
              kpi.changePercent === null || kpi.changePercent === 0
                ? "neutral"
                : kpi.changePercent > 0
                  ? "up"
                  : "down";
            return (
              <MetricCard
                key={kpi.type}
                title={KPI_LABEL[kpi.type]}
                value={formatKpiValue(kpi)}
                change={kpi.changePercent ?? undefined}
                changeLabel="vs. período anterior"
                icon={<Icon className="w-5 h-5" />}
                trend={trend}
              />
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-48 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 animate-pulse"
            />
          ))}
        </div>
      ) : !data ? (
        <p className="text-sm text-slate-500 text-center py-8">
          Não foi possível carregar os relatórios.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <p className="text-xs font-medium text-slate-500 mb-4 uppercase tracking-wide">
              Operações por status
            </p>
            {Object.keys(data.operationsByStatus).length === 0 ? (
              <p className="text-sm text-slate-500">Sem operações ainda.</p>
            ) : (
              <DonutChart data={toSlices(data.operationsByStatus, OPERATION_STATUS_LABEL)} />
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <p className="text-xs font-medium text-slate-500 mb-4 uppercase tracking-wide">
              Ativos por categoria
            </p>
            {Object.keys(data.assetsByCategory).length === 0 ? (
              <p className="text-sm text-slate-500">Sem ativos ainda.</p>
            ) : (
              <DonutChart data={toSlices(data.assetsByCategory, ASSET_CATEGORY_LABEL)} />
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            {Object.keys(data.contractsValueByStatus).length === 0 ? (
              <>
                <p className="text-xs font-medium text-slate-500 mb-4 uppercase tracking-wide">
                  Valor de contratos por status
                </p>
                <p className="text-sm text-slate-500">Sem contratos ainda.</p>
              </>
            ) : (
              <BarChart
                title="Valor de contratos por status"
                data={Object.entries(data.contractsValueByStatus).map(([key, value], i) => ({
                  label: CONTRACT_STATUS_LABEL[key] ?? key,
                  value,
                  color: PALETTE[i % PALETTE.length],
                }))}
              />
            )}
            {Object.keys(data.contractsValueByStatus).length > 0 && (
              <p className="text-xs text-slate-400 mt-3">
                Total: {brl(Object.values(data.contractsValueByStatus).reduce((s, v) => s + v, 0))}
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            {Object.keys(data.invoicesAmountByStatus).length === 0 ? (
              <>
                <p className="text-xs font-medium text-slate-500 mb-4 uppercase tracking-wide">
                  Faturas por status
                </p>
                <p className="text-sm text-slate-500">Sem faturas ainda.</p>
              </>
            ) : (
              <BarChart
                title="Faturas por status"
                data={toBars(data.invoicesAmountByStatus, INVOICE_STATUS_LABEL)}
              />
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
