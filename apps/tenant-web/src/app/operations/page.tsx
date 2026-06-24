"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { OperationDetail } from "@/components/ui/operation-detail";
import { ExportButton } from "@/components/ui/export-button";
import { OperationsCalendar } from "@/components/ui/operations-calendar";
import { Zap, User, Plus, LayoutList, CalendarDays } from "lucide-react";
import type { Operation, OperationStatus, OperationType, Resource } from "@/types/domain";

function opStatusToUi(status: OperationStatus): "active" | "inactive" | "pending" | "warning" {
  switch (status) {
    case "in_progress":
      return "active";
    case "pending":
      return "pending";
    case "completed":
      return "inactive";
    case "cancelled":
    case "failed":
      return "warning";
    default:
      return "inactive";
  }
}

function opStatusLabel(status: OperationStatus): string {
  switch (status) {
    case "in_progress":
      return "Em andamento";
    case "pending":
      return "Pendente";
    case "completed":
      return "Concluída";
    case "cancelled":
      return "Cancelada";
    case "failed":
      return "Falhou";
    default:
      return status;
  }
}

function opTypeLabel(type: OperationType): string {
  const labels: Record<OperationType, string> = {
    delivery: "Entrega",
    pickup: "Coleta",
    maintenance: "Manutenção",
    inspection: "Inspeção",
    transfer: "Transferência",
  };
  return labels[type] ?? type;
}

const FILTERS = ["Todas", "Em andamento", "Pendentes", "Concluídas"];

function filterFn(op: Operation, filter: string): boolean {
  if (filter === "Todas") return true;
  if (filter === "Em andamento") return op.status === "in_progress";
  if (filter === "Pendentes") return op.status === "pending";
  if (filter === "Concluídas") return op.status === "completed";
  return true;
}

export default function OperationsPage() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("Todas");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "calendar">("list");

  const [formType, setFormType] = useState<OperationType>("delivery");
  const [formResource, setFormResource] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");

  const fetchOperations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/operations");
      if (!res.ok) throw new Error("Falha ao carregar operações");
      const json = (await res.json()) as { data: Operation[] };
      setOperations(json.data ?? []);
    } catch {
      // keep empty state
    } finally {
      setLoading(false);
    }
  }, []);

  async function fetchResources() {
    try {
      const res = await fetch("/api/resources");
      if (!res.ok) return;
      const json = (await res.json()) as { data: Resource[] };
      setResources(json.data ?? []);
    } catch {
      // keep empty
    }
  }

  useEffect(() => {
    void fetchOperations();
    void fetchResources();
  }, [fetchOperations]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formType,
          resource_id: formResource,
          scheduled_starts_at: new Date(formStart).toISOString(),
          scheduled_ends_at: new Date(formEnd).toISOString(),
        }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Falha ao criar operação");
      }
      setShowForm(false);
      setFormType("delivery");
      setFormResource("");
      setFormStart("");
      setFormEnd("");
      await fetchOperations();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao criar operação");
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = operations.filter((op) => filterFn(op, activeFilter));

  return (
    <AppShell title="Operações">
      <SectionHeader
        title="Operações"
        description="Gestão em tempo real de todas as operações logísticas."
        action={
          !showForm ? (
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setView("list")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${view === "list" ? "bg-white shadow-sm text-slate-900 font-medium" : "text-slate-500 hover:text-slate-700"}`}
                >
                  <LayoutList className="w-4 h-4" />
                  Lista
                </button>
                <button
                  onClick={() => setView("calendar")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${view === "calendar" ? "bg-white shadow-sm text-slate-900 font-medium" : "text-slate-500 hover:text-slate-700"}`}
                >
                  <CalendarDays className="w-4 h-4" />
                  Calendário
                </button>
              </div>
              <ExportButton entity="operations" />
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-shina-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors cursor-pointer border-0"
              >
                <Plus className="w-4 h-4" />
                Nova Operação
              </button>
            </div>
          ) : undefined
        }
      />

      {showForm && (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm"
        >
          <h3 className="text-base font-semibold text-slate-900 mb-4">Nova Operação</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Tipo <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formType}
                onChange={(e) => setFormType(e.target.value as OperationType)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue bg-white"
              >
                <option value="delivery">Entrega</option>
                <option value="pickup">Coleta</option>
                <option value="maintenance">Manutenção</option>
                <option value="inspection">Inspeção</option>
                <option value="transfer">Transferência</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Recurso <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formResource}
                onChange={(e) => setFormResource(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue bg-white"
              >
                <option value="">Selecione um recurso</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Data início <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={formStart}
                onChange={(e) => setFormStart(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Data fim <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={formEnd}
                onChange={(e) => setFormEnd(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-shina-blue text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors cursor-pointer border-0"
            >
              {submitting ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-slate-600 rounded-lg text-sm bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer border-0"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {view === "list" ? (
        <>
          {/* Filter pills */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer border ${
                  activeFilter === f
                    ? "bg-shina-blue text-white border-shina-blue"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 animate-pulse"
                >
                  <div className="h-4 bg-slate-100 rounded mb-3 w-3/4" />
                  <div className="h-3 bg-slate-100 rounded mb-2 w-1/2" />
                  <div className="h-3 bg-slate-100 rounded mb-2 w-2/3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.length === 0 ? (
                <p className="text-slate-400 text-sm col-span-3 py-8 text-center">
                  Nenhuma operação encontrada.
                </p>
              ) : (
                filtered.map((op) => (
                  <div
                    key={op.id}
                    className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-xs font-mono text-slate-400 mb-0.5">
                          {op.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          {opTypeLabel(op.type)}
                        </p>
                      </div>
                      <StatusBadge
                        status={opStatusToUi(op.status)}
                        label={opStatusLabel(op.status)}
                      />
                    </div>

                    <div className="space-y-2 mb-4">
                      {op.resource_name && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{op.resource_name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Zap className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          Início:{" "}
                          {new Date(op.scheduled_starts_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                      <span className="text-xs text-slate-400">
                        Fim:{" "}
                        {new Date(op.scheduled_ends_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <button
                        onClick={() => setSelectedOpId(op.id)}
                        className="text-xs font-medium text-shina-blue hover:text-blue-700 transition-colors"
                      >
                        Detalhes →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      ) : (
        <OperationsCalendar onSelectOperation={(id) => setSelectedOpId(id)} />
      )}

      <OperationDetail
        operationId={selectedOpId}
        onClose={() => setSelectedOpId(null)}
        onStatusChange={() => {
          setSelectedOpId(null);
          void fetchOperations();
        }}
      />
    </AppShell>
  );
}
