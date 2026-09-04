"use client";

// Same hand-rolled drawer chrome as contract-send-signature-modal.tsx
// (this app's real convention for a side panel — @shina/design-system's
// own Drawer component has zero consumers anywhere in apps/web today,
// confirmed by grep before building this; not worth being the first
// integration point for it). useToast() IS real and globally mounted
// (apps/web/src/app/layout.tsx wraps the app in ToastProvider), so error
// feedback goes through it as normal.

import { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles } from "lucide-react";
import { useToast } from "@shina/design-system";

interface ShinaMessage {
  role: "user" | "assistant";
  text: string;
}

interface AgentApiResponse {
  data?: { text: string; toolsUsed: string[]; creditsConsumed: number };
  error?: string;
  code?: string;
}

interface ShinaDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Best-effort context for the agent — omitted (null) when this app
   * doesn't yet resolve a "current module" label at the call site; both
   * fields are optional on the backend. */
  currentModule?: string | null;
  currentResource?: { type: string; id: string } | null;
}

export function ShinaDrawer({ open, onClose, currentModule, currentResource }: ShinaDrawerProps) {
  const { show } = useToast();
  const [messages, setMessages] = useState<ShinaMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  if (!open) return null;

  async function send() {
    const query = input.trim();
    if (!query || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: query }]);
    setSending(true);

    try {
      const res = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, currentModule, currentResource }),
      });
      const json = (await res.json().catch(() => ({}))) as AgentApiResponse;

      if (!res.ok || json.error) {
        const message =
          res.status === 403
            ? "Shinã ainda não está habilitada para este workspace."
            : json.code === "insufficient_credits"
              ? "Créditos de IA esgotados. Fale com o administrador do workspace."
              : json.code === "duplicate_request"
                ? "Solicitação duplicada, tente novamente."
                : (json.error ?? "Shinã não conseguiu responder agora. Tente novamente.");
        show({
          message,
          variant: res.status === 403 ? "info" : res.status === 402 ? "warning" : "danger",
        });
        return;
      }

      setMessages((m) => [...m, { role: "assistant", text: json.data?.text ?? "" }]);
    } catch {
      show({ message: "Shinã não conseguiu responder agora. Tente novamente.", variant: "danger" });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            Shinã
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border-0 bg-transparent cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-sm text-slate-400 text-center mt-8">
              Pergunte à Shinã sobre contratos, ativos, ou o que essa tela faz.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-shina-blue text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 px-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 dark:border-slate-700 p-4 flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Pergunte à Shinã…"
            rows={2}
            className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-shina-blue/30"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || !input.trim()}
            className="p-2.5 rounded-lg bg-shina-blue hover:bg-blue-600 text-white disabled:opacity-60 cursor-pointer border-0 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
