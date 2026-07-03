import { MktShell } from "@/components/layout/mkt-shell";
import { Megaphone, Wand2, ShieldCheck, Coins, Library, Copy } from "lucide-react";

const KPIS = [
  { label: "Campanhas ativas", value: "0", icon: Megaphone },
  { label: "Anúncios gerados", value: "0", icon: Wand2 },
  { label: "Clonagens", value: "0", icon: Copy },
  { label: "Drafts pendentes", value: "0", icon: ShieldCheck },
  { label: "Concorrentes monitorados", value: "0", icon: Library },
  { label: "Créditos IA usados", value: "0 / 500", icon: Coins },
];

export default function DashboardPage() {
  return (
    <MktShell title="Dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {KPIS.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="card-glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-400">{kpi.label}</span>
                <Icon className="w-4 h-4 text-mkt-glow" />
              </div>
              <p className="text-2xl font-black text-white">{kpi.value}</p>
            </div>
          );
        })}
      </div>

      <div className="card-glass rounded-2xl p-8 text-center">
        <h2 className="text-lg font-bold text-white mb-2">Comece pelo seu Brand Kit</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto mb-5">
          Cadastre logo, cores, tipografia e tom de voz da sua marca. A IA usará esses dados em
          todas as gerações de anúncios.
        </p>
        <a
          href="/brand-kit"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-mkt-primary hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors no-underline"
        >
          Configurar Brand Kit
        </a>
      </div>
    </MktShell>
  );
}
