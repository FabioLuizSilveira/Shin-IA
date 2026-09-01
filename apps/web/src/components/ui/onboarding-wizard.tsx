"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Building2,
  MapPin,
  UserPlus,
  Layers,
  CreditCard,
  FileText,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Mail,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  OnboardingState,
  OnboardingStep1,
  OnboardingStep2,
  OnboardingStep3,
  OnboardingStep4,
  OnboardingStep5,
  BlueprintId,
  TenantSegment,
} from "@/types/onboarding";
import { SEGMENT_LABELS, BLUEPRINT_OPTIONS } from "@/types/onboarding";

const STEPS = [
  { number: 1, label: "Empresa", icon: Building2 },
  { number: 2, label: "Sede", icon: MapPin },
  { number: 3, label: "Blueprint", icon: Layers },
  { number: 4, label: "Plano", icon: CreditCard },
  { number: 5, label: "Contrato", icon: FileText },
];

const BRAZIL_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

function formatCNPJ(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

// ─── Step 0: Authentication (login-first — Unified Commercial Flow) ────────
// No company/contract data is collected before the person is a real,
// identified auth.users row — this is what makes contract_acceptances.user_id
// always non-null downstream (no more anonymous-onboarding exception).

function AuthGate({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<"google" | "magic" | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setLoading("google");
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar login.");
      setLoading(null);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading("magic");
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
      });
      if (error) throw error;
      setMagicSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar o link.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Crie sua conta</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Antes de configurar sua empresa, identifique-se — é você quem vai assinar o contrato em
          nome da organização.
        </p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => void handleGoogle()}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-900 text-sm font-semibold rounded-xl border border-slate-200 cursor-pointer transition disabled:opacity-60"
        >
          {loading === "google" && <Loader2 className="w-4 h-4 animate-spin" />}
          Continuar com Google
        </button>

        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          <span className="text-xs text-slate-400">ou</span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        </div>

        {magicSent ? (
          <div className="px-4 py-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-xl text-sm text-green-700 dark:text-green-300 text-center">
            Link enviado! Verifique seu e-mail para continuar.
          </div>
        ) : (
          <form onSubmit={(e) => void handleMagicLink(e)} className="space-y-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com.br"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            <button
              type="submit"
              disabled={loading !== null}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer transition disabled:opacity-60"
            >
              {loading === "magic" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              Continuar com e-mail
            </button>
          </form>
        )}

        {error && (
          <div className="px-4 py-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  );

  // onAuthenticated is invoked by the parent's onAuthStateChange listener,
  // not from here — keeping this component pure UI/trigger only.
  void onAuthenticated;
}

// ─── Step 1: Company Data ───────────────────────────────────────────────────

function Step1({
  data,
  onChange,
}: {
  data: Partial<OnboardingStep1>;
  onChange: (d: Partial<OnboardingStep1>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Nome da empresa <span className="text-red-500">*</span>
        </label>
        <input
          id="ob-company-name"
          type="text"
          placeholder="Ex: Transportadora Alfa Ltda."
          value={data.companyName ?? ""}
          onChange={(e) => onChange({ ...data, companyName: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          CNPJ <span className="text-red-500">*</span>
        </label>
        <input
          id="ob-cnpj"
          type="text"
          placeholder="00.000.000/0000-00"
          value={data.cnpj ?? ""}
          onChange={(e) => onChange({ ...data, cnpj: formatCNPJ(e.target.value) })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Segmento <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(SEGMENT_LABELS) as TenantSegment[]).map((seg) => (
            <button
              key={seg}
              id={`ob-segment-${seg}`}
              type="button"
              onClick={() => onChange({ ...data, segment: seg })}
              className={`px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-all ${
                data.segment === seg
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              {SEGMENT_LABELS[seg]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Website <span className="text-slate-400 text-xs">(opcional)</span>
        </label>
        <input
          id="ob-website"
          type="url"
          placeholder="https://suaempresa.com.br"
          value={data.website ?? ""}
          onChange={(e) => onChange({ ...data, website: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>
    </div>
  );
}

function validateStep1(d: Partial<OnboardingStep1>): string | null {
  if (!d.companyName?.trim()) return "Nome da empresa é obrigatório.";
  if (!d.cnpj || d.cnpj.replace(/\D/g, "").length < 14) return "CNPJ inválido.";
  if (!d.segment) return "Selecione o segmento da empresa.";
  return null;
}

// ─── Step 2: Main Branch ────────────────────────────────────────────────────

function Step2({
  data,
  onChange,
}: {
  data: Partial<OnboardingStep2>;
  onChange: (d: Partial<OnboardingStep2>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Nome da sede <span className="text-red-500">*</span>
        </label>
        <input
          id="ob-branch-name"
          type="text"
          placeholder="Ex: Matriz São Paulo"
          value={data.branchName ?? ""}
          onChange={(e) => onChange({ ...data, branchName: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Código da filial <span className="text-red-500">*</span>
        </label>
        <input
          id="ob-branch-code"
          type="text"
          placeholder="Ex: MATRIZ-SP"
          value={data.branchCode ?? ""}
          onChange={(e) =>
            onChange({ ...data, branchCode: e.target.value.toUpperCase().replace(/\s/g, "-") })
          }
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
        <p className="text-xs text-slate-400 mt-1">
          Identificador único da filial. Não pode ser alterado depois.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Cidade <span className="text-red-500">*</span>
          </label>
          <input
            id="ob-city"
            type="text"
            placeholder="Ex: São Paulo"
            value={data.city ?? ""}
            onChange={(e) => onChange({ ...data, city: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Estado <span className="text-red-500">*</span>
          </label>
          <select
            id="ob-state"
            value={data.state ?? ""}
            onChange={(e) => onChange({ ...data, state: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            <option value="">UF</option>
            {BRAZIL_STATES.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function validateStep2(d: Partial<OnboardingStep2>): string | null {
  if (!d.branchName?.trim()) return "Nome da sede é obrigatório.";
  if (!d.branchCode?.trim()) return "Código da filial é obrigatório.";
  if (!d.city?.trim()) return "Cidade é obrigatória.";
  if (!d.state) return "Estado é obrigatório.";
  return null;
}

// ─── Step 3: Blueprint ──────────────────────────────────────────────────────

function Step3({
  data,
  segment,
  onChange,
}: {
  data: Partial<OnboardingStep3>;
  segment: TenantSegment | undefined;
  onChange: (d: Partial<OnboardingStep3>) => void;
}) {
  const recommended = BLUEPRINT_OPTIONS.filter((b) =>
    segment ? b.segments.includes(segment) : false,
  );
  const others = BLUEPRINT_OPTIONS.filter((b) => (segment ? !b.segments.includes(segment) : true));

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Blueprints pré-configuram fluxos, relatórios e alertas para o seu segmento. Você pode
        personalizar tudo depois.
      </p>

      {recommended.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">
            Recomendado para você
          </p>
          <div className="space-y-2">
            {recommended.map((bp) => (
              <BlueprintCard
                key={bp.id}
                bp={bp}
                selected={data.blueprintId === bp.id}
                onSelect={() => onChange({ blueprintId: bp.id as BlueprintId })}
                highlighted
              />
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div>
          {recommended.length > 0 && (
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Outros blueprints
            </p>
          )}
          <div className="space-y-2">
            {others.map((bp) => (
              <BlueprintCard
                key={bp.id}
                bp={bp}
                selected={data.blueprintId === bp.id}
                onSelect={() => onChange({ blueprintId: bp.id as BlueprintId })}
                highlighted={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BlueprintCard({
  bp,
  selected,
  onSelect,
  highlighted,
}: {
  bp: (typeof BLUEPRINT_OPTIONS)[number];
  selected: boolean;
  onSelect: () => void;
  highlighted: boolean;
}) {
  return (
    <button
      id={`ob-blueprint-${bp.id}`}
      type="button"
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
        selected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/60 shadow-sm"
          : highlighted
            ? "border-blue-100 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/20 hover:border-blue-300"
            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{bp.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{bp.name}</p>
            {selected && (
              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            {bp.description}
          </p>
        </div>
      </div>
    </button>
  );
}

function validateStep3(d: Partial<OnboardingStep3>): string | null {
  if (!d.blueprintId) return "Selecione um blueprint para continuar.";
  return null;
}

// ─── Step 4: Plan ───────────────────────────────────────────────────────────

interface PlanOption {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  billing_cycle: string;
  trial_days: number;
  included_features: string[];
}

function Step4({
  data,
  onChange,
}: {
  data: Partial<OnboardingStep4>;
  onChange: (d: Partial<OnboardingStep4>) => void;
}) {
  const [plans, setPlans] = useState<PlanOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/commercial/plans?product=platform")
      .then((res) => res.json() as Promise<{ data?: PlanOption[]; error?: string }>)
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setPlans(json.data ?? []);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  function formatPrice(cents: number, currency: string) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
  }

  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!plans) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {plans.map((plan) => (
        <button
          key={plan.id}
          id={`ob-plan-${plan.id}`}
          type="button"
          onClick={() => onChange({ planVersionId: plan.id })}
          className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all ${
            data.planVersionId === plan.id
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/60 shadow-sm"
              : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{plan.name}</p>
            {data.planVersionId === plan.id && (
              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            )}
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
            {formatPrice(plan.price_cents, plan.currency)}
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              {" "}
              /{plan.billing_cycle === "yearly" ? "ano" : "mês"}
            </span>
          </p>
          {plan.trial_days > 0 && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              {plan.trial_days} dias grátis
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            {plan.included_features.join(" · ")}
          </p>
        </button>
      ))}
    </div>
  );
}

function validateStep4(d: Partial<OnboardingStep4>): string | null {
  if (!d.planVersionId) return "Selecione um plano para continuar.";
  return null;
}

// ─── Step 5: Contract ───────────────────────────────────────────────────────

interface ContractInfo {
  id: string;
  title: string;
  content: string;
}

function Step5({
  data,
  onChange,
}: {
  data: Partial<OnboardingStep5>;
  onChange: (d: Partial<OnboardingStep5>) => void;
}) {
  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/commercial/contract?product=platform")
      .then((res) => res.json() as Promise<{ data?: ContractInfo; error?: string }>)
      .then((json) => {
        if (json.error) throw new Error(json.error);
        if (json.data) setContract(json.data);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="h-40 overflow-y-auto px-3.5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        {contract ? (
          <>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
              {contract.title}
            </p>
            {contract.content}
          </>
        ) : (
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Seu nome completo <span className="text-red-500">*</span>
        </label>
        <input
          id="ob-representative-name"
          type="text"
          placeholder="Ex: João Silva"
          value={data.representativeName ?? ""}
          onChange={(e) => onChange({ ...data, representativeName: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Cargo <span className="text-red-500">*</span>
        </label>
        <input
          id="ob-representative-role"
          type="text"
          placeholder="Ex: Sócio-diretor"
          value={data.representativeRole ?? ""}
          onChange={(e) => onChange({ ...data, representativeRole: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          CPF <span className="text-slate-400 text-xs">(opcional)</span>
        </label>
        <input
          id="ob-representative-document"
          type="text"
          placeholder="000.000.000-00"
          value={data.representativeDocument ?? ""}
          onChange={(e) => onChange({ ...data, representativeDocument: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          Endereço de cobrança <span className="text-red-500">*</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <input
              id="ob-billing-phone"
              type="text"
              placeholder="Telefone (ex: 11999999999)"
              value={data.billingPhone ?? ""}
              onChange={(e) => onChange({ ...data, billingPhone: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>
          <div className="col-span-2">
            <input
              id="ob-billing-address"
              type="text"
              placeholder="Endereço (rua/avenida)"
              value={data.billingAddress ?? ""}
              onChange={(e) => onChange({ ...data, billingAddress: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>
          <input
            id="ob-billing-address-number"
            type="text"
            placeholder="Número"
            value={data.billingAddressNumber ?? ""}
            onChange={(e) => onChange({ ...data, billingAddressNumber: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          <input
            id="ob-billing-postal-code"
            type="text"
            placeholder="CEP"
            value={data.billingPostalCode ?? ""}
            onChange={(e) => onChange({ ...data, billingPostalCode: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          <div className="col-span-2">
            <input
              id="ob-billing-province"
              type="text"
              placeholder="Bairro"
              value={data.billingProvince ?? ""}
              onChange={(e) => onChange({ ...data, billingProvince: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>
        </div>
      </div>

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          id="ob-declared-authority"
          type="checkbox"
          checked={data.declaredAuthority ?? false}
          onChange={(e) => onChange({ ...data, declaredAuthority: e.target.checked })}
          className="mt-0.5"
        />
        <span className="text-sm text-slate-600 dark:text-slate-400">
          Declaro possuir poderes suficientes para aceitar este instrumento em nome da organização.
        </span>
      </label>

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          id="ob-contract-accepted"
          type="checkbox"
          checked={data.contractAccepted ?? false}
          onChange={(e) => onChange({ ...data, contractAccepted: e.target.checked })}
          className="mt-0.5"
        />
        <span className="text-sm text-slate-600 dark:text-slate-400">
          Li e aceito o Contrato-Mestre e as condições do plano selecionado.
        </span>
      </label>
    </div>
  );
}

function validateStep5(d: Partial<OnboardingStep5>): string | null {
  if (!d.representativeName?.trim()) return "Informe seu nome completo.";
  if (!d.representativeRole?.trim()) return "Informe seu cargo.";
  if (
    !d.billingPhone?.trim() ||
    !d.billingAddress?.trim() ||
    !d.billingAddressNumber?.trim() ||
    !d.billingPostalCode?.trim() ||
    !d.billingProvince?.trim()
  ) {
    return "Preencha o endereço de cobrança completo.";
  }
  if (!d.declaredAuthority) return "É necessário declarar poderes de representação.";
  if (!d.contractAccepted) return "É necessário aceitar o contrato para continuar.";
  return null;
}

// ─── Progress Stepper ───────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, idx) => {
        const isCompleted = currentStep > step.number;
        const isActive = currentStep === step.number;
        const Icon = step.icon;

        return (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCompleted
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900"
                    : isActive
                      ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900 shadow-lg"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
              </div>
              <span
                className={`text-[10px] font-medium mt-1.5 ${
                  isActive
                    ? "text-blue-600 dark:text-blue-400"
                    : isCompleted
                      ? "text-slate-600 dark:text-slate-400"
                      : "text-slate-400 dark:text-slate-600"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`w-8 h-0.5 mx-1 mb-5 transition-all duration-300 ${
                  currentStep > step.number ? "bg-blue-500" : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Wizard ────────────────────────────────────────────────────────────

interface OnboardingWizardProps {
  onComplete?: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [state, setState] = useState<OnboardingState>({
    step: 1,
    step1: {},
    step2: {},
    step3: {},
    step4: {},
    step5: {},
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  function handleNext() {
    setError(null);
    let validationError: string | null = null;

    if (state.step === 1) validationError = validateStep1(state.step1);
    else if (state.step === 2) validationError = validateStep2(state.step2);
    else if (state.step === 3) validationError = validateStep3(state.step3);
    else if (state.step === 4) validationError = validateStep4(state.step4);

    if (validationError) {
      setError(validationError);
      return;
    }

    if (state.step < 5) {
      setState((prev) => ({ ...prev, step: (prev.step + 1) as OnboardingState["step"] }));
    }
  }

  function handleBack() {
    setError(null);
    if (state.step > 1) {
      setState((prev) => ({ ...prev, step: (prev.step - 1) as OnboardingState["step"] }));
    }
  }

  async function handleSubmit() {
    const validationError = validateStep5(state.step5);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step1: state.step1,
          step2: state.step2,
          step3: state.step3,
          step4: state.step4,
          step5: state.step5,
        }),
      });

      const json = (await res.json()) as { checkoutUrl?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro ao finalizar onboarding.");
      if (!json.checkoutUrl) throw new Error("Checkout não retornou uma URL válida.");

      onComplete?.();
      // Real activation only happens after the webhook confirms payment —
      // Stripe Checkout is the next stop, not the dashboard (item 34).
      window.location.href = json.checkoutUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro inesperado. Tente novamente.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (session === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!session) {
    return <AuthGate onAuthenticated={() => undefined} />;
  }

  return (
    <div>
      <StepIndicator currentStep={state.step} />

      {/* Step title */}
      <div className="mb-6">
        {state.step === 1 && (
          <>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Dados da empresa
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Informe os dados básicos da sua organização.
            </p>
          </>
        )}
        {state.step === 2 && (
          <>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Sede principal</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Configure a filial matriz da sua operação.
            </p>
          </>
        )}
        {state.step === 3 && (
          <>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Escolha um Blueprint
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Configuração inicial baseada no seu segmento.
            </p>
          </>
        )}
        {state.step === 4 && (
          <>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Escolha seu plano
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Você poderá mudar de plano a qualquer momento depois.
            </p>
          </>
        )}
        {state.step === 5 && (
          <>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Contrato</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Revise e aceite antes de prosseguir para o pagamento.
            </p>
          </>
        )}
      </div>

      {/* Step content */}
      <div className="min-h-[280px]">
        {state.step === 1 && (
          <Step1 data={state.step1} onChange={(d) => setState((s) => ({ ...s, step1: d }))} />
        )}
        {state.step === 2 && (
          <Step2 data={state.step2} onChange={(d) => setState((s) => ({ ...s, step2: d }))} />
        )}
        {state.step === 3 && (
          <Step3
            data={state.step3}
            segment={state.step1.segment}
            onChange={(d) => setState((s) => ({ ...s, step3: d }))}
          />
        )}
        {state.step === 4 && (
          <Step4 data={state.step4} onChange={(d) => setState((s) => ({ ...s, step4: d }))} />
        )}
        {state.step === 5 && (
          <Step5 data={state.step5} onChange={(d) => setState((s) => ({ ...s, step5: d }))} />
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          id="ob-error"
          className="mt-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          id="ob-back"
          type="button"
          onClick={handleBack}
          disabled={state.step === 1 || loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {state.step < 5 ? (
          <button
            id="ob-next"
            type="button"
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200 dark:shadow-blue-900 transition"
          >
            Próximo
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            id="ob-submit"
            type="button"
            onClick={() => void handleSubmit()}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200 dark:shadow-blue-900 disabled:opacity-70 disabled:cursor-not-allowed transition"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Redirecionando...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Aceitar e ir para pagamento
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
