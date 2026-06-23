import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricCard } from "@/components/ui/metric-card";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Headphones, Clock, CheckCircle } from "lucide-react";

export const dynamic = "force-dynamic";

const TICKETS = [
  {
    id: "TKT-001",
    tenant: "Transportes Silva Ltda",
    subject: "Erro ao gerar relatório de faturamento",
    tier: "N1",
    priority: "Alta",
    status: "pending" as const,
    created: "22/06/2026 10:30",
  },
  {
    id: "TKT-002",
    tenant: "Norte Transportes",
    subject: "Integração com sistema SEFAZ falhando",
    tier: "N2",
    priority: "Crítica",
    status: "error" as const,
    created: "21/06/2026 15:00",
  },
  {
    id: "TKT-003",
    tenant: "Logística Rápida S/A",
    subject: "Dúvida sobre exportação de dados",
    tier: "N1",
    priority: "Baixa",
    status: "active" as const,
    created: "21/06/2026 09:15",
  },
  {
    id: "TKT-004",
    tenant: "Frota Express ME",
    subject: "Usuário não consegue acessar módulo de comissões",
    tier: "N1",
    priority: "Média",
    status: "pending" as const,
    created: "20/06/2026 14:00",
  },
];

type TicketRow = (typeof TICKETS)[number];

const COLUMNS = [
  { key: "id", label: "ID" },
  { key: "tenant", label: "Empresa" },
  { key: "subject", label: "Assunto" },
  {
    key: "tier",
    label: "Tier",
    render: (row: TicketRow) => (
      <span
        className={`px-2 py-0.5 rounded text-xs font-bold ${row.tier === "N2" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}
      >
        {row.tier}
      </span>
    ),
  },
  { key: "priority", label: "Prioridade" },
  {
    key: "status",
    label: "Status",
    render: (row: TicketRow) => <StatusBadge status={row.status} />,
  },
  { key: "created", label: "Aberto em" },
];

export default function SupportPage() {
  return (
    <AppShell title="Suporte">
      <SectionHeader
        title="Central de Suporte"
        description="Gerencie tickets de suporte N1, N2 e N3 de todos os tenants."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <MetricCard
          title="Tickets Abertos"
          value="4"
          change={-2}
          trend="up"
          icon={<Headphones className="w-5 h-5" />}
        />
        <MetricCard
          title="TMA"
          value="4h 20min"
          change={-15}
          changeLabel="vs. semana anterior"
          trend="up"
          icon={<Clock className="w-5 h-5" />}
        />
        <MetricCard
          title="CSAT"
          value="94%"
          change={2}
          trend="up"
          icon={<CheckCircle className="w-5 h-5" />}
        />
      </div>

      <DataTable columns={COLUMNS} data={TICKETS} />
    </AppShell>
  );
}
