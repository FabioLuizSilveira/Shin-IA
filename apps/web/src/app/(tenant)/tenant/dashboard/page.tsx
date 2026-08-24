"use client";

import { useEffect, useState } from "react";
import { Activity, Boxes, FileSignature, Receipt, CalendarClock } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import type { OperationStatus } from "@/types/domain";

interface UpcomingOperation {
  id: string;
  type: string;
  status: string;
  scheduled_starts_at: string;
  resource_name: string | null;
}

interface TenantMetrics {
  activeOperations: number;
  upcomingOperations: UpcomingOperation[];
  assets: { available: number; total: number };
  contracts: { active: number; totalValue: number; expiringSoon: number };
  invoices: { outstanding: number; paidThisMonth: number };
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const OPERATION_TYPE_LABEL: Record<string, string> = {
  delivery: "Entrega",
  pickup: "Coleta",
  maintenance: "Manutenção",
  inspection: "Inspeção",
  transfer: "Transferência",
};

function operationStatusToUi(
  status: string,
): "active" | "inactive" | "pending" | "warning" | "error" {
  switch (status as OperationStatus) {
    case "in_progress":
      return "active";
    case "completed":
      return "inactive";
    case "cancelled":
    case "failed":
      return "error";
    default:
      return "pending";
  }
}

export default function TenantDashboardPage() {
  const [metrics, setMetrics] = useState<TenantMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tenant-metrics")
      .then((r) => r.json())
      .then((json: { data?: TenantMetrics }) => setMetrics(json.data ?? null))
      .catch(() => setMetrics(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="Dashboard">
      <SectionHeader
        title="Visão Geral"
        description="Resumo das operações, ativos, contratos e faturas do seu tenant."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Operações Ativas"
          value={loading ? "..." : String(metrics?.activeOperations ?? 0)}
          icon={<Activity className="w-5 h-5" />}
          trend="neutral"
          href="/tenant/operations"
        />
        <MetricCard
          title="Ativos Disponíveis"
          value={
            loading ? "..." : `${metrics?.assets.available ?? 0} / ${metrics?.assets.total ?? 0}`
          }
          icon={<Boxes className="w-5 h-5" />}
          trend="neutral"
          href="/tenant/assets"
        />
        <MetricCard
          title="Contratos Ativos"
          value={loading ? "..." : brl(metrics?.contracts.totalValue ?? 0)}
          changeLabel={
            metrics && metrics.contracts.expiringSoon > 0
              ? `${metrics.contracts.expiringSoon} vencendo em 30 dias`
              : undefined
          }
          icon={<FileSignature className="w-5 h-5" />}
          trend="neutral"
          href="/tenant/contracts"
        />
        <MetricCard
          title="Faturas em Aberto"
          value={loading ? "..." : brl(metrics?.invoices.outstanding ?? 0)}
          changeLabel={
            metrics && metrics.invoices.paidThisMonth > 0
              ? `${brl(metrics.invoices.paidThisMonth)} pago este mês`
              : undefined
          }
          icon={<Receipt className="w-5 h-5" />}
          trend={metrics && metrics.invoices.outstanding > 0 ? "down" : "neutral"}
          href="/tenant/billing"
        />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Próximas Operações
          </h3>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
            ))}
          </div>
        ) : !metrics || metrics.upcomingOperations.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">Nenhuma operação agendada.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {metrics.upcomingOperations.map((op) => (
              <li key={op.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-50">
                    {OPERATION_TYPE_LABEL[op.type] ?? op.type}
                    {op.resource_name && (
                      <span className="text-slate-500 font-normal"> · {op.resource_name}</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(op.scheduled_starts_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <StatusBadge status={operationStatusToUi(op.status)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
