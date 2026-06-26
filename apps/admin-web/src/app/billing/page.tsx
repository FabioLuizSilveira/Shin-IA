import { AppShell } from "@/components/layout/app-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";

export const dynamic = "force-dynamic";

const INVOICES = [
  {
    id: "INV-001",
    tenant: "Transportes Silva Ltda",
    plan: "Enterprise",
    amount: "R$ 12.400",
    status: "active" as const,
    due: "01/07/2026",
  },
  {
    id: "INV-002",
    tenant: "Logística Rápida S/A",
    plan: "Pro",
    amount: "R$ 5.200",
    status: "active" as const,
    due: "05/07/2026",
  },
  {
    id: "INV-003",
    tenant: "Frota Express ME",
    plan: "Starter",
    amount: "R$ 800",
    status: "pending" as const,
    due: "10/07/2026",
  },
  {
    id: "INV-004",
    tenant: "Norte Transportes",
    plan: "Enterprise",
    amount: "R$ 18.700",
    status: "active" as const,
    due: "01/07/2026",
  },
  {
    id: "INV-005",
    tenant: "Sul Cargas Ltda",
    plan: "Pro",
    amount: "R$ 3.100",
    status: "warning" as const,
    due: "15/07/2026",
  },
];

type InvoiceRow = (typeof INVOICES)[number];

const COLUMNS = [
  { key: "id", label: "Fatura" },
  { key: "tenant", label: "Empresa" },
  { key: "plan", label: "Plano" },
  { key: "amount", label: "Valor" },
  {
    key: "status",
    label: "Status",
    render: (row: InvoiceRow) => <StatusBadge status={row.status} />,
  },
  { key: "due", label: "Vencimento" },
];

export default function BillingPage() {
  return (
    <AppShell title="Billing & Receita">
      <SectionHeader
        title="Billing & Receita"
        description="Gerencie assinaturas, faturas e receita de todos os tenants."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <MetricCard
          title="MRR"
          value="R$ 40.200"
          change={8.3}
          changeLabel="vs. mês anterior"
          trend="up"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          title="ARR"
          value="R$ 482.400"
          change={15.1}
          changeLabel="crescimento anual"
          trend="up"
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          title="Churn Rate"
          value="2.1%"
          change={-0.4}
          changeLabel="vs. mês anterior"
          trend="up"
          icon={<TrendingDown className="w-5 h-5" />}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900 font-display">Faturas Recentes</h3>
        </div>
        <DataTable columns={COLUMNS} data={INVOICES} />
      </div>
    </AppShell>
  );
}
