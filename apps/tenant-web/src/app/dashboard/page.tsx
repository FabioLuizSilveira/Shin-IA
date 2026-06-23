import { AppShell } from "@/components/layout/app-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionHeader } from "@/components/ui/section-header";
import { ActivityTimeline } from "@/components/ui/activity-timeline";
import { ChartContainer } from "@/components/ui/chart-container";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { FileText, Truck, DollarSign, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

const TIMELINE = [
  {
    time: "08:30",
    title: "Operação #OP-0042 iniciada",
    description: "Veículo ABC-1234 saiu da base em direção a São Paulo",
    type: "info" as const,
  },
  {
    time: "09:15",
    title: "Contrato assinado",
    description: "Logística Corporativa SA assinou contrato de 6 meses",
    type: "success" as const,
  },
  {
    time: "10:00",
    title: "Documento pendente",
    description: "CTe #000045 aguarda aprovação do financeiro",
    type: "warning" as const,
  },
  {
    time: "11:30",
    title: "Entrega concluída",
    description: "OP-0041 finalizada com sucesso — cliente satisfeito",
    type: "success" as const,
  },
  {
    time: "13:00",
    title: "Alerta de manutenção",
    description: "Veículo DEF-5678 com revisão programada para amanhã",
    type: "warning" as const,
  },
];

const RECENT_OPS = [
  {
    id: "OP-0042",
    asset: "ABC-1234 — Scania R450",
    operator: "João Silva",
    status: "active" as const,
    value: "R$ 4.200",
    date: "22/06/2026",
  },
  {
    id: "OP-0041",
    asset: "DEF-5678 — Volvo FH",
    operator: "Maria Costa",
    status: "active" as const,
    value: "R$ 3.100",
    date: "22/06/2026",
  },
  {
    id: "OP-0040",
    asset: "GHI-9012 — Mercedes Actros",
    operator: "Carlos Nunes",
    status: "inactive" as const,
    value: "R$ 5.800",
    date: "21/06/2026",
  },
  {
    id: "OP-0039",
    asset: "JKL-3456 — Scania P320",
    operator: "Ana Lima",
    status: "inactive" as const,
    value: "R$ 2.400",
    date: "21/06/2026",
  },
];

type OpRow = (typeof RECENT_OPS)[number];

const OP_COLUMNS = [
  { key: "id", label: "Operação" },
  { key: "asset", label: "Ativo" },
  { key: "operator", label: "Operador" },
  {
    key: "status",
    label: "Status",
    render: (row: OpRow) => (
      <StatusBadge status={row.status} label={row.status === "active" ? "Em rota" : "Concluída"} />
    ),
  },
  { key: "value", label: "Valor" },
  { key: "date", label: "Data" },
];

export default function DashboardPage() {
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <AppShell title="Dashboard">
      <SectionHeader
        title="Dashboard"
        description={today.charAt(0).toUpperCase() + today.slice(1)}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Contratos Ativos"
          value="12"
          change={8}
          changeLabel="este mês"
          trend="up"
          icon={<FileText className="w-5 h-5" />}
        />
        <MetricCard
          title="Frota Disponível"
          value="8/14"
          changeLabel="veículos"
          trend="neutral"
          icon={<Truck className="w-5 h-5" />}
        />
        <MetricCard
          title="Receita (MTD)"
          value="R$ 84.200"
          change={12}
          changeLabel="vs. mês anterior"
          trend="up"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          title="Operações Abertas"
          value="6"
          change={-2}
          changeLabel="vs. ontem"
          trend="up"
          icon={<Zap className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartContainer title="Atividade Recente" description="Hoje, 22 de junho de 2026">
          <ActivityTimeline items={TIMELINE} />
        </ChartContainer>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-900 font-display">
              Próximos Eventos
            </h3>
          </div>
          <div className="divide-y divide-slate-50 p-4 space-y-3">
            {[
              { event: "Revisão veículo DEF-5678", date: "23/06/2026", type: "warning" },
              { event: "Renovação contrato CS-001", date: "25/06/2026", type: "info" },
              { event: "Fechamento financeiro junho", date: "30/06/2026", type: "info" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${item.type === "warning" ? "bg-amber-400" : "bg-shina-blue"}`}
                  />
                  <p className="text-sm text-slate-700">{item.event}</p>
                </div>
                <span className="text-xs text-slate-400">{item.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900 font-display">
            Operações Recentes
          </h3>
        </div>
        <DataTable columns={OP_COLUMNS} data={RECENT_OPS} />
      </div>
    </AppShell>
  );
}
