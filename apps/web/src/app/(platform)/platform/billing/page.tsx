import { AppShell } from "@/components/layout/app-shell";

export default function BillingPage() {
  return (
    <AppShell title="Faturamento">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Faturamento e Assinaturas</h2>
        <p className="text-slate-500 text-sm">
          Acompanhamento financeiro de planos de clientes, faturas de cobrança e recebíveis.
        </p>
      </div>
    </AppShell>
  );
}
