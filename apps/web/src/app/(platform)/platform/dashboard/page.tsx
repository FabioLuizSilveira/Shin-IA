"use client";

import { useState, useEffect } from "react";
import { Building2, Users, DollarSign, Activity } from "lucide-react";
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

  useEffect(() => {
    fetch("/api/metrics")
      .then((r) => r.json())
      .then((data: PlatformMetrics) => setMetrics(data))
      .catch(() => setMetrics(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="Dashboard">
      <SectionHeader
        title="Visão Geral da Plataforma"
        description="Métricas em tempo real da plataforma Shinã."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Total Tenants"
          value={loading ? "..." : String(metrics?.totalTenants ?? 0)}
          icon={<Building2 className="w-5 h-5" />}
          trend="neutral"
          href="/platform/tenants"
        />
        <MetricCard
          title="Tenants Ativos"
          value={loading ? "..." : String(metrics?.activeTenants ?? 0)}
          icon={<Users className="w-5 h-5" />}
          trend="up"
          href="/platform/tenants"
        />
        <MetricCard
          title="Receita Paga"
          value={loading ? "..." : formatCurrency(metrics?.totalRevenue ?? 0)}
          icon={<DollarSign className="w-5 h-5" />}
          trend="up"
          href="/platform/billing"
        />
        <MetricCard
          title="Operações Ativas"
          value={loading ? "..." : String(metrics?.activeOperations ?? 0)}
          icon={<Activity className="w-5 h-5" />}
          trend="neutral"
        />
      </div>
    </AppShell>
  );
}
