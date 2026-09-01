"use client";

// Criação de conta — autenticação via Google/Facebook (Supabase OAuth) +
// seleção de plano. A conta só é ativada após o checkout no Stripe (ver
// /api/checkout e /api/webhooks/stripe): sem conta grátis, cobrança
// imediata com reembolso garantido em até 14 dias em caso de cancelamento.
//
// Fase C (Unified Commercial Flow): planos vêm de /api/commercial/plans
// (plan_versions, produto "mkt") em vez do array PLANS hardcoded de antes,
// e o checkout exige aceite do contrato MKT antes de prosseguir — ver
// ContractAcceptModal abaixo, mesmo padrão de campos do onboarding da
// Platform (apps/web/src/components/ui/onboarding-wizard.tsx Step 5).
//
// Pré-requisitos para funcionar em produção (fora do escopo deste código):
// 1. Google e Facebook configurados como provedores OAuth no painel do
//    Supabase (Authentication → Providers) — client id/secret de cada um.
// 2. STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET configurados no ambiente.

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight } from "@shina/icons";

interface PlanOption {
  id: string;
  key: string;
  name: string;
  price_cents: number;
  currency: string;
  billing_cycle: string;
}

interface ContractInfo {
  id: string;
  title: string;
  content: string;
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

export interface BillingAddress {
  phone: string;
  address: string;
  addressNumber: string;
  postalCode: string;
  province: string;
}

function ContractAcceptModal({
  planVersionId,
  onAccepted,
  onClose,
}: {
  planVersionId: string;
  onAccepted: (customerName: string, document: string, billing: BillingAddress) => void;
  onClose: () => void;
}) {
  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [province, setProvince] = useState("");
  const [declaredAuthority, setDeclaredAuthority] = useState(false);
  const [contractAccepted, setContractAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/commercial/contract")
      .then((res) => res.json() as Promise<{ data?: ContractInfo; error?: string }>)
      .then((json) => {
        if (json.data) setContract(json.data);
      })
      .catch(() => setError("Não foi possível carregar o contrato."));
  }, []);

  async function handleAccept() {
    if (
      !name.trim() ||
      !role.trim() ||
      !document.trim() ||
      !phone.trim() ||
      !address.trim() ||
      !addressNumber.trim() ||
      !postalCode.trim() ||
      !province.trim() ||
      !declaredAuthority ||
      !contractAccepted
    ) {
      // document went from optional to required here — the payment
      // gateway (Asaas) rejects a checkout without a real CPF/CNPJ, live-
      // verified during the Stripe -> Asaas migration's Fase A.
      setError("Preencha todos os campos (incluindo CPF e endereço) e marque os dois checkboxes.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/commercial/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planVersionId,
          representativeName: name,
          representativeRole: role,
          representativeDocument: document,
          declaredAuthority,
        }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Erro ao aceitar o contrato.");
      }
      onAccepted(name, document, { phone, address, addressNumber, postalCode, province });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md liquid-glass-strong rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="font-heading italic text-2xl text-white mb-4">Contrato de Serviço</h2>

        <div className="h-32 overflow-y-auto px-3 py-2.5 rounded-xl bg-white/5 text-xs text-white/70 leading-relaxed mb-4">
          {contract ? (
            <>
              <p className="font-semibold text-white/90 mb-1">{contract.title}</p>
              {contract.content}
            </>
          ) : (
            "Carregando..."
          )}
        </div>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Seu nome completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/40"
          />
          <input
            type="text"
            placeholder="Cargo (ex: Sócio-diretor)"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/40"
          />
          <input
            type="text"
            placeholder="CPF"
            value={document}
            onChange={(e) => setDocument(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/40"
          />
          <input
            type="text"
            placeholder="Telefone (ex: 11999999999)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/40"
          />
          <input
            type="text"
            placeholder="Endereço (rua/avenida)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/40"
          />
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Número"
              value={addressNumber}
              onChange={(e) => setAddressNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/40"
            />
            <input
              type="text"
              placeholder="CEP"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/40"
            />
          </div>
          <input
            type="text"
            placeholder="Bairro"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/40"
          />

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={declaredAuthority}
              onChange={(e) => setDeclaredAuthority(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-xs text-white/70">
              Declaro possuir poderes suficientes para aceitar este instrumento em nome da
              organização.
            </span>
          </label>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={contractAccepted}
              onChange={(e) => setContractAccepted(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-xs text-white/70">
              Li e aceito o Contrato de Serviço e as condições do plano selecionado.
            </span>
          </label>
        </div>

        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-full text-sm font-semibold text-white/70 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleAccept()}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-white text-black rounded-full font-semibold text-sm hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {submitting ? "Enviando..." : "Aceitar e continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SignupForm() {
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<PlanOption[] | null>(null);
  const [plan, setPlan] = useState<string>(searchParams.get("plan") ?? "");
  const [loading, setLoading] = useState<"google" | "facebook" | "checkout" | null>(null);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "auth"
      ? "Não foi possível concluir o login. Tente novamente."
      : null,
  );
  const [pendingAcceptance, setPendingAcceptance] = useState<string | null>(null);
  const [billingInfo, setBillingInfo] = useState<{
    customerName: string;
    document: string;
    billing: BillingAddress;
  } | null>(null);

  useEffect(() => {
    fetch("/api/commercial/plans")
      .then((res) => res.json() as Promise<{ data?: PlanOption[] }>)
      .then((json) => {
        const list = json.data ?? [];
        setPlans(list);
        if (!plan && list.length > 0) setPlan(list[0].key);
      })
      .catch(() => setError("Não foi possível carregar os planos."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function handleCheckout(billing?: typeof billingInfo) {
    setError(null);
    setLoading("checkout");
    try {
      const info = billing ?? billingInfo;
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          ...(info
            ? {
                customerName: info.customerName,
                document: info.document,
                phone: info.billing.phone,
                address: info.billing.address,
                addressNumber: info.billing.addressNumber,
                postalCode: info.billing.postalCode,
                province: info.billing.province,
              }
            : {}),
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string; planVersionId?: string };
      if (res.status === 403 && data.error === "acceptance_required" && data.planVersionId) {
        setPendingAcceptance(data.planVersionId);
        setLoading(null);
        return;
      }
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
          {(plans ?? []).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlan(p.key)}
              className={`rounded-xl px-2 py-3 text-center transition-colors ${
                plan === p.key ? "liquid-glass-strong" : "liquid-glass hover:bg-white/5"
              }`}
            >
              <p className="font-body text-sm font-semibold text-white">{p.name}</p>
              <p className="font-body text-xs text-white/60">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: p.currency }).format(
                  p.price_cents / 100,
                )}
                /mês
              </p>
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
          disabled={loading !== null || !plan}
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

      {pendingAcceptance && (
        <ContractAcceptModal
          planVersionId={pendingAcceptance}
          onClose={() => setPendingAcceptance(null)}
          onAccepted={(customerName, document, billing) => {
            const info = { customerName, document, billing };
            setBillingInfo(info);
            setPendingAcceptance(null);
            void handleCheckout(info);
          }}
        />
      )}
    </div>
  );
}
