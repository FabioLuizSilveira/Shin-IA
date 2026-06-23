import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricCard } from "@/components/ui/metric-card";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Award, DollarSign } from "lucide-react";

export const dynamic = "force-dynamic";

const COMMISSIONS = [
  {
    id: "COM-001",
    operator: "João Silva",
    role: "Motorista",
    ops: 8,
    gross: "R$ 33.600",
    rate: "8%",
    commission: "R$ 2.688",
    status: "active" as const,
  },
  {
    id: "COM-002",
    operator: "Maria Santos",
    role: "Operadora",
    ops: 6,
    gross: "R$ 24.800",
    rate: "6%",
    commission: "R$ 1.488",
    status: "pending" as const,
  },
  {
    id: "COM-003",
    operator: "Carlos Ferreira",
    role: "Motorista",
    ops: 10,
    gross: "R$ 42.000",
    rate: "8%",
    commission: "R$ 3.360",
    status: "pending" as const,
  },
  {
    id: "COM-004",
    operator: "Ana Lima",
    role: "Supervisora",
    ops: 14,
    gross: "R$ 66.400",
    rate: "4%",
    commission: "R$ 2.656",
    status: "active" as const,
  },
  {
    id: "COM-005",
    operator: "Pedro Costa",
    role: "Motorista",
    ops: 5,
    gross: "R$ 20.100",
    rate: "8%",
    commission: "R$ 1.608",
    status: "error" as const,
  },
];

type CommissionRow = (typeof COMMISSIONS)[number];

const COLUMNS = [
  { key: "id", label: "ID" },
  { key: "operator", label: "Colaborador" },
  { key: "role", label: "Função" },
  { key: "ops", label: "Operações" },
  { key: "gross", label: "Valor Bruto" },
  { key: "rate", label: "Taxa" },
  {
    key: "commission",
    label: "Comissão",
    render: (row: CommissionRow) => (
      <span className="font-semibold text-emerald-600">{row.commission}</span>
    ),
  },
  {
    key: "status",
    label: "Status",
    render: (row: CommissionRow) => (
      <StatusBadge
        status={row.status}
        label={
          row.status === "active" ? "Pago" : row.status === "pending" ? "Pendente" : "Contestado"
        }
      />
    ),
  },
];

export default function CommissionsPage() {
  return (
    <AppShell title="Comissões">
      <SectionHeader
        title="Comissões"
        description="Gestão e pagamento de comissões para motoristas e operadores."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total a Pagar"
          value="R$ 7.512"
          change={8}
          trend="up"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          title="Pendentes"
          value="2"
          trend="neutral"
          icon={<Award className="w-5 h-5" />}
        />
        <MetricCard
          title="Pagos este mês"
          value="R$ 5.344"
          trend="up"
          icon={<Award className="w-5 h-5" />}
        />
        <MetricCard
          title="Contestações"
          value="1"
          trend="down"
          icon={<Award className="w-5 h-5" />}
        />
      </div>

      <DataTable columns={COLUMNS} data={COMMISSIONS} />
    </AppShell>
  );
}
