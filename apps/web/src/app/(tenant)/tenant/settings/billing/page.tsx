"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { CreditCard, Loader2, XCircle } from "lucide-react";

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

const emptyCardForm = {
  holderName: "",
  number: "",
  expiryMonth: "",
  expiryYear: "",
  ccv: "",
  holderCpfCnpj: "",
  postalCode: "",
  addressNumber: "",
  phone: "",
};

export default function TenantBillingCenterPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [cardForm, setCardForm] = useState(emptyCardForm);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function loadSubscription() {
    setLoading(true);
    fetch("/api/commercial/subscription")
      .then((res) => res.json() as Promise<{ data?: Subscription }>)
      .then((json) => setSubscription(json.data ?? null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadSubscription();
  }, []);

  async function handleCancel() {
    if (
      !window.confirm(
        "Cancelar a assinatura da Shinã Platform? Isso não pode ser desfeito por aqui.",
      )
    ) {
      return;
    }
    setCancelLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/commercial/cancel", { method: "POST" });
      const json = (await res.json()) as { data?: { cancelling: boolean }; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error ?? "Não foi possível cancelar.");
      setNotice(
        "Cancelamento solicitado — a assinatura fica ativa até a confirmação da Asaas, que pode levar alguns minutos.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleUpdateCard(e: React.FormEvent) {
    e.preventDefault();
    setCardLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/commercial/update-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cardForm),
      });
      const json = (await res.json()) as { data?: { updated: boolean }; error?: string };
      if (!res.ok || !json.data)
        throw new Error(json.error ?? "Não foi possível atualizar o cartão.");
      setNotice("Cartão atualizado com sucesso.");
      setCardForm(emptyCardForm);
      setCardFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setCardLoading(false);
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
            {subscription.billing_mode === "card" ? "Cartão" : subscription.billing_mode}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            {subscription.billing_mode === "card" && !subscription.cancel_at_period_end && (
              <>
                <button
                  type="button"
                  onClick={() => setCardFormOpen((v) => !v)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  <CreditCard className="w-4 h-4" />
                  Atualizar cartão
                </button>
                <button
                  type="button"
                  onClick={() => void handleCancel()}
                  disabled={cancelLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60 disabled:opacity-60 transition"
                >
                  {cancelLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  Cancelar assinatura
                </button>
              </>
            )}
            <Link
              href="/tenant/billing/upgrade"
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-shina-blue text-white hover:bg-blue-600 transition no-underline"
            >
              Mudar de plano
            </Link>
          </div>

          {cardFormOpen && (
            <form
              onSubmit={(e) => void handleUpdateCard(e)}
              className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800"
            >
              <input
                required
                placeholder="Nome impresso no cartão"
                value={cardForm.holderName}
                onChange={(e) => setCardForm({ ...cardForm, holderName: e.target.value })}
                className="col-span-2 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
              <input
                required
                placeholder="Número do cartão"
                inputMode="numeric"
                value={cardForm.number}
                onChange={(e) => setCardForm({ ...cardForm, number: e.target.value })}
                className="col-span-2 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
              <input
                required
                placeholder="Mês (MM)"
                inputMode="numeric"
                value={cardForm.expiryMonth}
                onChange={(e) => setCardForm({ ...cardForm, expiryMonth: e.target.value })}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
              <input
                required
                placeholder="Ano (AAAA)"
                inputMode="numeric"
                value={cardForm.expiryYear}
                onChange={(e) => setCardForm({ ...cardForm, expiryYear: e.target.value })}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
              <input
                required
                placeholder="CVV"
                inputMode="numeric"
                value={cardForm.ccv}
                onChange={(e) => setCardForm({ ...cardForm, ccv: e.target.value })}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
              <input
                required
                placeholder="CPF/CNPJ do titular"
                value={cardForm.holderCpfCnpj}
                onChange={(e) => setCardForm({ ...cardForm, holderCpfCnpj: e.target.value })}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
              <input
                required
                placeholder="CEP"
                value={cardForm.postalCode}
                onChange={(e) => setCardForm({ ...cardForm, postalCode: e.target.value })}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
              <input
                required
                placeholder="Número do endereço"
                value={cardForm.addressNumber}
                onChange={(e) => setCardForm({ ...cardForm, addressNumber: e.target.value })}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
              <input
                required
                placeholder="Telefone"
                value={cardForm.phone}
                onChange={(e) => setCardForm({ ...cardForm, phone: e.target.value })}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
              <button
                type="submit"
                disabled={cardLoading}
                className="col-span-2 px-4 py-2 text-sm font-semibold rounded-lg bg-shina-blue text-white hover:bg-blue-600 disabled:opacity-60 transition"
              >
                {cardLoading ? "Salvando..." : "Salvar novo cartão"}
              </button>
            </form>
          )}

          {notice && <p className="text-xs text-emerald-600 dark:text-emerald-400">{notice}</p>}
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </AppShell>
  );
}
