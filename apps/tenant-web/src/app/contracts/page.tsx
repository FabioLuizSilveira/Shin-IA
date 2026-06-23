import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { MetricCard } from "@/components/ui/metric-card";
import { FileText, DollarSign, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

const CONTRACTS = [
  {
    id: "CTR-001",
    client: "Corporação Industrial SA",
    value: "R$ 18.400/mês",
    status: "active" as const,
    start: "01/01/2026",
    end: "31/12/2026",
    type: "Exclusivo",
  },
  {
    id: "CTR-002",
    client: "Logística Rápida Ltda",
    value: "R$ 8.200/mês",
    status: "active" as const,
    start: "01/03/2026",
    end: "28/02/2027",
    type: "Mensal",
  },
  {
    id: "CTR-003",
    client: "Exportadora Nunes & Cia",
    value: "R$ 12.000/mês",
    status: "warning" as const,
    start: "01/06/2026",
    end: "31/05/2027",
    type: "Semestral",
  },
  {
    id: "CTR-004",
    client: "Mercado Regional ME",
    value: "R$ 4.500/mês",
    status: "pending" as const,
    start: "01/07/2026",
    end: "30/06/2027",
    type: "Mensal",
  },
  {
    id: "CTR-005",
    client: "Distribuidora Central SA",
    value: "R$ 22.800/mês",
    status: "inactive" as const,
    start: "01/01/2025",
    end: "31/12/2025",
    type: "Anual",
  },
];

type ContractRow = (typeof CONTRACTS)[number];

const COLUMNS = [
  { key: "id", label: "Contrato" },
  { key: "client", label: "Cliente" },
  { key: "type", label: "Tipo" },
  { key: "value", label: "Valor" },
  {
    key: "status",
    label: "Status",
    render: (row: ContractRow) => <StatusBadge status={row.status} />,
  },
  { key: "start", label: "Início" },
  { key: "end", label: "Fim" },
  {
    key: "actions",
    label: "",
    render: (_row: ContractRow) => (
      <button className="text-xs text-shina-blue hover:text-blue-700 font-medium bg-transparent border-0 cursor-pointer">
        Ver →
      </button>
    ),
  },
];

export default function ContractsPage() {
  return (
    <AppShell title="Contratos">
      <SectionHeader
        title="Contratos"
        description="Gerencie contratos de locação e prestação de serviços."
        action={
          <button className="flex items-center gap-2 px-4 py-2 bg-shina-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors cursor-pointer border-0">
            <Plus className="w-4 h-4" />
            Novo Contrato
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <MetricCard
          title="Contratos Ativos"
          value="3"
          change={8}
          trend="up"
          icon={<FileText className="w-5 h-5" />}
        />
        <MetricCard
          title="Valor Total Mensal"
          value="R$ 65.900"
          change={12}
          trend="up"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          title="Em Renovação"
          value="1"
          trend="neutral"
          icon={<FileText className="w-5 h-5" />}
        />
      </div>

      <DataTable columns={COLUMNS} data={CONTRACTS} />
    </AppShell>
  );
}
