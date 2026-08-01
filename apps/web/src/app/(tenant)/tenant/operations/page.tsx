"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { OperationDetail } from "@/components/ui/operation-detail";
import { OperationsCalendar } from "@/components/ui/operations-calendar";
import { ExportButton } from "@/components/ui/export-button";
import { List, Calendar, Plus, X } from "lucide-react";
import type { Operation, OperationStatus, OperationType } from "@/types/domain";

interface ResourceOption {
  id: string;
  name: string;
  type: string;
  status: string;
}

type OperationRow = Operation & Record<string, unknown>;

const TYPE_LABEL: Record<OperationType, string> = {
  delivery: "Entrega",
  pickup: "Coleta",
  maintenance: "Manutenção",
  inspection: "Inspeção",
  transfer: "Transferência",
};

const STATUS_LABEL: Record<OperationStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
  failed: "Falhou",
};

function statusToUi(
  status: OperationStatus,
): "active" | "inactive" | "pending" | "warning" | "error" {
  switch (status) {
    case "in_progress":
      return "active";
    case "completed":
      return "inactive";
    case "cancelled":
    case "failed":
      return "error";
    default:
      return "pending";
  }
}

export default function TenantOperationsPage() {
  const [view, setView] = useState<"list" | "calendar">("list");
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formType, setFormType] = useState<OperationType>("delivery");
  const [formResourceId, setFormResourceId] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");

  const loadOperations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/operations");
      const json = (await res.json()) as { data?: Operation[] };
      setOperations(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOperations();
  }, [loadOperations]);

  async function openForm() {
    setFormError(null);
    setShowForm(true);
    if (resources.length === 0) {
      const res = await fetch("/api/resources");
      const json = (await res.json()) as { data?: ResourceOption[] };
      setResources(json.data ?? []);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formType,
          resource_id: formResourceId,
          scheduled_starts_at: formStart ? new Date(formStart).toISOString() : undefined,
          scheduled_ends_at: formEnd ? new Date(formEnd).toISOString() : undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao criar operação");
      setShowForm(false);
      setFormResourceId("");
      setFormStart("");
      setFormEnd("");
      await loadOperations();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  const columns = [
    {
      key: "type",
      label: "Tipo",
      render: (row: OperationRow) => TYPE_LABEL[row.type] ?? row.type,
    },
    {
      key: "resource",
      label: "Recurso",
      render: (row: OperationRow) => row.resource_name ?? "—",
    },
    {
      key: "status",
      label: "Status",
      render: (row: OperationRow) => (
        <StatusBadge status={statusToUi(row.status)} label={STATUS_LABEL[row.status]} />
      ),
    },
    {
      key: "scheduled_starts_at",
      label: "Agendada para",
      render: (row: OperationRow) =>
        new Date(row.scheduled_starts_at).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
    {
      key: "actions",
      label: "",
      render: (row: OperationRow) => (
        <button
          type="button"
          onClick={() => setSelectedId(row.id)}
          className="text-xs text-shina-blue hover:text-blue-700 font-medium bg-transparent border-0 cursor-pointer p-0"
        >
          Ver detalhes
        </button>
      ),
    },
  ];

  return (
    <AppShell title="Operações">
      <SectionHeader
        title="Operações"
        description="Entregas, coletas, manutenções e demais operações agendadas."
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setView("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-0 cursor-pointer ${
                  view === "list"
                    ? "bg-shina-blue text-white"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                <List className="w-3.5 h-3.5" /> Lista
              </button>
              <button
                type="button"
                onClick={() => setView("calendar")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-0 cursor-pointer ${
                  view === "calendar"
                    ? "bg-shina-blue text-white"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> Calendário
              </button>
            </div>
            <ExportButton entity="operations" />
            <button
              type="button"
              onClick={() => void openForm()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-shina-blue hover:bg-blue-600 text-white text-xs font-semibold rounded-lg border-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Nova Operação
            </button>
          </div>
        }
      />

      {view === "list" ? (
        <DataTable columns={columns} data={operations as OperationRow[]} loading={loading} />
      ) : (
        <OperationsCalendar onSelectOperation={(id) => setSelectedId(id)} />
      )}

      {!loading && view === "list" && operations.length === 0 && (
        <p className="text-sm text-slate-500 mt-4 text-center">Nenhuma operação ainda.</p>
      )}

      <OperationDetail
        operationId={selectedId}
        onClose={() => setSelectedId(null)}
        onStatusChange={() => void loadOperations()}
      />

      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowForm(false)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Nova Operação
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleCreate(e)}
              className="flex-1 overflow-y-auto px-6 py-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as OperationType)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  {Object.entries(TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Recurso</label>
                <select
                  required
                  value={formResourceId}
                  onChange={(e) => setFormResourceId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  <option value="">Selecione...</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Início previsto
                </label>
                <input
                  required
                  type="datetime-local"
                  value={formStart}
                  onChange={(e) => setFormStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Fim previsto
                </label>
                <input
                  required
                  type="datetime-local"
                  value={formEnd}
                  onChange={(e) => setFormEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              {formError && (
                <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-4 py-2.5 bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer"
              >
                {submitting ? "Criando..." : "Criar operação"}
              </button>
            </form>
          </div>
        </>
      )}
    </AppShell>
  );
}
