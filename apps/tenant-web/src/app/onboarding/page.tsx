import type { Metadata } from "next";
import { OnboardingWizard } from "@/components/ui/onboarding-wizard";

export const metadata: Metadata = {
  title: "Configuração inicial | Shinã",
  description:
    "Configure sua conta Shinã em poucos passos e comece a gerenciar sua frota com inteligência.",
};

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-blue-950/20 dark:to-slate-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-400/10 dark:bg-blue-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-cyan-400/10 dark:bg-cyan-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-blue-900">
              <span className="text-white font-bold text-lg leading-none">S</span>
            </div>
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Shinã
            </span>
          </div>
          <h1 className="text-lg font-semibold text-slate-700 dark:text-slate-300">
            Bem-vindo à plataforma
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure sua conta em menos de 2 minutos
          </p>
        </div>

        {/* Wizard card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 p-8">
          <OnboardingWizard />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-6">
          Ao continuar, você concorda com os{" "}
          <a
            href="/termos"
            className="underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-400 transition"
          >
            Termos de Uso
          </a>{" "}
          e a{" "}
          <a
            href="/privacidade"
            className="underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-400 transition"
          >
            Política de Privacidade
          </a>
          .
        </p>
      </div>
    </div>
  );
}
