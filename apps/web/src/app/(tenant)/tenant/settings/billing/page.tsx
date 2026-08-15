"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { CreditCard, Loader2, ExternalLink } from "lucide-react";

interface Subscription {
  id: string;
  status: string;
  plan_key: string;
  billing_mode: string;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  plan_versions: {
    name: string;
    price_cents: number;
    currency: string;
    billing_cycle: string;
  } | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  pending_payment: "Aguardando pagamento",
  trialing: "Em teste grátis",
  active: "Ativa",
  past_due: "Pagamento atrasado",
  suspended: "Suspensa",
  cancelled: "Cancelada",
};

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function TenantBillingCenterPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/commercial/subscription")
      .then((res) => res.json() as Promise<{ data?: Subscription }>)
      .then((json) => setSubscription(json.data ?? null))
      .finally(() => setLoading(false));
  }, []);

  async function handlePortal() {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/commercial/portal", { method: "POST" });
      const json = (await res.json()) as { data?: { url: string }; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error ?? "Não foi possível abrir o portal.");
      window.location.href = json.data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setPortalLoading(false);
    }
  }

  return (
    <AppShell title="Assinatura">
      <SectionHeader
        title="Assinatura Shinã Platform"
        description="Plano, cobrança e método de pagamento da sua assinatura com a Shinã."
      />

      {loading ? (
        <div className="h-48 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse" />
      ) : !subscription ? (
        <div className="max-w-xl bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 text-center text-sm text-slate-400">
          Nenhuma assinatura ativa encontrada.
        </div>
      ) : (
        <div className="max-w-xl bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {subscription.plan_versions?.name ?? subscription.plan_key}
              </p>
              {subscription.plan_versions && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {formatPrice(
                    subscription.plan_versions.price_cents,
                    subscription.plan_versions.currency,
                  )}
                  /{subscription.plan_versions.billing_cycle === "yearly" ? "ano" : "mês"}
                </p>
              )}
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              {STATUS_LABEL[subscription.status] ?? subscription.status}
            </span>
          </div>

          {subscription.trial_ends_at && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Teste grátis até {formatDate(subscription.trial_ends_at)}
            </p>
          )}
          {subscription.current_period_end && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Próxima cobrança em {formatDate(subscription.current_period_end)}
              {subscription.cancel_at_period_end && " (cancelamento agendado)"}
            </p>
          )}
          <p className="text-xs text-slate-400">
            Forma de cobrança:{" "}
            {subscription.billing_mode === "card" ? "Cartão (Stripe)" : subscription.billing_mode}
          </p>

          <div className="flex items-center gap-2 pt-2">
            {subscription.billing_mode === "card" && (
              <button
                type="button"
                onClick={() => void handlePortal()}
                disabled={portalLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-60 transition"
              >
                {portalLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
                Gerenciar pagamento e faturas
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
            <Link
              href="/tenant/billing/upgrade"
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-shina-blue text-white hover:bg-blue-600 transition no-underline"
            >
              Mudar de plano
            </Link>
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </AppShell>
  );
}
