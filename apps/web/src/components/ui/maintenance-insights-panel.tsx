"use client";

import { useCallback, useEffect, useState } from "react";
import { Wrench, RefreshCw, Check, X as XIcon } from "lucide-react";

interface InsightRow {
  id: string;
  asset_id: string | null;
  type: string;
  severity: "medium" | "high";
  message: string;
  status: "open" | "acknowledged" | "dismissed";
  created_at: string;
}

const SEVERITY_CLASS: Record<InsightRow["severity"], string> = {
  medium:
    "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300",
  high: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300",
};

// Etapa 15 — "Shinã Insights", integrated into the existing AI Center
// page rather than a parallel dashboard. Unlike the four LLM-generated
// cards above it on this same page, this panel is entirely deterministic
// (Maintenance Auditor, no LLM call) -- it works today even without
// ANTHROPIC_API_KEY configured, which is worth surfacing to whoever's
// looking at this page wondering why the cards above are erroring.
export function MaintenanceInsightsPanel() {
  const [insights, setInsights] = useState<InsightRow[] | null>(null);
  const [running, setRunning] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/maintenance/insights");
      const json = (await res.json()) as { data?: InsightRow[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar insights.");
      setInsights(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAudit() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/maintenance/auditor/run", { method: "POST" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao rodar a auditoria.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setRunning(false);
    }
  }

  async function decide(id: string, status: "acknowledged" | "dismissed") {
    setDecidingId(id);
    try {
      const res = await fetch(`/api/maintenance/insights/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setInsights((prev) => (prev ? prev.filter((i) => i.id !== id) : prev));
      }
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-shina-blue/10 flex items-center justify-center shrink-0 text-shina-blue">
          <Wrench className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Insights de Manutenção
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Auditoria determinística da frota — saúde crítica, risco elevado e recomendações
            paradas. Não depende de IA generativa.
          </p>
        </div>
        <button
          type="button"
          disabled={running}
          onClick={() => void runAudit()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 disabled:opacity-60 border-0 cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${running ? "animate-spin" : ""}`} />
          {running ? "Rodando..." : "Rodar auditoria"}
        </button>
      </div>

      <div className="border-t border-slate-100 dark:border-slate-800 px-5 pb-5 pt-4">
        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}

        {insights === null && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"
              />
            ))}
          </div>
        )}

        {insights && insights.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">
            Nenhum insight aberto no momento.
          </p>
        )}

        {insights && insights.length > 0 && (
          <ul className="space-y-2">
            {insights.map((insight) => (
              <li
                key={insight.id}
                className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 ${SEVERITY_CLASS[insight.severity]}`}
              >
                <p className="text-sm flex-1 min-w-0">{insight.message}</p>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={decidingId === insight.id}
                    onClick={() => void decide(insight.id, "acknowledged")}
                    title="Reconhecer"
                    className="p-1.5 rounded-lg bg-white/60 dark:bg-black/20 hover:opacity-80 disabled:opacity-50 border-0 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={decidingId === insight.id}
                    onClick={() => void decide(insight.id, "dismissed")}
                    title="Dispensar"
                    className="p-1.5 rounded-lg bg-white/60 dark:bg-black/20 hover:opacity-80 disabled:opacity-50 border-0 cursor-pointer"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
