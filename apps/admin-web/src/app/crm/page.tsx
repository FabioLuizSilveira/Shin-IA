import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { Users, TrendingUp, Handshake } from "lucide-react";

export const dynamic = "force-dynamic";

const LEADS = [
  {
    id: "L-001",
    name: "Empresa ABC Transportes",
    contact: "Carlos Lima",
    stage: "Proposta",
    value: "R$ 8.400/mês",
    status: "active" as const,
    updated: "22/06/2026",
  },
  {
    id: "L-002",
    name: "XYZ Logística Ltda",
    contact: "Ana Santos",
    stage: "Qualificado",
    value: "R$ 3.200/mês",
    status: "pending" as const,
    updated: "21/06/2026",
  },
  {
    id: "L-003",
    name: "FastLog ME",
    contact: "Pedro Nunes",
    stage: "Negociação",
    value: "R$ 12.000/mês",
    status: "warning" as const,
    updated: "20/06/2026",
  },
  {
    id: "L-004",
    name: "Brasil Fretes",
    contact: "Marta Oliveira",
    stage: "Prospect",
    value: "—",
    status: "inactive" as const,
    updated: "18/06/2026",
  },
];

type LeadRow = (typeof LEADS)[number];

const COLUMNS = [
  { key: "id", label: "ID" },
  { key: "name", label: "Empresa" },
  { key: "contact", label: "Contato" },
  {
    key: "stage",
    label: "Etapa",
    render: (row: LeadRow) => (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
        {row.stage}
      </span>
    ),
  },
  { key: "value", label: "Valor Est." },
  { key: "status", label: "Status", render: (row: LeadRow) => <StatusBadge status={row.status} /> },
  { key: "updated", label: "Atualizado" },
];

export default function CrmPage() {
  return (
    <AppShell title="CRM">
      <SectionHeader
        title="CRM — Pipeline"
        description="Leads, parceiros e gestão do funil de franquias."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <MetricCard
          title="Leads Ativos"
          value="4"
          change={25}
          trend="up"
          icon={<Users className="w-5 h-5" />}
        />
        <MetricCard
          title="Valor Pipeline"
          value="R$ 23.600/mês"
          change={10}
          trend="up"
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          title="Parceiros"
          value="12"
          change={8}
          trend="up"
          icon={<Handshake className="w-5 h-5" />}
        />
      </div>

      <DataTable columns={COLUMNS} data={LEADS} />
    </AppShell>
  );
}
