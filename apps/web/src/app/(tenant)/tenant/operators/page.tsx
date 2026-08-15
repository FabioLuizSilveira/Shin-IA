"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { UserCog, Plus, ShieldCheck } from "lucide-react";

interface Operator {
  id: string;
  full_name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  status: "active" | "inactive";
  created_at: string;
}

export default function OperatorsPage() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [document, setDocument] = useState("");
  const [creating, setCreating] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/operators");
      const json = (await res.json()) as { data?: Operator[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar operadores");
      setOperators(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    if (!fullName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          document: document.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao criar operador");
      setFullName("");
      setDocument("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setCreating(false);
    }
  }

  async function handleAcknowledgeTerms(operatorId: string) {
    setAcknowledgingId(operatorId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/operators/${operatorId}/acknowledge-terms`, { method: "POST" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao registrar reconhecimento");
      setFeedback("Termos reconhecidos e registrados.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setAcknowledgingId(null);
    }
  }

  return (
    <AppShell title="Operadores">
      <SectionHeader
        title="Operadores"
        description="Cadastro de operadores (funcionários ou proprietários de equipamento) e registro administrativo de reconhecimento dos Termos de Operador — não bloqueia operações."
      />

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Nome completo</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Documento</label>
          <input
            value={document}
            onChange={(e) => setDocument(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        </div>
        <button
          type="button"
          disabled={creating || !fullName.trim()}
          onClick={() => void handleCreate()}
          className="flex items-center gap-2 px-4 py-2 bg-shina-blue hover:bg-blue-600 text-white text-sm font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60"
        >
          <Plus className="w-4 h-4" />
          Adicionar operador
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}
      {feedback && <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">{feedback}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : operators.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhum operador cadastrado ainda.</p>
      ) : (
        <div className="space-y-2">
          {operators.map((op) => (
            <div
              key={op.id}
              className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800"
            >
              <UserCog className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {op.full_name}
                </p>
                <p className="text-xs text-slate-500">
                  {op.document ?? "—"} {op.email ? `· ${op.email}` : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={acknowledgingId === op.id}
                onClick={() => void handleAcknowledgeTerms(op.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer border-0 disabled:opacity-60 shrink-0"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Reconhecer Termos
              </button>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
