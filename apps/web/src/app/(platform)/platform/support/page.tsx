import { AppShell } from "@/components/layout/app-shell";

export default function SupportPage() {
  return (
    <AppShell title="Suporte">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Central de Suporte</h2>
        <p className="text-slate-500 text-sm">
          Gerenciamento de chamados e suporte operacional para a plataforma Shinã.
        </p>
      </div>
    </AppShell>
  );
}
