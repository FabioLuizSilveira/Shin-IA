"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ServiceRequest {
  id: string;
  type: "extension" | "issue";
  message: string;
  status: "pending" | "approved" | "rejected" | "resolved";
  review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  contracts: { id: string; organization_id: string; organizations: { name: string } | null } | null;
  rental_customers: { id: string; email: string | null; full_name: string | null } | null;
}

const TYPE_LABEL: Record<string, string> = {
  extension: "Prorrogação",
  issue: "Problema",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  resolved: "Resolvido",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  resolved: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
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

export default function CustomerRequestsPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [onlyPending, setOnlyPending] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/service-requests");
      const json = (await res.json()) as { data?: ServiceRequest[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar pedidos");
      setRequests(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleReview(id: string, status: "approved" | "rejected" | "resolved") {
    setReviewingId(id);
    try {
      await fetch(`/api/service-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await load();
    } finally {
      setReviewingId(null);
    }
  }

  const visible = onlyPending ? requests.filter((r) => r.status === "pending") : requests;

  return (
    <AppShell title="Pedidos de Clientes">
      <SectionHeader
        title="Pedidos de Clientes"
        description="Prorrogações e problemas reportados por clientes finais via app mobile."
      />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyPending(true)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border-0 cursor-pointer ${
              onlyPending
                ? "bg-shina-blue text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            }`}
          >
            Pendentes ({requests.filter((r) => r.status === "pending").length})
          </button>
          <button
            type="button"
            onClick={() => setOnlyPending(false)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border-0 cursor-pointer ${
              !onlyPending
                ? "bg-shina-blue text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            }`}
          >
            Todos ({requests.length})
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
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="h-64 animate-pulse bg-slate-50 dark:bg-slate-800" />
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
            Nenhum pedido registrado.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Cliente</th>
                <th className="px-6 py-3 text-left font-medium">Organização</th>
                <th className="px-6 py-3 text-left font-medium">Tipo</th>
                <th className="px-6 py-3 text-left font-medium">Mensagem</th>
                <th className="px-6 py-3 text-left font-medium">Status</th>
                <th className="px-6 py-3 text-left font-medium">Criado em</th>
                <th className="px-6 py-3 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {visible.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {r.rental_customers?.full_name || r.rental_customers?.email || "—"}
                  </td>
                  <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                    {r.contracts?.organizations?.name ?? "—"}
                  </td>
                  <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                    {TYPE_LABEL[r.type] ?? r.type}
                  </td>
                  <td className="px-6 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                    {r.message}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[r.status]}`}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {formatDateTime(r.created_at)}
                  </td>
                  <td className="px-6 py-3">
                    {r.status === "pending" && (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void handleReview(r.id, "approved")}
                          disabled={reviewingId === r.id}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-transparent border-0 cursor-pointer disabled:opacity-60"
                        >
                          Aprovar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleReview(r.id, "rejected")}
                          disabled={reviewingId === r.id}
                          className="text-xs font-semibold text-red-600 hover:text-red-700 bg-transparent border-0 cursor-pointer disabled:opacity-60"
                        >
                          Rejeitar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleReview(r.id, "resolved")}
                          disabled={reviewingId === r.id}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-800 bg-transparent border-0 cursor-pointer disabled:opacity-60"
                        >
                          Resolver
                        </button>
                      </div>
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
