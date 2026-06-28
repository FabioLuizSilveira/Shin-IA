import { AppShell } from "@/components/layout/app-shell";

export default function TenantCrmPage() {
  return (
    <AppShell title="Clientes & Parceiros">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Clientes & Parceiros</h2>
        <p className="text-slate-500">Tela de CRM do inquilino.</p>
      </div>
    </AppShell>
  );
}
