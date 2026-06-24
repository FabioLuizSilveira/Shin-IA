"use client";

import { useState } from "react";
import {
  Building2,
  MapPin,
  UserPlus,
  Layers,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import type {
  OnboardingState,
  OnboardingStep1,
  OnboardingStep2,
  OnboardingStep3,
  OnboardingStep4,
  BlueprintId,
  TenantSegment,
} from "@/types/onboarding";
import { SEGMENT_LABELS, BLUEPRINT_OPTIONS } from "@/types/onboarding";

const STEPS = [
  { number: 1, label: "Empresa", icon: Building2 },
  { number: 2, label: "Sede", icon: MapPin },
  { number: 3, label: "Admin", icon: UserPlus },
  { number: 4, label: "Blueprint", icon: Layers },
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

// ─── Step 3: Admin Invite ───────────────────────────────────────────────────

function Step3({
  data,
  onChange,
}: {
  data: Partial<OnboardingStep3>;
  onChange: (d: Partial<OnboardingStep3>) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="p-4 bg-blue-50 dark:bg-blue-950/50 rounded-xl border border-blue-100 dark:border-blue-900">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          O administrador terá acesso total à plataforma e poderá convidar outros usuários. Um email
          de acesso será enviado automaticamente.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Nome completo <span className="text-red-500">*</span>
        </label>
        <input
          id="ob-admin-name"
          type="text"
          placeholder="Ex: João Silva"
          value={data.adminFullName ?? ""}
          onChange={(e) => onChange({ ...data, adminFullName: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          id="ob-admin-email"
          type="email"
          placeholder="admin@suaempresa.com.br"
          value={data.adminEmail ?? ""}
          onChange={(e) => onChange({ ...data, adminEmail: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>
    </div>
  );
}

function validateStep3(d: Partial<OnboardingStep3>): string | null {
  if (!d.adminFullName?.trim()) return "Nome do administrador é obrigatório.";
  if (!d.adminEmail?.trim() || !d.adminEmail.includes("@")) return "Email inválido.";
  return null;
}

// ─── Step 4: Blueprint ──────────────────────────────────────────────────────

function Step4({
  data,
  segment,
  onChange,
}: {
  data: Partial<OnboardingStep4>;
  segment: TenantSegment | undefined;
  onChange: (d: Partial<OnboardingStep4>) => void;
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

function validateStep4(d: Partial<OnboardingStep4>): string | null {
  if (!d.blueprintId) return "Selecione um blueprint para continuar.";
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
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCompleted
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900"
                    : isActive
                      ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900 shadow-lg"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                }`}
              >
                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
              </div>
              <span
                className={`text-xs font-medium mt-1.5 ${
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
                className={`w-16 h-0.5 mx-1 mb-5 transition-all duration-300 ${
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
  const [state, setState] = useState<OnboardingState>({
    step: 1,
    step1: {},
    step2: {},
    step3: {},
    step4: {},
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function handleNext() {
    setError(null);
    let validationError: string | null = null;

    if (state.step === 1) validationError = validateStep1(state.step1);
    else if (state.step === 2) validationError = validateStep2(state.step2);
    else if (state.step === 3) validationError = validateStep3(state.step3);

    if (validationError) {
      setError(validationError);
      return;
    }

    if (state.step < 4) {
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
    const validationError = validateStep4(state.step4);
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
        }),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Erro ao finalizar onboarding.");
      }

      setDone(true);
      setTimeout(() => {
        onComplete?.();
        window.location.href = "/dashboard";
      }, 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro inesperado. Tente novamente.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ── Success screen ──
  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-bounce-once">
          <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Configuração concluída!
        </h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-xs">
          Sua plataforma está pronta. Redirecionando para o dashboard...
        </p>
        <div className="flex gap-1.5 mt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    );
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
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Administrador</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Defina o usuário administrador da plataforma.
            </p>
          </>
        )}
        {state.step === 4 && (
          <>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Escolha um Blueprint
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Configuração inicial baseada no seu segmento.
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
          <Step3 data={state.step3} onChange={(d) => setState((s) => ({ ...s, step3: d }))} />
        )}
        {state.step === 4 && (
          <Step4
            data={state.step4}
            segment={state.step1.segment}
            onChange={(d) => setState((s) => ({ ...s, step4: d }))}
          />
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

        {state.step < 4 ? (
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
                Configurando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Finalizar configuração
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
