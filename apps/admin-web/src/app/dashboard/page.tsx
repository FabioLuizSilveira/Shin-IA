"use client";

import { useState, useEffect } from "react";
import { Building2, Users, DollarSign, Activity, AlertCircle, Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionHeader } from "@/components/ui/section-header";

interface PlatformMetrics {
  totalTenants: number;
  activeTenants: number;
  totalRevenue: number;
  activeOperations: number;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/metrics")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data: PlatformMetrics) => setMetrics(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="Dashboard">
      <SectionHeader
        title="Visão Geral da Plataforma"
        description="Métricas em tempo real da plataforma Shinã."
      />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 text-destructive gap-2">
          <AlertCircle className="w-8 h-8" />
          <p>Erro ao carregar as métricas. Tente novamente mais tarde.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Total Tenants"
            value={String(metrics?.totalTenants ?? 0)}
            icon={<Building2 className="w-5 h-5" />}
            trend="neutral"
          />
          <MetricCard
            title="Tenants Ativos"
            value={String(metrics?.activeTenants ?? 0)}
            icon={<Users className="w-5 h-5" />}
            trend="up"
          />
          <MetricCard
            title="Receita Paga"
            value={formatCurrency(metrics?.totalRevenue ?? 0)}
            icon={<DollarSign className="w-5 h-5" />}
            trend="up"
          />
          <MetricCard
            title="Operações Ativas"
            value={String(metrics?.activeOperations ?? 0)}
            icon={<Activity className="w-5 h-5" />}
            trend="neutral"
          />
        </div>
      )}
    </AppShell>
  );
}
