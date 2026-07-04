import { AppShell } from "@/components/layout/app-shell";
import { Sparkles, ArrowUpRight, Puzzle } from "lucide-react";

const MKT_URL = process.env.NEXT_PUBLIC_MKT_URL ?? "https://mkt.shinaia.com.br";

const APPS = [
  {
    id: "marketing-ia",
    name: "Marketing IA",
    description:
      "Crie, clone e publique anúncios com IA. Ad Library de concorrentes, gerador de criativos, MCP Server e aprovação humana em cada etapa.",
    href: `${MKT_URL}/dashboard`,
    icon: Sparkles,
    gradient: "from-indigo-500 to-violet-500",
    badge: "Novo",
  },
];

export default function AppsPage() {
  return (
    <AppShell title="Apps">
      <div className="max-w-4xl">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Módulos do ecossistema Shinã. Sua conta e permissões (IAM) valem em todos os apps.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {APPS.map((app) => {
            const Icon = app.icon;
            return (
              <a
                key={app.id}
                href={app.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 no-underline hover:border-indigo-300 dark:hover:border-indigo-700 transition"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${app.gradient} flex items-center justify-center shrink-0`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {app.name}
                      </h2>
                      {app.badge && (
                        <span className="px-2 py-0.5 bg-indigo-500/15 text-indigo-500 text-[10px] font-bold rounded-full">
                          {app.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {app.description}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-500 mt-3 group-hover:gap-1.5 transition-all">
                      Abrir app <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </a>
            );
          })}

          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-5 flex flex-col items-center justify-center text-center">
            <Puzzle className="w-6 h-6 text-slate-400 mb-2" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Mais apps em breve no marketplace Shinã
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
