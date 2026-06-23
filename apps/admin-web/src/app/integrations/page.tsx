import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Puzzle, Link2, Webhook, Key } from "lucide-react";

export const dynamic = "force-dynamic";

const INTEGRATIONS = [
  {
    id: "int-1",
    name: "SEFAZ — Nota Fiscal Eletrônica",
    provider: "Receita Federal",
    icon: Link2,
    status: "active" as const,
    tenants: 5,
    lastSync: "há 2 min",
  },
  {
    id: "int-2",
    name: "Anatel — MDFe",
    provider: "Ministério Transportes",
    icon: Link2,
    status: "active" as const,
    tenants: 3,
    lastSync: "há 5 min",
  },
  {
    id: "int-3",
    name: "Google Maps API",
    provider: "Google",
    icon: Link2,
    status: "active" as const,
    tenants: 6,
    lastSync: "há 1 min",
  },
  {
    id: "int-4",
    name: "Asaas — Pagamentos",
    provider: "Asaas Fintech",
    icon: Key,
    status: "pending" as const,
    tenants: 2,
    lastSync: "—",
  },
  {
    id: "int-5",
    name: "WhatsApp Business API",
    provider: "Meta",
    icon: Webhook,
    status: "active" as const,
    tenants: 4,
    lastSync: "há 30s",
  },
];

export default function IntegrationsPage() {
  return (
    <AppShell title="Integrações">
      <SectionHeader
        title="Central de Integrações"
        description="Monitore e gerencie todas as integrações externas."
        action={
          <button className="flex items-center gap-2 px-4 py-2 bg-shina-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors cursor-pointer border-0">
            <Puzzle className="w-4 h-4" />
            Nova Integração
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-3">
        {INTEGRATIONS.map((integration) => {
          const Icon = integration.icon;
          return (
            <div
              key={integration.id}
              className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{integration.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{integration.provider}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <p className="text-xs text-slate-400">Tenants</p>
                    <p className="text-sm font-semibold text-slate-700">{integration.tenants}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Último sync</p>
                    <p className="text-sm font-semibold text-slate-700">{integration.lastSync}</p>
                  </div>
                  <StatusBadge status={integration.status} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
