import { AppShell } from "@/components/layout/app-shell";

export default function TenantResourcesPage() {
  return (
    <AppShell title="Recursos">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Recursos da Frota</h2>
        <p className="text-slate-500">
          Tela de Gerenciamento de Recursos (Motoristas, Equipamentos, etc.).
        </p>
      </div>
    </AppShell>
  );
}
