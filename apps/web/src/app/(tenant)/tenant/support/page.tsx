"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { Send, MessageSquare } from "lucide-react";

interface SupportMessage {
  id: string;
  sender_role: "tenant" | "platform";
  body: string;
  created_at: string;
}

function formatDateTime(dt: string) {
  return new Date(dt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TenantSupportPage() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/support-messages");
    const json = (await res.json()) as { data?: SupportMessage[] };
    setMessages(json.data ?? []);
    setLoading(false);
    await fetch("/api/support-messages", { method: "PATCH" });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/support-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      });
      const json = (await res.json()) as { data?: SupportMessage };
      if (json.data) setMessages((prev) => [...prev, json.data as SupportMessage]);
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell title="Suporte">
      <SectionHeader title="Suporte" description="Fale diretamente com a equipe Shinã." />

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col h-[520px] max-w-2xl">
        {loading ? (
          <div className="flex-1 animate-pulse bg-slate-50 dark:bg-slate-800" />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-sm gap-2">
                  <MessageSquare className="w-8 h-8" />
                  Envie uma mensagem para o suporte da Shinã
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
                      m.sender_role === "tenant"
                        ? "ml-auto bg-shina-blue text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    <p>{m.body}</p>
                    <p
                      className={`text-[10px] mt-1 ${m.sender_role === "tenant" ? "text-blue-100" : "text-slate-400"}`}
                    >
                      {formatDateTime(m.created_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleSend()}
                placeholder="Escreva sua mensagem..."
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
    </AppShell>
  );
}
