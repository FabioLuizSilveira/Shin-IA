import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricCard } from "@/components/ui/metric-card";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";

export const dynamic = "force-dynamic";

const TRANSACTIONS = [
  {
    id: "TXN-001",
    description: "Recebimento contrato CTR-001",
    type: "Receita",
    amount: "R$ 18.400",
    status: "active" as const,
    date: "01/06/2026",
    category: "Serviços",
  },
  {
    id: "TXN-002",
    description: "Recebimento contrato CTR-002",
    type: "Receita",
    amount: "R$ 8.200",
    status: "active" as const,
    date: "01/06/2026",
    category: "Serviços",
  },
  {
    id: "TXN-003",
    description: "Combustível — frota junho",
    type: "Despesa",
    amount: "R$ 12.400",
    status: "inactive" as const,
    date: "10/06/2026",
    category: "Operação",
  },
  {
    id: "TXN-004",
    description: "Manutenção veículo DEF-5678",
    type: "Despesa",
    amount: "R$ 3.200",
    status: "inactive" as const,
    date: "15/06/2026",
    category: "Manutenção",
  },
  {
    id: "TXN-005",
    description: "Comissões motoristas — junho",
    type: "Despesa",
    amount: "R$ 8.700",
    status: "pending" as const,
    date: "30/06/2026",
    category: "RH",
  },
  {
    id: "TXN-006",
    description: "Recebimento contrato CTR-003",
    type: "Receita",
    amount: "R$ 12.000",
    status: "warning" as const,
    date: "25/06/2026",
    category: "Serviços",
  },
];

type TransactionRow = (typeof TRANSACTIONS)[number];

const COLUMNS = [
  { key: "id", label: "ID" },
  { key: "description", label: "Descrição" },
  {
    key: "type",
    label: "Tipo",
    render: (row: TransactionRow) => (
      <span
        className={`px-2 py-0.5 rounded text-xs font-medium ${row.type === "Receita" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
      >
        {row.type}
      </span>
    ),
  },
  { key: "category", label: "Categoria" },
  { key: "amount", label: "Valor" },
  {
    key: "status",
    label: "Status",
    render: (row: TransactionRow) => (
      <StatusBadge
        status={row.status}
        label={
          row.status === "active"
            ? "Pago"
            : row.status === "pending"
              ? "Pendente"
              : row.status === "warning"
                ? "Atrasado"
                : "Concluído"
        }
      />
    ),
  },
  { key: "date", label: "Data" },
];

export default function FinancialPage() {
  return (
    <AppShell title="Financeiro">
      <SectionHeader title="Financeiro" description="Receitas, despesas e fluxo de caixa do mês." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <MetricCard
          title="Receita Bruta (MTD)"
          value="R$ 38.600"
          change={15}
          changeLabel="vs. mês anterior"
          trend="up"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          title="Despesas (MTD)"
          value="R$ 24.300"
          change={5}
          changeLabel="vs. mês anterior"
          trend="down"
          icon={<TrendingDown className="w-5 h-5" />}
        />
        <MetricCard
          title="Lucro Líquido"
          value="R$ 14.300"
          change={28}
          changeLabel="crescimento"
          trend="up"
          icon={<TrendingUp className="w-5 h-5" />}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900 font-display">
            Transações Recentes
          </h3>
        </div>
        <DataTable columns={COLUMNS} data={TRANSACTIONS} />
      </div>
    </AppShell>
  );
}
