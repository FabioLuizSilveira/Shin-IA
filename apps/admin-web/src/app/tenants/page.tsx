import { AppShell } from "@/components/layout/app-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Building2, Users, DollarSign, TrendingDown, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

const TENANTS = [
  {
    id: "1",
    name: "Transportes Silva Ltda",
    plan: "Enterprise",
    status: "active" as const,
    revenue: "R$ 12.400",
    users: 24,
    since: "Jan 2024",
  },
  {
    id: "2",
    name: "Logística Rápida S/A",
    plan: "Pro",
    status: "active" as const,
    revenue: "R$ 5.200",
    users: 12,
    since: "Mar 2024",
  },
  {
    id: "3",
    name: "Frota Express ME",
    plan: "Starter",
    status: "pending" as const,
    revenue: "R$ 800",
    users: 3,
    since: "Mai 2024",
  },
  {
    id: "4",
    name: "ABC Distribuição",
    plan: "Pro",
    status: "inactive" as const,
    revenue: "R$ 0",
    users: 0,
    since: "Out 2023",
  },
  {
    id: "5",
    name: "Norte Transportes",
    plan: "Enterprise",
    status: "active" as const,
    revenue: "R$ 18.700",
    users: 41,
    since: "Fev 2023",
  },
  {
    id: "6",
    name: "Sul Cargas Ltda",
    plan: "Pro",
    status: "warning" as const,
    revenue: "R$ 3.100",
    users: 8,
    since: "Jun 2024",
  },
];

type TenantRow = (typeof TENANTS)[number];

const COLUMNS = [
  { key: "name", label: "Empresa" },
  {
    key: "plan",
    label: "Plano",
    render: (row: TenantRow) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-shina-blue/10 text-shina-blue">
        {row.plan}
      </span>
    ),
  },
  {
    key: "status",
    label: "Status",
    render: (row: TenantRow) => <StatusBadge status={row.status} />,
  },
  { key: "revenue", label: "Receita/mês" },
  { key: "users", label: "Usuários" },
  { key: "since", label: "Cliente desde" },
  {
    key: "actions",
    label: "",
    render: (_row: TenantRow) => (
      <button className="text-xs text-shina-blue hover:text-blue-700 font-medium bg-transparent border-0 cursor-pointer px-0">
        Ver detalhes →
      </button>
    ),
  },
];

export default function TenantsPage() {
  return (
    <AppShell title="Tenants">
      <SectionHeader
        title="Tenants"
        description="Gerencie empresas, planos e ciclo de vida na plataforma."
        action={
          <button className="flex items-center gap-2 px-4 py-2 bg-shina-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors cursor-pointer border-0">
            <Plus className="w-4 h-4" />
            Novo Tenant
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total Tenants"
          value="6"
          change={12}
          changeLabel="este mês"
          trend="up"
          icon={<Building2 className="w-5 h-5" />}
        />
        <MetricCard
          title="Ativos"
          value="4"
          change={5}
          changeLabel="vs. mês anterior"
          trend="up"
          icon={<Users className="w-5 h-5" />}
        />
        <MetricCard
          title="Receita MRR"
          value="R$ 40.200"
          change={8}
          changeLabel="crescimento"
          trend="up"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          title="Churn"
          value="1"
          change={-1}
          changeLabel="vs. mês anterior"
          trend="down"
          icon={<TrendingDown className="w-5 h-5" />}
        />
      </div>

      <DataTable columns={COLUMNS} data={TENANTS} />
    </AppShell>
  );
}
