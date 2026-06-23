import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { Palette, Users, Plug, Bell } from "lucide-react";

export const dynamic = "force-dynamic";

const SETTINGS_SECTIONS = [
  {
    icon: Palette,
    title: "White Label",
    description:
      "Personalize logotipo, cores e domínio do portal conforme a identidade da sua empresa.",
    action: "Configurar",
  },
  {
    icon: Users,
    title: "Usuários & Permissões",
    description: "Gerencie usuários, perfis de acesso e níveis de permissão no sistema.",
    action: "Gerenciar",
  },
  {
    icon: Plug,
    title: "Integrações",
    description: "Conecte sistemas externos como ERP, financeiro, SEFAZ e parceiros logísticos.",
    action: "Ver integrações",
  },
  {
    icon: Bell,
    title: "Notificações",
    description: "Configure alertas por e-mail, WhatsApp e push para eventos críticos da operação.",
    action: "Configurar",
  },
];

export default function SettingsPage() {
  return (
    <AppShell title="Configurações">
      <SectionHeader
        title="Configurações"
        description="Configure o portal, usuários e integrações da sua empresa."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.title}
              className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-shina-blue/10 flex items-center justify-center text-shina-blue flex-shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-900 font-display mb-1">
                    {section.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-4">
                    {section.description}
                  </p>
                  <button className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer bg-transparent">
                    {section.action} →
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
