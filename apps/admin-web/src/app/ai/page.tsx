import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { BarChart2, MessageSquare, Calendar, TrendingUp, FileSearch, Cpu } from "lucide-react";

export const dynamic = "force-dynamic";

const AI_AGENTS = [
  {
    id: "analytics",
    icon: BarChart2,
    name: "Analytics AI",
    description: "Análise preditiva de dados operacionais, tendências e relatórios automáticos.",
    status: "active" as const,
    models: "GPT-4o",
    callsMonth: "12.400",
  },
  {
    id: "support",
    icon: MessageSquare,
    name: "Support AI",
    description: "Atendimento automatizado ao cliente via chat, e-mail e WhatsApp.",
    status: "active" as const,
    models: "Claude Sonnet",
    callsMonth: "34.800",
  },
  {
    id: "scheduling",
    icon: Calendar,
    name: "Scheduling AI",
    description: "Otimização de rotas e agendamento inteligente de operações.",
    status: "active" as const,
    models: "GPT-4o",
    callsMonth: "8.200",
  },
  {
    id: "commercial",
    icon: TrendingUp,
    name: "Commercial AI",
    description: "Análise de contratos, precificação automática e propostas comerciais.",
    status: "pending" as const,
    models: "Claude Opus",
    callsMonth: "—",
  },
  {
    id: "ocr",
    icon: FileSearch,
    name: "OCR & Docs AI",
    description: "Extração de dados de documentos fiscais, CTe, MDFe e notas fiscais.",
    status: "active" as const,
    models: "Gemini Vision",
    callsMonth: "5.600",
  },
  {
    id: "ops",
    icon: Cpu,
    name: "Operations AI",
    description: "Monitoramento de telemetria de veículos e alertas preditivos de manutenção.",
    status: "inactive" as const,
    models: "—",
    callsMonth: "—",
  },
];

export default function AiPage() {
  return (
    <AppShell title="AI Center">
      <SectionHeader
        title="AI Center"
        description="Configure e monitore agentes de IA na plataforma."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AI_AGENTS.map((agent) => {
          const Icon = agent.icon;
          return (
            <div
              key={agent.id}
              className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-shina-blue/10 flex items-center justify-center text-shina-blue">
                  <Icon className="w-5 h-5" />
                </div>
                <StatusBadge status={agent.status} />
              </div>
              <h3 className="text-base font-semibold text-slate-900 font-display mb-1">
                {agent.name}
              </h3>
              <p className="text-sm text-slate-500 mb-4 leading-relaxed">{agent.description}</p>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
                <span>
                  Modelo: <span className="text-slate-600 font-medium">{agent.models}</span>
                </span>
                <span>{agent.callsMonth} calls/mês</span>
              </div>
              <button className="w-full py-2 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer bg-transparent">
                Configurar
              </button>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
