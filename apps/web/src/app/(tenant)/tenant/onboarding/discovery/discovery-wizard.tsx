"use client";

// WAVE 6 -- the actual Discovery Wizard UI, consuming the Wave 2 primitives
// (Stepper, RadioCard, Chip, Toggle) against the real Wave 2/3 backend
// (GET/POST /api/onboarding/discovery). Pilot-only: reachable by URL, not
// linked from the sidebar, and the backend route itself 403s unless
// `onboarding.discovery` is enabled for the tenant.

import { useEffect, useMemo, useState } from "react";
import {
  Stepper,
  RadioCard,
  Chip,
  Toggle,
  Button,
  Input,
  GlassCard,
  Badge,
  ErrorState,
} from "@shina/design-system";
import styles from "./discovery.module.css";

type QuestionType = "single_select" | "multi_select" | "number" | "range" | "boolean";

interface DiscoveryOption {
  value: string;
  label: string;
}

interface DiscoveryQuestion {
  key: string;
  prompt: string;
  helpText: string | null;
  questionType: QuestionType;
  options: DiscoveryOption[];
  appliesToVerticals: string[];
  mapsTo: string;
  required: boolean;
  sortOrder: number;
}

interface Answer {
  questionKey: string;
  value: unknown;
}

interface Recommendation {
  blueprint: {
    baseBlueprintId: string;
    requiredCapabilities: string[];
    optionalCapabilities: string[];
  };
  plan: { planKey: string; priceCents: number | null; includedFeatures: string[] };
  recommendedExtensions: string[];
  optionalAddOns: string[];
  contractTemplateKey: string | null;
  reasons: Array<{ code: string; message: string }>;
}

function questionApplies(q: DiscoveryQuestion, verticals: string[]): boolean {
  if (q.appliesToVerticals.length === 0) return true;
  if (verticals.length === 0) return false;
  return q.appliesToVerticals.some((v) => verticals.includes(v));
}

/** Same rule as @shina/commercial-platform's collectSelectedVerticals — the
 *  primary_activity answer plus every value picked in other_activities
 *  (WAVE 2 — Multi-Operation Business Architecture v2), so a tenant running
 *  rental + towing + passenger transport sees every operation's own
 *  follow-up questions, not just the primary's. */
function collectSelectedVerticals(answers: Answer[]): string[] {
  const primary = answers.find((a) => a.questionKey === "primary_activity")?.value;
  const additional = answers.find((a) => a.questionKey === "other_activities")?.value;
  const verticals = new Set<string>();
  if (typeof primary === "string" && primary) verticals.add(primary);
  if (Array.isArray(additional)) {
    for (const v of additional) if (typeof v === "string" && v) verticals.add(v);
  }
  return [...verticals];
}

/** Same adaptive rule as @shina/commercial-platform's nextDiscoveryQuestion,
 *  reimplemented locally so this client bundle doesn't pull in a
 *  service-role Supabase package for one tiny pure function. */
function nextQuestion(questions: DiscoveryQuestion[], answers: Answer[]): DiscoveryQuestion | null {
  const answered = new Set(answers.map((a) => a.questionKey));
  const verticals = collectSelectedVerticals(answers);
  const ordered = [...questions].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const q of ordered) {
    if (answered.has(q.key)) continue;
    if (!questionApplies(q, verticals)) continue;
    return q;
  }
  return null;
}

