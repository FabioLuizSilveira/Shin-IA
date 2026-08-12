"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { ShieldAlert, RefreshCw, Send, MessageSquare } from "lucide-react";

interface ImpersonationSession {
  id: string;
  tenant_name: string;
  actor_email: string;
  target_user_name: string | null;
  target_user_email: string | null;
  reason: string;
  access_mode: "full" | "read_only";
  status: "active" | "revoked" | "expired";
  started_at: string;
  ended_at: string | null;
}

interface SupportThreadSummary {
  tenantId: string;
  tenantName: string;
  lastMessage: string;
  lastSenderRole: string;
  lastCreatedAt: string;
  unreadCount: number;
}

interface SupportMessage {
  id: string;
  sender_role: "tenant" | "platform";
  body: string;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  revoked: "Encerrada",
  expired: "Expirada",
};

const STATUS_COLOR: Record<string, string> = {
  active: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  revoked: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  expired: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

function formatDateTime(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MessagesTab() {
  const [threads, setThreads] = useState<SupportThreadSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadThreads = useCallback(async () => {
    const res = await fetch("/api/platform-support/threads");
    const json = (await res.json()) as { data?: SupportThreadSummary[] };
    const list = (json.data ?? []).sort(
      (a, b) => new Date(b.lastCreatedAt).getTime() - new Date(a.lastCreatedAt).getTime(),
    );
    setThreads(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  const openThread = useCallback(async (tenantId: string) => {
    setSelected(tenantId);
    const res = await fetch(`/api/platform-support/threads/${tenantId}`);
    const json = (await res.json()) as { data?: SupportMessage[] };
    setMessages(json.data ?? []);
    await fetch(`/api/platform-support/threads/${tenantId}`, { method: "PATCH" });
    setThreads((prev) => prev.map((t) => (t.tenantId === tenantId ? { ...t, unreadCount: 0 } : t)));
  }, []);

  async function handleSend() {
    if (!selected || !draft.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/platform-support/threads/${selected}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      });
      const json = (await res.json()) as { data?: SupportMessage };
      if (json.data) setMessages((prev) => [...prev, json.data as SupportMessage]);
      setDraft("");
      await loadThreads();
    } finally {
      setSending(false);
    }
  }

  if (loading)
    return <div className="h-64 animate-pulse bg-slate-50 dark:bg-slate-800 rounded-xl" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {threads.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm px-4">
            Nenhuma conversa ainda.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/50 list-none m-0 p-0">
            {threads.map((t) => (
              <li key={t.tenantId}>
                <button
                  type="button"
                  onClick={() => void openThread(t.tenantId)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 border-0 cursor-pointer bg-transparent ${
                    selected === t.tenantId ? "bg-slate-50 dark:bg-slate-800/50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {t.tenantName}
                    </p>
                    {t.unreadCount > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {t.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {t.lastSenderRole === "platform" ? "Você: " : ""}
                    {t.lastMessage}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col h-[480px]">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-sm gap-2">
            <MessageSquare className="w-8 h-8" />
            Selecione uma conversa
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
                    m.sender_role === "platform"
                      ? "ml-auto bg-shina-blue text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <p>{m.body}</p>
                  <p
                    className={`text-[10px] mt-1 ${m.sender_role === "platform" ? "text-blue-100" : "text-slate-400"}`}
                  >
                    {formatDateTime(m.created_at)}
                  </p>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleSend()}
                placeholder="Responder ao tenant..."
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={sending || !draft.trim()}
                className="p-2 rounded-lg bg-shina-blue hover:bg-blue-600 text-white border-0 cursor-pointer disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ImpersonationTab() {
  const [sessions, setSessions] = useState<ImpersonationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [onlyActive, setOnlyActive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platform-settings/impersonation-sessions");
      const json = (await res.json()) as { data?: ImpersonationSession[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar sessões");
      setSessions(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleForceEnd(id: string) {
    if (!confirm("Encerrar esta sessão de personificação agora?")) return;
    setEndingId(id);
    try {
      await fetch(`/api/platform-settings/impersonation-sessions/${id}`, { method: "PATCH" });
      await load();
    } finally {
      setEndingId(null);
    }
  }

  const visible = onlyActive ? sessions.filter((s) => s.status === "active") : sessions;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyActive(false)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border-0 cursor-pointer ${
              !onlyActive
                ? "bg-shina-blue text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            }`}
          >
            Todas ({sessions.length})
          </button>
          <button
            type="button"
            onClick={() => setOnlyActive(true)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border-0 cursor-pointer ${
              onlyActive
                ? "bg-shina-blue text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            }`}
          >
            Ativas ({sessions.filter((s) => s.status === "active").length})
          </button>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 bg-transparent border-0 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 dark:bg-red-950/20 dark:border-red-800 dark:text-red-400">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="h-64 animate-pulse bg-slate-50 dark:bg-slate-800" />
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
            Nenhuma sessão de personificação registrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Tenant</th>
                  <th className="px-6 py-3 text-left font-medium">Admin</th>
                  <th className="px-6 py-3 text-left font-medium">Usuário acessado</th>
                  <th className="px-6 py-3 text-left font-medium">Motivo</th>
                  <th className="px-6 py-3 text-left font-medium">Modo</th>
                  <th className="px-6 py-3 text-left font-medium">Status</th>
                  <th className="px-6 py-3 text-left font-medium">Início</th>
                  <th className="px-6 py-3 text-left font-medium">Fim</th>
                  <th className="px-6 py-3 text-left font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {visible.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {s.tenant_name}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {s.actor_email}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {s.target_user_name ?? s.target_user_email ?? "—"}
                    </td>
                    <td className="px-6 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {s.reason}
                    </td>
                    <td className="px-6 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {s.access_mode === "full" ? "Completo" : "Somente leitura"}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[s.status]}`}
                      >
                        {STATUS_LABEL[s.status]}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDateTime(s.started_at)}
                    </td>
                    <td className="px-6 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDateTime(s.ended_at)}
                    </td>
                    <td className="px-6 py-3">
                      {s.status === "active" && (
                        <button
                          type="button"
                          onClick={() => void handleForceEnd(s.id)}
                          disabled={endingId === s.id}
                          className="text-xs font-semibold text-red-600 hover:text-red-700 bg-transparent border-0 cursor-pointer disabled:opacity-60"
                        >
                          {endingId === s.id ? "Encerrando..." : "Encerrar"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function PlatformSupportPage() {
  const [tab, setTab] = useState<"messages" | "impersonation">("messages");

  return (
    <AppShell title="Suporte">
      <SectionHeader
        title="Suporte"
        description="Mensagens com tenants e histórico de acessos de suporte (impersonação)."
      />

      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTab("messages")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border-0 cursor-pointer ${
            tab === "messages"
              ? "bg-shina-blue text-white"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
          }`}
        >
          Mensagens
        </button>
        <button
          type="button"
          onClick={() => setTab("impersonation")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border-0 cursor-pointer ${
            tab === "impersonation"
              ? "bg-shina-blue text-white"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
          }`}
        >
          Personificação
        </button>
      </div>

      {tab === "messages" ? <MessagesTab /> : <ImpersonationTab />}
    </AppShell>
  );
}
