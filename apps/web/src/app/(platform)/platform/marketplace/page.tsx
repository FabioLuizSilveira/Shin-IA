import { AppShell } from "@/components/layout/app-shell";

export default function MarketplacePage() {
  return (
    <AppShell title="Marketplace">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Marketplace & Integrações</h2>
        <p className="text-slate-500 text-sm">
          Gerencie integrações externas, APIs e extensões de sistema.
        </p>
      </div>
    </AppShell>
  );
}
