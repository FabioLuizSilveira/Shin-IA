import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import Link from "next/link";
import { ArrowLeft, Users, DollarSign, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

interface TenantDetailPageProps {
  params: { id: string };
}

export default function TenantDetailPage({ params }: TenantDetailPageProps) {
  const { id } = params;

  return (
    <AppShell title="Detalhes do Tenant">
      <div className="mb-4">
        <Link
          href="/tenants"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 no-underline transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Tenants
        </Link>
      </div>

      <SectionHeader
        title={`Tenant #${id}`}
        description="Visão completa do tenant, billing e usuários."
        action={<StatusBadge status="active" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <MetricCard title="Usuários" value="24" icon={<Users className="w-5 h-5" />} />
        <MetricCard
          title="Receita Mensal"
          value="R$ 12.400"
          trend="up"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          title="Uptime"
          value="99.9%"
          trend="up"
          icon={<Activity className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {["Visão Geral", "Billing", "Usuários", "Integrações"].map((section) => (
          <div key={section} className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-base font-semibold text-slate-900 font-display mb-3">{section}</h3>
            <p className="text-sm text-slate-400">
              Dados de {section.toLowerCase()} serão exibidos aqui.
            </p>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
