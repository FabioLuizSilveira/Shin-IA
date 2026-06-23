"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricCard } from "@/components/ui/metric-card";
import { BarChart } from "@/components/ui/bar-chart";
import { DonutChart } from "@/components/ui/donut-chart";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ExportButton } from "@/components/ui/export-button";
import { FileText, TrendingUp, Truck, Zap } from "lucide-react";
import type { AnalyticsData } from "@/types/domain";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function ReportsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      try {
        const res = await fetch("/api/analytics");
        if (res.ok) {
          const json = (await res.json()) as { data: AnalyticsData };
          setAnalytics(json.data);
        }
      } catch {
        // silently keep empty state
      } finally {
        setLoading(false);
      }
    }
    void fetchAnalytics();
  }, []);

  return (
    <AppShell title="Relatórios">
      <SectionHeader
        title="Relatórios"
        description="Visão consolidada das métricas operacionais e financeiras."
      />

      {/* Summary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total Operações"
          value={loading ? "—" : String(analytics?.operations.total ?? 0)}
          trend="up"
          icon={<Zap className="w-5 h-5" />}
        />
        <MetricCard
          title="Taxa de Conclusão"
          value={loading ? "—" : `${analytics?.operations.completionRate ?? 0}%`}
          trend="up"
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          title="Utilização da Frota"
          value={loading ? "—" : `${analytics?.assets.utilizationRate ?? 0}%`}
          trend="neutral"
          icon={<Truck className="w-5 h-5" />}
        />
        <MetricCard
          title="Receita Ativa"
          value={loading ? "—" : formatCurrency(analytics?.contracts.totalRevenue ?? 0)}
          trend="up"
          icon={<FileText className="w-5 h-5" />}
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Operações por Status</h3>
          {analytics ? (
            <BarChart
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
                {
                  label: "Falhas",
                  value: analytics.operations.byStatus.failed,
                  color: "#94A3B8",
                },
              ]}
            />
          ) : (
            <div className="h-40 bg-slate-50 rounded-lg animate-pulse" />
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Distribuição de Ativos</h3>
          {analytics ? (
            <DonutChart
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
              ].filter((d) => d.value > 0)}
              centerValue={analytics.assets.total}
              centerLabel="Total"
            />
          ) : (
            <div className="h-40 bg-slate-50 rounded-lg animate-pulse" />
          )}
        </div>
      </div>

      {/* Contract analysis */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Análise de Contratos</h3>
        {analytics ? (
          <div className="space-y-3">
            <ProgressBar
              label="Contratos ativos"
              value={analytics.contracts.byStatus.active}
              max={analytics.contracts.total || 1}
              color="#10B981"
              showPercent={false}
            />
            <ProgressBar
              label="Contratos em rascunho"
              value={analytics.contracts.byStatus.draft}
              max={analytics.contracts.total || 1}
              color="#F59E0B"
              showPercent={false}
            />
            <ProgressBar
              label="Contratos expirados"
              value={analytics.contracts.byStatus.expired}
              max={analytics.contracts.total || 1}
              color="#94A3B8"
              showPercent={false}
            />
            <ProgressBar
              label="Contratos encerrados"
              value={analytics.contracts.byStatus.terminated}
              max={analytics.contracts.total || 1}
              color="#EF4444"
              showPercent={false}
            />
          </div>
        ) : (
          <div className="h-28 bg-slate-50 rounded-lg animate-pulse" />
        )}
      </div>

      {/* Category breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Ativos por Categoria</h3>
        {analytics ? (
          <BarChart
            data={Object.entries(analytics.assets.byCategory).map(([label, value]) => ({
              label,
              value,
              color: "#06B6D4",
            }))}
            height={180}
          />
        ) : (
          <div className="h-40 bg-slate-50 rounded-lg animate-pulse" />
        )}
      </div>

      {/* Export section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-1">Exportar Dados</h3>
        <p className="text-sm text-slate-500 mb-4">
          Baixe os dados em formato CSV para análise externa
        </p>
        <div className="flex flex-wrap gap-3">
          <ExportButton entity="operations" label="Operações" />
          <ExportButton entity="assets" label="Ativos" />
          <ExportButton entity="contracts" label="Contratos" />
          <ExportButton entity="invoices" label="Faturas" />
          <ExportButton entity="resources" label="Recursos" />
          <ExportButton entity="organizations" label="Organizações" />
        </div>
      </div>
    </AppShell>
  );
}
