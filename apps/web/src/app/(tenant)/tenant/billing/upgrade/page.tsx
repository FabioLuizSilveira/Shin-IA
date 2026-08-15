"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { CheckCircle2, Loader2, ArrowUp, ArrowDown } from "lucide-react";

interface PlanOption {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  billing_cycle: string;
  included_features: string[];
}

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

export default function TenantBillingUpgradePage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [currentPlanVersionId, setCurrentPlanVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/commercial/plan-change");
    const json = (await res.json()) as {
      data?: { currentPlanVersionId: string | null; plans: PlanOption[] };
    };
    setPlans(json.data?.plans ?? []);
    setCurrentPlanVersionId(json.data?.currentPlanVersionId ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currentPlan = plans.find((p) => p.id === currentPlanVersionId);

  async function handleChange() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/commercial/plan-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toPlanVersionId: selected }),
      });
      const json = (await res.json()) as { data?: { direction: string }; error?: string };
      if (!res.ok) {
        if (json.error === "contract_reacceptance_required") {
          router.push("/tenant/legal/reaccept");
          return;
        }
        throw new Error(json.error ?? "Não foi possível alterar o plano.");
      }
      setSuccess(
        json.data?.direction === "up"
          ? "Plano atualizado! A cobrança proporcional será aplicada na próxima fatura."
          : "Plano alterado com sucesso.",
      );
      await load();
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Mudar de plano">
      <SectionHeader
        title="Mudar de plano"
        description="Compare os planos disponíveis e confirme a troca — a mudança comercial não exige novo aceite do contrato, salvo alteração material."
      />

      {loading ? (
        <div className="h-64 animate-pulse bg-slate-50 dark:bg-slate-800 rounded-xl" />
      ) : (
        <div className="max-w-2xl space-y-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanVersionId;
            const isUp = currentPlan && plan.price_cents > currentPlan.price_cents;
            const isDown = currentPlan && plan.price_cents < currentPlan.price_cents;
            return (
              <button
                key={plan.id}
                type="button"
                disabled={isCurrent}
                onClick={() => setSelected(plan.id)}
                className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 opacity-70 cursor-default"
                    : selected === plan.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/60 shadow-sm cursor-pointer"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {plan.name}
                    </p>
                    {isCurrent && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 rounded">
                        Atual
                      </span>
                    )}
                    {!isCurrent && isUp && <ArrowUp className="w-3.5 h-3.5 text-green-600" />}
                    {!isCurrent && isDown && <ArrowDown className="w-3.5 h-3.5 text-amber-600" />}
                  </div>
                  {selected === plan.id && (
                    <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {formatPrice(plan.price_cents, plan.currency)}
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                    {" "}
                    /{plan.billing_cycle === "yearly" ? "ano" : "mês"}
                  </span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                  {plan.included_features.join(" · ")}
                </p>
              </button>
            );
          })}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {success && <p className="text-sm text-green-600 dark:text-green-400">{success}</p>}

          <button
            type="button"
            onClick={() => void handleChange()}
            disabled={!selected || submitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmar mudança de plano
          </button>
        </div>
      )}
    </AppShell>
  );
}
