"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import {
  Palette,
  Bell,
  Award,
  Lock,
  LayoutGrid,
  FileText,
  Plug,
  ListTree,
  Workflow,
  Box,
  PackagePlus,
} from "lucide-react";

// Not to be confused with tenant/studio (tenant IAM/roles) — this is
// @shina/studio, a completely different, unrelated package (see CLAUDE.md's
// packages/ audit for the naming collision history).
const AREAS = [
  {
    type: "branding",
    label: "Marca",
    description: "Cores, logo, tipografia, domínio.",
    icon: Palette,
  },
  {
    type: "notification",
    label: "Notificações",
    description: "Canais, horário de silêncio, remetente.",
    icon: Bell,
  },
  {
    type: "commercial",
    label: "Comercial",
    description: "Regras de comissão, período de settlement.",
    icon: Award,
  },
  {
    type: "access_control",
    label: "Controle de Acesso",
    description: "Políticas e overrides por papel.",
    icon: Lock,
  },
  { type: "dashboard", label: "Dashboard", description: "Widgets e layout.", icon: LayoutGrid },
  {
    type: "forms",
    label: "Formulários",
    description: "Campos customizados por entidade.",
    icon: FileText,
  },
  {
    type: "integration",
    label: "Integrações",
    description: "Providers, webhooks, retries.",
    icon: Plug,
  },
  { type: "rule", label: "Regras", description: "Condições e ações por entidade.", icon: ListTree },
  { type: "workflow", label: "Workflow", description: "Estados e transições.", icon: Workflow },
  {
    type: "blueprint",
    label: "Blueprint",
    description: "Ajustes do template instalado.",
    icon: Box,
  },
];

export default function TenantCustomizationPage() {
  return (
    <AppShell title="Customização">
      <SectionHeader
        title="Customização"
        description="Configure marca, regras, formulários e mais — cada área tem rascunho e versionamento próprios."
      />

      <Link
        href="/tenant/customization/blueprints"
        className="flex items-start gap-3 p-4 mb-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-shina-blue/40 hover:border-shina-blue dark:hover:border-shina-blue transition-colors"
      >
        <div className="w-9 h-9 rounded-lg bg-shina-blue/10 flex items-center justify-center shrink-0">
          <PackagePlus className="w-4 h-4 text-shina-blue" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Blueprints</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Instale templates prontos de tipo de ativo (frota, agrícola, construção...) em vez de
            cadastrar campo por campo.
          </p>
        </div>
      </Link>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {AREAS.map((area) => {
          const Icon = area.icon;
          return (
            <Link
              key={area.type}
              href={`/tenant/customization/${area.type}`}
              className="flex items-start gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-shina-blue dark:hover:border-shina-blue transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-shina-blue/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-shina-blue" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {area.label}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {area.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
