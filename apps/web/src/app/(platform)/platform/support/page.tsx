"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { ShieldAlert, RefreshCw } from "lucide-react";

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

export default function PlatformSupportPage() {
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
    <AppShell title="Suporte">
      <SectionHeader
        title="Auditoria de Personificação"
        description="Histórico de acessos de suporte (impersonação) a tenants."
      />

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
                  <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {s.tenant_name}
                  </td>
                  <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{s.actor_email}</td>
                  <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                    {s.target_user_name ?? s.target_user_email ?? "—"}
                  </td>
                  <td className="px-6 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                    {s.reason}
                  </td>
                  <td className="px-6 py-3 text-slate-500 dark:text-slate-400">
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
        )}
      </div>
    </AppShell>
  );
}
