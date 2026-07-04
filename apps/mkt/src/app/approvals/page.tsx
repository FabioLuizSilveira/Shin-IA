"use client";

import { useCallback, useEffect, useState } from "react";
import { MktShell } from "@/components/layout/mkt-shell";
import { ShieldCheck, Check, X, Loader2, Bot, User } from "lucide-react";

interface Draft {
  id: string;
  entity_type: string;
  action: string;
  payload: Record<string, unknown>;
  status: string;
  agent_id: string | null;
  created_at: string;
  review_note: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  create: "Criar",
  update: "Atualizar",
  delete: "Excluir",
  publish: "Publicar",
  pause: "Pausar",
  budget_change: "Alterar orçamento",
};

export default function ApprovalsPage() {
  const [pending, setPending] = useState<Draft[]>([]);
  const [history, setHistory] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [pendingRes, appliedRes, rejectedRes] = await Promise.all([
      fetch("/api/drafts?status=pending"),
      fetch("/api/drafts?status=applied"),
      fetch("/api/drafts?status=rejected"),
    ]);
    const pendingJson = (await pendingRes.json()) as { data?: Draft[] };
    const appliedJson = (await appliedRes.json()) as { data?: Draft[] };
    const rejectedJson = (await rejectedRes.json()) as { data?: Draft[] };
    setPending(pendingJson.data ?? []);
    setHistory(
      [...(appliedJson.data ?? []), ...(rejectedJson.data ?? [])]
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, 20),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, decision: "approve" | "reject") {
    setActing(id);
    setError(null);
    try {
      const note =
        decision === "reject" ? (window.prompt("Motivo da rejeição (opcional):") ?? "") : undefined;
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision, note }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro ao processar decisão");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setActing(null);
    }
  }

  return (
    <MktShell title="Aprovações">
      <div className="max-w-3xl">
        <p className="text-sm text-slate-400 mb-6">
          Nenhuma ação chega às plataformas de ads sem passar por aqui. Rascunhos criados por
          usuários ou agentes (MCP) aguardam sua revisão.
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-12 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">
              Pendentes ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <div className="card-glass rounded-2xl p-8 text-center mb-8">
                <ShieldCheck className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Nenhum rascunho aguardando aprovação.</p>
              </div>
            ) : (
              <div className="space-y-3 mb-8">
                {pending.map((draft) => (
                  <div key={draft.id} className="card-glass rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      {draft.agent_id ? (
                        <span
                          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-semibold"
                          title={draft.agent_id}
                        >
                          <Bot className="w-3 h-3" /> Agente
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-semibold">
                          <User className="w-3 h-3" /> Usuário
                        </span>
                      )}
                      <span className="text-xs font-bold text-white">
                        {ACTION_LABELS[draft.action] ?? draft.action} {draft.entity_type}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-auto">
                        {new Date(draft.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>

                    <pre className="text-xs text-slate-300 bg-black/30 rounded-xl p-3 overflow-x-auto mb-3">
                      {JSON.stringify(draft.payload, null, 2)}
                    </pre>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={acting === draft.id}
                        onClick={() => void decide(draft.id, "reject")}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition bg-transparent cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" /> Rejeitar
                      </button>
                      <button
                        type="button"
                        disabled={acting === draft.id}
                        onClick={() => void decide(draft.id, "approve")}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition border-0 cursor-pointer"
                      >
                        {acting === draft.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        Aprovar e aplicar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h2 className="text-sm font-semibold text-slate-300 mb-3">Histórico recente</h2>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma decisão registrada.</p>
            ) : (
              <div className="space-y-2">
                {history.map((draft) => (
                  <div key={draft.id} className="card-glass rounded-xl p-3 flex items-center gap-3">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        draft.status === "applied"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {draft.status === "applied" ? "Aprovado" : "Rejeitado"}
                    </span>
                    <span className="text-xs text-slate-300 flex-1 truncate">
                      {ACTION_LABELS[draft.action] ?? draft.action} {draft.entity_type}
                      {typeof draft.payload.name === "string" ? ` — ${draft.payload.name}` : ""}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(draft.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </MktShell>
  );
}
