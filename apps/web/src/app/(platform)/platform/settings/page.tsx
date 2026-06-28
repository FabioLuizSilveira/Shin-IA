import { AppShell } from "@/components/layout/app-shell";

export default function SettingsPage() {
  return (
    <AppShell title="Configurações">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Configurações Globais</h2>
        <p className="text-slate-500 text-sm">
          Ajustes de segurança, políticas de acesso e configurações da plataforma.
        </p>
      </div>
    </AppShell>
  );
}
