"use client";

// Criação de conta — autenticação via Google/Facebook (Supabase OAuth) +
// seleção de plano. A conta só é ativada após o checkout no Stripe (ver
// /api/checkout e /api/webhooks/stripe): sem conta grátis, cobrança
// imediata com reembolso garantido em até 14 dias em caso de cancelamento.
//
// Pré-requisitos para funcionar em produção (fora do escopo deste código):
// 1. Google e Facebook configurados como provedores OAuth no painel do
//    Supabase (Authentication → Providers) — client id/secret de cada um.
// 2. Produtos e preços criados no Stripe para Starter/Pro/Business, com os
//    price IDs em STRIPE_PRICE_STARTER / STRIPE_PRICE_PRO / STRIPE_PRICE_BUSINESS.
// 3. STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET configurados no ambiente.

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight } from "@shina/icons";

const PLANS = [
  { id: "starter", name: "Starter", price: "R$149/mês" },
  { id: "pro", name: "Pro", price: "R$399/mês" },
  { id: "business", name: "Business", price: "R$999/mês" },
] as const;

type PlanId = (typeof PLANS)[number]["id"];

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const searchParams = useSearchParams();
  const initialPlan = (searchParams.get("plan") as PlanId | null) ?? "starter";
  const [plan, setPlan] = useState<PlanId>(
    PLANS.some((p) => p.id === initialPlan) ? initialPlan : "starter",
  );
  const [loading, setLoading] = useState<"google" | "facebook" | "checkout" | null>(null);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "auth"
      ? "Não foi possível concluir o login. Tente novamente."
      : null,
  );

  async function handleOAuth(provider: "google" | "facebook") {
    setError(null);
    setLoading(provider);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/api/auth/callback?plan=${plan}` },
    });
    if (error) {
      setError(error.message);
      setLoading(null);
    }
    // No erro: o navegador é redirecionado pelo Supabase, o loading state
    // não precisa ser desfeito aqui.
  }

  async function handleCheckout() {
    setError(null);
    setLoading("checkout");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Não foi possível iniciar o checkout.");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setLoading(null);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-24">
      <div className="w-full max-w-md liquid-glass rounded-3xl p-8">
        <h1 className="font-heading italic text-3xl text-white text-center mb-2">Crie sua conta</h1>
        <p className="font-body text-sm text-white/70 text-center mb-8">
          14 dias de garantia — cancele nesse período e devolvemos 100% do valor pago.
        </p>

        <div className="grid grid-cols-3 gap-2 mb-6">
          {PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlan(p.id)}
              className={`rounded-xl px-2 py-3 text-center transition-colors ${
                plan === p.id ? "liquid-glass-strong" : "liquid-glass hover:bg-white/5"
              }`}
            >
              <p className="font-body text-sm font-semibold text-white">{p.name}</p>
              <p className="font-body text-xs text-white/60">{p.price}</p>
            </button>
          ))}
        </div>

        <div className="space-y-3 mb-6">
          <button
            type="button"
            onClick={() => void handleOAuth("google")}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 liquid-glass rounded-full text-white font-body font-semibold text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {loading === "google" ? "Conectando…" : "Continuar com Google"}
          </button>
          <button
            type="button"
            onClick={() => void handleOAuth("facebook")}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 liquid-glass rounded-full text-white font-body font-semibold text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {loading === "facebook" ? "Conectando…" : "Continuar com Facebook"}
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-px flex-1 bg-white/10" />
          <span className="font-body text-xs text-white/40">ou</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <button
          type="button"
          onClick={() => void handleCheckout()}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-black rounded-full font-body font-semibold text-sm hover:bg-white/90 transition-colors disabled:opacity-50"
        >
          {loading === "checkout" ? "Redirecionando…" : "Continuar para pagamento"}
          <ArrowRight size={16} />
        </button>

        {error && <p className="font-body text-sm text-red-400 text-center mt-4">{error}</p>}

        <p className="font-body text-xs text-white/50 text-center mt-6">
          Já tem uma conta?{" "}
          <Link href="/login" className="text-white/80 hover:text-white">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
