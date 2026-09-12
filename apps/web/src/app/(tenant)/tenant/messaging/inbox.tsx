"use client";

// WAVE 2 — Operational Inbox (spec section 11). Deliberately built in
// apps/web's own established plain-Tailwind idiom (see tenant/support's
// page.tsx) rather than the design-system's glass components — those
// depend on --shina-* CSS variables that apps/web never defines
// (ShinaThemeProvider is intentionally not mounted here; see the
// Intelligent Onboarding wizard's own note on this). Matching the rest of
// the app IS "parecer parte natural da plataforma Shinã" (spec section
// 11) — introducing a half-styled dark-glass island would read as a
// bolted-on WhatsApp clone, the opposite of what's asked.

import { useCallback, useEffect, useState } from "react";
import { Send, MessageCircle, UserPlus, CheckCircle2, Inbox as InboxIcon } from "lucide-react";

interface ConversationRow {
  id: string;
  status: "open" | "pending" | "closed" | "archived";
  assignedUserId: string | null;
  customerId: string | null;
  contactId: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

interface MessageRow {
  id: string;
  direction: "inbound" | "outbound";
  senderType: string;
  body: string | null;
  type: string;
  status: string;
  createdAt: string;
}

type Filter = "all" | "unassigned" | "mine" | "customers" | "leads" | "closed";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "Todas" },
  { key: "unassigned", label: "Não atribuídas" },
  { key: "mine", label: "Minhas" },
  { key: "customers", label: "Clientes" },
  { key: "leads", label: "Leads" },
  { key: "closed", label: "Encerradas" },
];

function formatDateTime(dt: string | null) {
  if (!dt) return "";
  return new Date(dt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessagingInbox() {
  const [filter, setFilter] = useState<Filter>("all");
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [notEnabled, setNotEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async (f: Filter) => {
    setLoadingList(true);
    try {
      const res = await fetch(`/api/messaging/conversations?filter=${f}`);
      if (res.status === 403) {
        setNotEnabled(true);
        return;
      }
      const json = (await res.json()) as { data?: ConversationRow[] };
      setConversations(json.data ?? []);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadList(filter);
  }, [filter, loadList]);

  const loadThread = useCallback(async (id: string) => {
    setLoadingThread(true);
    setSelectedId(id);
    try {
      const res = await fetch(`/api/messaging/conversations/${id}`);
      const json = (await res.json()) as { data?: { messages: MessageRow[] } };
      setMessages(json.data?.messages ?? []);
    } finally {
      setLoadingThread(false);
    }
  }, []);

  async function handleSend() {
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/messaging/conversations/${selectedId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      });
      const json = (await res.json()) as { data?: { messageId?: string }; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Falha ao enviar");
        return;
      }
      setDraft("");
      await loadThread(selectedId);
    } finally {
      setSending(false);
    }
  }

  async function handleAssignToMe() {
    if (!selectedId) return;
    await fetch(`/api/messaging/conversations/${selectedId}/assign`, { method: "POST" });
    await loadList(filter);
  }

  async function handleClose() {
    if (!selectedId) return;
    await fetch(`/api/messaging/conversations/${selectedId}/close`, { method: "POST" });
    await loadList(filter);
  }

  if (notEnabled) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 flex flex-col items-center justify-center text-center gap-2">
        <InboxIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          A mensageria via WhatsApp ainda não está habilitada para este tenant.
        </p>
      </div>
    );
  }

  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex h-[640px] overflow-hidden">
      {/* left: filters + list */}
      <div className="w-72 shrink-0 border-r border-slate-100 dark:border-slate-800 flex flex-col">
        <div className="flex flex-wrap gap-1 p-2 border-b border-slate-100 dark:border-slate-800">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`px-2 py-1 text-xs rounded-md border-0 cursor-pointer ${
                filter === f.key
                  ? "bg-shina-blue text-white"
                  : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-14 rounded-lg bg-slate-50 dark:bg-slate-800 animate-pulse"
                />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
              Nenhuma conversa nesse filtro.
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => void loadThread(c.id)}
                className={`w-full text-left px-3 py-3 border-b border-slate-50 dark:border-slate-800/60 cursor-pointer ${
                  selectedId === c.id
                    ? "bg-blue-50 dark:bg-slate-800"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {c.customerId ? "Cliente" : c.contactId ? "Contato" : "Desconhecido"}
                  </span>
                  {c.unreadCount > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-shina-blue text-white">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {formatDateTime(c.lastMessageAt)} · {c.status}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* right: thread */}
      <div className="flex-1 flex flex-col">
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-sm gap-2">
            <MessageCircle className="w-8 h-8" />
            Selecione uma conversa
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {selected?.customerId
                  ? "Cliente"
                  : selected?.contactId
                    ? "Contato"
                    : "Desconhecido"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleAssignToMe()}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-0 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Atribuir a mim
                </button>
                <button
                  type="button"
                  onClick={() => void handleClose()}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-0 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Encerrar
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingThread ? (
                <div className="h-full animate-pulse bg-slate-50 dark:bg-slate-800 rounded-lg" />
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
                      m.direction === "outbound"
                        ? "ml-auto bg-shina-blue text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    <p>{m.body ?? `[${m.type}]`}</p>
                    <p
                      className={`text-[10px] mt-1 ${m.direction === "outbound" ? "text-blue-100" : "text-slate-400"}`}
                    >
                      {formatDateTime(m.createdAt)}
                      {m.direction === "outbound" && ` · ${m.status}`}
                    </p>
                  </div>
                ))
              )}
            </div>

            {error && <p className="px-4 pb-1 text-xs text-red-500">{error}</p>}

            <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleSend()}
                placeholder="Escreva uma mensagem..."
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
