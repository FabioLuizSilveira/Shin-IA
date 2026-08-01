"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ExportButton } from "@/components/ui/export-button";
import { Plus, X } from "lucide-react";

type ResourceType = "human" | "vehicle" | "equipment" | "virtual";
type ResourceStatus = "available" | "busy" | "offline" | "suspended";

interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  status: ResourceStatus;
  created_at: string;
}

type ResourceRow = Resource & Record<string, unknown>;

const TYPE_LABEL: Record<ResourceType, string> = {
  human: "Motorista/Operador",
  vehicle: "Veículo",
  equipment: "Equipamento",
  virtual: "Virtual",
};

const STATUS_LABEL: Record<ResourceStatus, string> = {
  available: "Disponível",
  busy: "Ocupado",
  offline: "Offline",
  suspended: "Suspenso",
};

const STATUS_OPTIONS: ResourceStatus[] = ["available", "busy", "offline", "suspended"];

function statusToUi(status: ResourceStatus): "active" | "inactive" | "pending" | "warning" {
  switch (status) {
    case "available":
      return "active";
    case "busy":
      return "pending";
    case "offline":
      return "inactive";
    case "suspended":
      return "warning";
  }
}

export default function TenantResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingId, setChangingId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<ResourceType>("vehicle");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/resources");
      const json = (await res.json()) as { data?: Resource[] };
      setResources(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, type: formType }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao criar recurso");
      setShowForm(false);
      setFormName("");
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id: string, status: ResourceStatus) {
    setChangingId(id);
    try {
      await fetch(`/api/resources/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await load();
    } finally {
      setChangingId(null);
    }
  }

  const columns = [
    { key: "name", label: "Nome" },
    {
      key: "type",
      label: "Tipo",
      render: (row: ResourceRow) => TYPE_LABEL[row.type],
    },
    {
      key: "status",
      label: "Status",
      render: (row: ResourceRow) => (
        <StatusBadge status={statusToUi(row.status)} label={STATUS_LABEL[row.status]} />
      ),
    },
    {
      key: "actions",
      label: "Alterar status",
      render: (row: ResourceRow) => (
        <select
          value={row.status}
          disabled={changingId === row.id}
          onChange={(e) => void handleStatusChange(row.id, e.target.value as ResourceStatus)}
          className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs disabled:opacity-60"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      ),
    },
  ];

  return (
    <AppShell title="Recursos">
      <SectionHeader
        title="Recursos da Frota"
        description="Motoristas, veículos, equipamentos e recursos virtuais do tenant."
        action={
          <div className="flex items-center gap-2">
            <ExportButton entity="resources" />
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-shina-blue hover:bg-blue-600 text-white text-xs font-semibold rounded-lg border-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Novo Recurso
            </button>
          </div>
        }
      />

      <DataTable columns={columns} data={resources as ResourceRow[]} loading={loading} />

      {!loading && resources.length === 0 && (
        <p className="text-sm text-slate-500 mt-4 text-center">Nenhum recurso cadastrado ainda.</p>
      )}

      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowForm(false)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Novo Recurso
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
                <label className="block text-xs font-medium text-slate-500 mb-1">Nome</label>
                <input
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as ResourceType)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  {Object.entries(TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
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
                {submitting ? "Criando..." : "Criar recurso"}
              </button>
            </form>
          </div>
        </>
      )}
    </AppShell>
  );
}
