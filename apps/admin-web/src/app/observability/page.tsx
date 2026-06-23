import { AppShell } from "@/components/layout/app-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionHeader } from "@/components/ui/section-header";
import { ActivityTimeline } from "@/components/ui/activity-timeline";
import { ChartContainer } from "@/components/ui/chart-container";
import { Activity, Clock, AlertTriangle, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

const EVENTS = [
  {
    time: "há 2 min",
    title: "Deploy concluído",
    description: "API Gateway v2.4.1 deployado com sucesso",
    type: "success" as const,
  },
  {
    time: "há 15 min",
    title: "Pico de latência detectado",
    description: "P99 atingiu 245ms no endpoint /api/tenants",
    type: "warning" as const,
  },
  {
    time: "há 1h",
    title: "Novo tenant ativado",
    description: "Frota Express ME iniciou trial de 14 dias",
    type: "info" as const,
  },
  {
    time: "há 2h",
    title: "Erro de autenticação",
    description: "3 tentativas falhadas para tenant ID abc123",
    type: "error" as const,
  },
  {
    time: "há 4h",
    title: "Backup concluído",
    description: "Snapshot do banco de dados salvo com sucesso",
    type: "success" as const,
  },
  {
    time: "há 6h",
    title: "Scale-up automático",
    description: "Instância adicional criada por demanda elevada",
    type: "info" as const,
  },
];

const SERVICES = [
  { name: "API Gateway", uptime: "99.98%", latency: "12ms", status: "Operacional" },
  { name: "Database (Primary)", uptime: "99.99%", latency: "2ms", status: "Operacional" },
  { name: "Cache (Redis)", uptime: "100%", latency: "0.4ms", status: "Operacional" },
  { name: "Message Queue", uptime: "99.95%", latency: "8ms", status: "Operacional" },
  { name: "Object Storage", uptime: "99.97%", latency: "45ms", status: "Operacional" },
];

export default function ObservabilityPage() {
  return (
    <AppShell title="Observabilidade">
      <SectionHeader
        title="Observabilidade"
        description="Saúde da plataforma, métricas e rastreamento distribuído em tempo real."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Uptime"
          value="99.97%"
          change={0.02}
          trend="up"
          icon={<Activity className="w-5 h-5" />}
        />
        <MetricCard
          title="P99 Latência"
          value="87ms"
          change={-12}
          changeLabel="vs. ontem"
          trend="up"
          icon={<Clock className="w-5 h-5" />}
        />
        <MetricCard
          title="Taxa de Erro"
          value="0.03%"
          change={-0.01}
          changeLabel="vs. ontem"
          trend="up"
          icon={<AlertTriangle className="w-5 h-5" />}
        />
        <MetricCard
          title="Req/min"
          value="2.840"
          change={18}
          changeLabel="vs. hora anterior"
          trend="up"
          icon={<Zap className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartContainer title="Eventos Recentes" description="Últimas 6 horas de atividade">
          <ActivityTimeline items={EVENTS} />
        </ChartContainer>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-900 font-display">
              Saúde dos Serviços
            </h3>
          </div>
          <div className="divide-y divide-slate-50">
            {SERVICES.map((svc) => (
              <div key={svc.name} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">{svc.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Latência: {svc.latency}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-medium text-emerald-600">{svc.status}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{svc.uptime} uptime</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