function formatBRL(cents: number | null): string {
  if (cents === null) return "a definir";
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}/mês`;
}

export function DiscoveryWizard() {
  const [questions, setQuestions] = useState<DiscoveryQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [draft, setDraft] = useState<unknown>(undefined);
  const [loadError, setLoadError] = useState<"forbidden" | "error" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding/discovery");
        if (res.status === 403) {
          if (!cancelled) setLoadError("forbidden");
          return;
        }
        const json = (await res.json()) as { data?: { questions: DiscoveryQuestion[] } };
        if (!res.ok || !json.data) throw new Error("failed");
        if (!cancelled) setQuestions(json.data.questions);
      } catch {
        if (!cancelled) setLoadError("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = useMemo(
    () => (questions ? nextQuestion(questions, answers) : null),
    [questions, answers],
  );

  const answeredCount = answers.length;
  const totalApplicable = useMemo(() => {
    if (!questions) return 0;
    const verticals = collectSelectedVerticals(answers);
    return questions.filter((q) => questionApplies(q, verticals)).length;
  }, [questions, answers]);

  function commitAnswer(value: unknown) {
    if (!current) return;
    setAnswers((prev) => [
      ...prev.filter((a) => a.questionKey !== current.key),
      { questionKey: current.key, value },
    ]);
    setDraft(undefined);
  }

  function goBack() {
    if (answers.length === 0) return;
    setAnswers((prev) => prev.slice(0, -1));
  }

  async function submit() {
    const primaryVertical = answers.find((a) => a.questionKey === "primary_activity")?.value;
    if (typeof primaryVertical !== "string") return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/onboarding/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryVertical,
          additionalVerticals:
            answers.find((a) => a.questionKey === "other_activities")?.value ?? [],
          answers,
        }),
      });
      const json = (await res.json()) as {
        data?: { recommendation: Recommendation };
        error?: string;
      };
      if (!res.ok || !json.data) throw new Error(json.error ?? "falha ao gerar recomendação");
      setRecommendation(json.data.recommendation);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "erro inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError === "forbidden") {
    return (
      <div className={styles.scope} style={{ padding: 32, borderRadius: 16 }}>
        <ErrorState
          code="forbidden"
          title="Discovery ainda não habilitado"
          description="Este tenant não tem a funcionalidade de descoberta inteligente ativada."
        />
      </div>
    );
  }
  if (loadError === "error") {
    return (
      <div className={styles.scope} style={{ padding: 32, borderRadius: 16 }}>
        <ErrorState code="server" />
      </div>
    );
  }
  if (!questions) {
    return (
      <div className={styles.scope} style={{ padding: 32, borderRadius: 16 }}>
        <p style={{ color: "var(--shina-text-secondary)" }}>Carregando…</p>
      </div>
    );
  }

  if (recommendation) {
    return (
      <div className={styles.scope} style={{ padding: 32, borderRadius: 16 }}>
        <GlassCard className="p-6 max-w-2xl">
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--shina-text-title)" }}>
            Recomendação para a sua operação
          </h2>
          <p className="text-sm mb-5" style={{ color: "var(--shina-text-secondary)" }}>
            Baseada nas suas respostas — determinística, sem chute de IA.
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="info">Blueprint: {recommendation.blueprint.baseBlueprintId}</Badge>
            <Badge variant="success">Plano: {recommendation.plan.planKey}</Badge>
            <Badge variant="neutral">{formatBRL(recommendation.plan.priceCents)}</Badge>
          </div>

          {recommendation.recommendedExtensions.length > 0 && (
            <div className="mb-4">
              <p
                className="text-xs font-medium mb-1.5"
                style={{ color: "var(--shina-text-secondary)" }}
              >
                Extensões recomendadas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {recommendation.recommendedExtensions.map((e) => (
                  <Chip key={e} label={e} selected disabled />
                ))}
              </div>
            </div>
          )}

          <div className="mb-5">
            <p
              className="text-xs font-medium mb-1.5"
              style={{ color: "var(--shina-text-secondary)" }}
            >
              Por que essa recomendação
            </p>
            <ul className="text-sm space-y-1" style={{ color: "var(--shina-text-primary)" }}>
              {recommendation.reasons.map((r, i) => (
                <li key={i}>• {r.message}</li>
              ))}
            </ul>
          </div>

          <Button
            onClick={() => {
              setRecommendation(null);
              setAnswers([]);
            }}
          >
            Refazer discovery
          </Button>
        </GlassCard>
      </div>
    );
  }

  if (!current) {
    // discovery answered in full — awaiting submit
    return (
      <div className={styles.scope} style={{ padding: 32, borderRadius: 16 }}>
        <GlassCard className="p-6 max-w-xl">
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--shina-text-title)" }}>
            Pronto para gerar a recomendação
          </h2>
          <p className="text-sm mb-5" style={{ color: "var(--shina-text-secondary)" }}>
            {answeredCount} de {totalApplicable} perguntas respondidas.
          </p>
          {submitError && (
            <p className="text-sm mb-3" style={{ color: "var(--shina-danger-text)" }}>
              {submitError}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={goBack}>
              Voltar
            </Button>
            <Button onClick={submit} loading={submitting}>
              Gerar recomendação
            </Button>
          </div>
        </GlassCard>
      </div>
    );
  }

  const steps = questions
    .filter((q) => questionApplies(q, collectSelectedVerticals(answers)))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((q) => ({
      id: q.key,
      label: q.prompt.length > 24 ? q.prompt.slice(0, 24) + "…" : q.prompt,
    }));
  const currentIndex = steps.findIndex((s) => s.id === current.key);

  return (
    <div className={styles.scope} style={{ padding: 32, borderRadius: 16 }}>
      <div className="max-w-xl">
        <Stepper steps={steps} current={currentIndex} className="mb-8" />

        <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--shina-text-title)" }}>
          {current.prompt}
        </h2>
        {current.helpText && (
          <p className="text-sm mb-5" style={{ color: "var(--shina-text-secondary)" }}>
            {current.helpText}
          </p>
        )}

        <div className="mb-6">
          {current.questionType === "single_select" && (
            <div className="space-y-2">
              {current.options.map((opt) => (
                <RadioCard
                  key={opt.value}
                  title={opt.label}
                  selected={draft === opt.value}
                  onSelect={() => commitAnswer(opt.value)}
                />
              ))}
            </div>
          )}

          {current.questionType === "multi_select" && (
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                {current.options.map((opt) => {
                  const list = Array.isArray(draft) ? (draft as string[]) : [];
                  const selected = list.includes(opt.value);
                  return (
                    <Chip
                      key={opt.value}
                      label={opt.label}
                      selected={selected}
                      onToggle={() =>
                        setDraft(
                          selected ? list.filter((v) => v !== opt.value) : [...list, opt.value],
                        )
                      }
                    />
                  );
                })}
              </div>
              <Button onClick={() => commitAnswer(Array.isArray(draft) ? draft : [])}>
                Continuar
              </Button>
            </div>
          )}

          {current.questionType === "boolean" && (
            <div>
              <Toggle
                checked={draft === true}
                onChange={(checked) => setDraft(checked)}
                label={draft === true ? "Sim" : "Não"}
              />
              <div className="mt-4">
                <Button onClick={() => commitAnswer(draft === true)}>Continuar</Button>
              </div>
            </div>
          )}

          {(current.questionType === "number" || current.questionType === "range") && (
            <div className="flex items-end gap-2">
              <Input
                type="number"
                min={0}
                value={typeof draft === "number" ? draft : ""}
                onChange={(e) =>
                  setDraft(e.target.value === "" ? undefined : Number(e.target.value))
                }
                className="max-w-[160px]"
              />
              <Button
                onClick={() => commitAnswer(typeof draft === "number" ? draft : 0)}
                disabled={draft === undefined && current.required}
              >
                Continuar
              </Button>
            </div>
          )}
        </div>

        {answers.length > 0 && (
          <Button variant="secondary" onClick={goBack}>
            Voltar
          </Button>
        )}
      </div>
    </div>
  );
}
