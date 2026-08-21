"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Bot, User } from "lucide-react";

// Real data, not a decorative bell: mkt's "notifications" are the pending
// drafts already surfaced on /approvals (draft-first — every AI action
// waits for human approval, see docs/... M-MKT-05). No separate
// notifications table/pipeline exists for mkt (unlike apps/web's), so this
// reuses the same GET /api/drafts?status=pending the Approvals page already
// calls, instead of inventing a second notification system for one bell.
interface Draft {
  id: string;
  entity_type: string;
  action: string;
  agent_id: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  create: "Criar",
  update: "Atualizar",
  delete: "Excluir",
  publish: "Publicar",
  pause: "Pausar",
  budget_change: "Alterar orçamento",
};

const ENTITY_LABELS: Record<string, string> = {
  campaign: "campanha",
  generated_ad: "anúncio gerado",
  cloned_ad: "anúncio clonado",
  brand_kit: "brand kit",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  return `${Math.floor(hrs / 24)}d atrás`;
}

export function MktNotificationBell() {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/drafts?status=pending")
      .then((r) => r.json() as Promise<{ data?: Draft[] }>)
      .then((json) => {
        if (!cancelled) setDrafts(json.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setDrafts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const count = drafts.length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors bg-transparent border-0 cursor-pointer",
          count > 0
            ? "text-mkt-glow"
            : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5",
        ].join(" ")}
        title="Aprovações pendentes"
      >
        <Bell className="w-4 h-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Aprovações pendentes
            </h3>
            {count > 0 && (
              <span className="text-xs text-slate-500 dark:text-slate-400">{count}</span>
            )}
          </div>
          <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-50 dark:divide-white/5">
            {drafts.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Nenhuma aprovação pendente
                </p>
              </div>
            ) : (
              drafts.slice(0, 8).map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setOpen(false);
                    router.push("/approvals");
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex gap-3"
                >
                  <div className="mt-0.5 shrink-0 text-mkt-glow">
                    {d.agent_id ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {ACTION_LABELS[d.action] ?? d.action}{" "}
                      {ENTITY_LABELS[d.entity_type] ?? d.entity_type}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {timeAgo(d.created_at)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
          {drafts.length > 0 && (
            <button
              onClick={() => {
                setOpen(false);
                router.push("/approvals");
              }}
              className="w-full text-center py-2.5 text-xs font-medium text-mkt-glow hover:bg-slate-50 dark:hover:bg-white/5 border-t border-slate-100 dark:border-white/5 bg-transparent cursor-pointer"
            >
              Ver todas em Aprovações
            </button>
          )}
        </div>
      )}
    </div>
  );
}
