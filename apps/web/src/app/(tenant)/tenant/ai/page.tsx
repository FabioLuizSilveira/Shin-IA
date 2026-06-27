"use client";

import { useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Zap,
  BarChart3,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type InsightType = "executive_summary" | "anomalies" | "optimization" | "demand_forecast";

interface InsightCard {
  type: InsightType;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

interface InsightState {
  text: string | null;
  loading: boolean;
  error: string | null;
  cached: boolean;
  expanded: boolean;
}

// ── Insight cards config ───────────────────────────────────────────────────────

const INSIGHT_CARDS: InsightCard[] = [
  {
    type: "executive_summary",
    title: "Resumo Executivo",
    description: "Visão geral do desempenho operacional do mês",
    icon: <TrendingUp className="w-5 h-5" />,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
  },
  {
    type: "anomalies",
    title: "Anomalias Detectadas",
    description: "Padrões fora do normal identificados na operação",
    icon: <AlertTriangle className="w-5 h-5" />,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/50",
  },
  {
    type: "optimization",
    title: "Sugestões de Otimização",
    description: "Oportunidades para melhorar eficiência e reduzir custos",
    icon: <Zap className="w-5 h-5" />,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/50",
  },
  {
    type: "demand_forecast",
    title: "Previsão de Demanda",
    description: "Estimativa de volume para os próximos 7 dias",
    icon: <BarChart3 className="w-5 h-5" />,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/50",
  },
];

// ── Markdown renderer (minimal) ───────────────────────────────────────────────

function renderInsightText(text: string) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;

        // Bold headers (e.g. **Title**)
        const withBold = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

        // Bullet points
        if (line.trim().startsWith("- ") || line.trim().startsWith("• ")) {
          return (
            <div key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300">
              <span className="text-slate-400 shrink-0 mt-0.5">•</span>
              <span dangerouslySetInnerHTML={{ __html: withBold.replace(/^[-•]\s+/, "") }} />
            </div>
          );
        }

        // Numbered list
        if (/^\d+\./.test(line.trim())) {
          return (
            <div key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300">
              <span className="text-blue-500 font-semibold shrink-0 w-4">
                {line.match(/^\d+/)?.[0]}.
              </span>
              <span dangerouslySetInnerHTML={{ __html: withBold.replace(/^\d+\.\s+/, "") }} />
            </div>
          );
        }

        // Regular paragraph
        return (
          <p
            key={i}
            className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: withBold }}
          />
        );
      })}
    </div>
  );
}

// ── Single insight widget ──────────────────────────────────────────────────────

function InsightWidget({ card }: { card: InsightCard }) {
  const [state, setState] = useState<InsightState>({
    text: null,
    loading: false,
    error: null,
    cached: false,
    expanded: false,
  });

  const fetchInsight = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const res = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: card.type }),
      });

      const json = (await res.json()) as {
        insight?: string;
        error?: string;
        cached?: boolean;
      };

      if (!res.ok || json.error) {
        throw new Error(json.error ?? "Erro ao buscar insight");
      }

      setState((s) => ({
        ...s,
        text: json.insight ?? null,
        cached: json.cached ?? false,
        loading: false,
        expanded: true,
      }));
    } catch (err: unknown) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Erro inesperado",
        loading: false,
      }));
    }
  }, [card.type]);

  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden transition-all duration-200`}
    >
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-xl ${card.bgColor} flex items-center justify-center shrink-0 ${card.color}`}
          >
            {card.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {card.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{card.description}</p>
          </div>

          {state.text ? (
            <button
              id={`ai-expand-${card.type}`}
              type="button"
              onClick={() => setState((s) => ({ ...s, expanded: !s.expanded }))}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer border-0 bg-transparent"
            >
              {state.expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          ) : null}
        </div>

        {/* Generate button */}
        {!state.text && !state.loading && (
          <button
            id={`ai-generate-${card.type}`}
            type="button"
            onClick={() => void fetchInsight()}
            className={`mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition cursor-pointer bg-transparent`}
          >
            <Sparkles className="w-4 h-4" />
            Gerar insight
          </button>
        )}

        {/* Loading */}
        {state.loading && (
          <div className="mt-4 flex items-center gap-3 py-3">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Gerando insight com IA…
            </span>
          </div>
        )}

        {/* Error */}
        {state.error && (
          <div className="mt-4 px-4 py-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{state.error}</p>
              <button
                type="button"
                onClick={() => void fetchInsight()}
                className="mt-1 text-xs underline bg-transparent border-0 cursor-pointer text-current text-left p-0"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Insight content */}
      {state.text && state.expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-5 pb-5 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {state.cached && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3" /> Cache
                </span>
              )}
            </div>
            <button
              id={`ai-refresh-${card.type}`}
              type="button"
              onClick={() => {
                setState((s) => ({ ...s, text: null, expanded: false }));
                setTimeout(() => void fetchInsight(), 50);
              }}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer bg-transparent border-0"
            >
              <RefreshCw className="w-3 h-3" />
              Regerar
            </button>
          </div>
          {renderInsightText(state.text)}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AIPage() {
  const [generating, setGenerating] = useState<InsightType | null>(null);

  async function generateAll() {
    // Trigger all sequentially to avoid rate limits
    for (const card of INSIGHT_CARDS) {
      setGenerating(card.type);
      try {
        await fetch("/api/ai/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: card.type }),
        });
      } catch {
        // individual widget will show error
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    setGenerating(null);
    // Trigger page reload so each widget can fetch from cache
    window.location.reload();
  }

  return (
    <AppShell title="AI Center">
      <div className="max-w-4xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-blue-900">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-display">
                AI Center
              </h1>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg">
              Insights inteligentes gerados automaticamente com base nos dados operacionais da sua
              plataforma. Powered by Claude AI.
            </p>
          </div>

          <button
            id="ai-generate-all"
            type="button"
            onClick={() => void generateAll()}
            disabled={generating !== null}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-60 transition cursor-pointer border-0"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Gerando…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Gerar todos
              </>
            )}
          </button>
        </div>

        {/* Info banner */}
        <div className="mb-6 px-4 py-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-xl">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            ✨ <strong>Dica:</strong> Os insights são gerados com base nos dados reais da sua
            operação dos últimos 30 dias. Os resultados ficam em cache por 1 hora para economizar
            tokens.
          </p>
        </div>

        {/* Insight widgets grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {INSIGHT_CARDS.map((card) => (
            <InsightWidget key={card.type} card={card} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
