"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { Sparkles, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface UsageRow {
  id: string;
  operation: string;
  provider: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  credits_consumed: number | null;
  estimated_cost_usd: number | null;
  created_at: string;
}

interface LedgerRow {
  id: string;
  event_type: string;
  credits_delta: number;
  balance_after: number;
  created_at: string;
}

const EVENT_LABEL: Record<string, string> = {
  CREDIT_GRANT: "Concessão de créditos",
  AI_USAGE: "Uso de IA",
  CREDIT_PURCHASE: "Compra de créditos",
  PLAN_RENEWAL: "Renovação do plano",
  ADJUSTMENT: "Ajuste",
  REFUND: "Estorno",
  EXPIRATION: "Expiração",
};

function formatCredits(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AiCreditsPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"usage" | "ledger">("usage");

  useEffect(() => {
    void (async () => {
      const [balanceRes, usageRes, ledgerRes] = await Promise.all([
        fetch("/api/ai/credits/balance").then((r) => r.json()),
        fetch("/api/ai/credits/usage?limit=50").then((r) => r.json()),
        fetch("/api/ai/credits/ledger?limit=50").then((r) => r.json()),
      ]);
      setBalance(balanceRes?.data?.balance ?? 0);
      setUsage(usageRes?.data ?? []);
      setLedger(ledgerRes?.data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <AppShell title="IA e Créditos">
      <div className="max-w-3xl">
        <SectionHeader
          title="IA e Créditos"
          description="Saldo e histórico de uso dos créditos de IA da Shinã neste workspace."
        />

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 mt-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Saldo disponível</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {formatCredits(balance ?? 0)} créditos
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-2 border-b border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setTab("usage")}
                className={`px-3 py-2 text-sm font-medium border-0 bg-transparent cursor-pointer border-b-2 -mb-px ${
                  tab === "usage"
                    ? "border-shina-blue text-shina-blue"
                    : "border-transparent text-slate-500"
                }`}
              >
                Uso detalhado
              </button>
              <button
                type="button"
                onClick={() => setTab("ledger")}
                className={`px-3 py-2 text-sm font-medium border-0 bg-transparent cursor-pointer border-b-2 -mb-px ${
                  tab === "ledger"
                    ? "border-shina-blue text-shina-blue"
                    : "border-transparent text-slate-500"
                }`}
              >
                Histórico do saldo
              </button>
            </div>

            {tab === "usage" && (
              <div className="mt-4 space-y-2">
                {usage.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-8">
                    Nenhum uso registrado ainda.
                  </p>
                )}
                {usage.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                      className="w-full flex items-center justify-between border-0 bg-transparent cursor-pointer p-0 text-left"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {row.operation}
                        </p>
                        <p className="text-xs text-slate-400">{formatDateTime(row.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {row.credits_consumed !== null
                            ? `${formatCredits(row.credits_consumed)} créditos`
                            : "—"}
                        </span>
                        {expandedId === row.id ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </button>
                    {expandedId === row.id && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <div>
                          Modelo:{" "}
                          <span className="text-slate-700 dark:text-slate-300">Shinã Standard</span>
                        </div>
                        <div>
                          Entrada:{" "}
                          <span className="text-slate-700 dark:text-slate-300">
                            {row.tokens_in} tokens
                          </span>
                        </div>
                        <div>
                          Saída:{" "}
                          <span className="text-slate-700 dark:text-slate-300">
                            {row.tokens_out} tokens
                          </span>
                        </div>
                        <div>
                          Provider (interno):{" "}
                          <span className="text-slate-700 dark:text-slate-300">
                            {row.provider}/{row.model}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === "ledger" && (
              <div className="mt-4 space-y-2">
                {ledger.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-8">
                    Nenhum lançamento ainda.
                  </p>
                )}
                {ledger.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {EVENT_LABEL[row.event_type] ?? row.event_type}
                      </p>
                      <p className="text-xs text-slate-400">{formatDateTime(row.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-semibold ${
                          row.credits_delta >= 0
                            ? "text-emerald-600"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {row.credits_delta >= 0 ? "+" : ""}
                        {formatCredits(row.credits_delta)}
                      </p>
                      <p className="text-xs text-slate-400">
                        saldo: {formatCredits(row.balance_after)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
