"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { FileText, Download } from "lucide-react";

interface Acceptance {
  id: string;
  product: "platform" | "mkt";
  accepted_at: string;
  representative_name: string;
  representative_role: string;
  document_hash: string;
  contract_versions: {
    id: string;
    title: string;
    version: number;
    material_change: boolean;
  } | null;
  plan_versions: { id: string; name: string; price_cents: number; currency: string } | null;
}

interface PlanChange {
  id: string;
  product: string;
  accepted_at: string;
  from_plan_version_id: string | null;
  to_plan_version_id: string;
}

const PRODUCT_LABEL: Record<string, string> = { platform: "Shinã Platform", mkt: "Shinã MKT" };

function formatDateTime(dt: string) {
  return new Date(dt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TenantLegalPage() {
  const [acceptances, setAcceptances] = useState<Acceptance[]>([]);
  const [planChanges, setPlanChanges] = useState<PlanChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/commercial/acceptances")
      .then(
        (res) =>
          res.json() as Promise<{
            data?: { acceptances: Acceptance[]; planChanges: PlanChange[] };
          }>,
      )
      .then((json) => {
        setAcceptances(json.data?.acceptances ?? []);
        setPlanChanges(json.data?.planChanges ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="Jurídico">
      <SectionHeader
        title="Contratos e Termos"
        description="Contratos aceitos, versões, representante e histórico de mudanças de plano."
      />

      {loading ? (
        <div className="h-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse" />
      ) : (
        <div className="space-y-6 max-w-3xl">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {acceptances.length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
                Nenhum contrato aceito ainda.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3 text-left font-medium">Produto</th>
                      <th className="px-6 py-3 text-left font-medium">Contrato</th>
                      <th className="px-6 py-3 text-left font-medium">Plano</th>
                      <th className="px-6 py-3 text-left font-medium">Representante</th>
                      <th className="px-6 py-3 text-left font-medium">Aceito em</th>
                      <th className="px-6 py-3 text-left font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {acceptances.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-6 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {PRODUCT_LABEL[a.product] ?? a.product}
                        </td>
                        <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {a.contract_versions?.title ?? "—"}
                          {a.contract_versions && ` v${a.contract_versions.version}`}
                        </td>
                        <td className="px-6 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {a.plan_versions?.name ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {a.representative_name} ({a.representative_role})
                        </td>
                        <td className="px-6 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatDateTime(a.accepted_at)}
                        </td>
                        <td className="px-6 py-3">
                          <Link
                            href={`/tenant/settings/legal/${a.id}/print`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-shina-blue hover:text-blue-700 no-underline"
                          >
                            <Download className="w-3.5 h-3.5" /> Baixar
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {planChanges.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                Histórico de mudanças de plano
              </p>
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/50">
                {planChanges.map((pc) => (
                  <div key={pc.id} className="flex items-center gap-3 px-4 py-3">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Plano alterado em {formatDateTime(pc.accepted_at)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
