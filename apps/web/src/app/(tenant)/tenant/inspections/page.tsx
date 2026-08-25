"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { InspectionDetail } from "@/components/ui/inspection-detail";
import { Settings2, Plus, X } from "lucide-react";
import type { InspectionPurpose, InspectionStatus, InspectionType } from "@shina/inspection-engine";

interface AssetOption {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface InspectionRow {
  id: string;
  asset_id: string;
  type: InspectionType;
  status: InspectionStatus;
  contract_id: string | null;
  created_at: string;
  completed_at: string | null;
  [key: string]: unknown;
}

const TYPE_LABEL: Record<InspectionType, string> = {
  pre_delivery: "Pré-entrega",
  check_in: "Check-in",
  check_out: "Check-out",
  return: "Retorno",
  periodic: "Periódica",
  maintenance: "Manutenção",
  damage: "Avaria",
  custom: "Personalizada",
};

const STATUS_LABEL: Record<InspectionStatus, string> = {
  draft: "Rascunho",
  in_progress: "Em andamento",
  pending_review: "Aguardando revisão",
  completed: "Concluída",
  rejected: "Reprovada",
  abandoned: "Abandonada",
};

function statusToUi(
  status: InspectionStatus,
): "active" | "inactive" | "pending" | "warning" | "error" {
  switch (status) {
    case "in_progress":
      return "active";
    case "pending_review":
      return "warning";
    case "completed":
      return "inactive";
    case "rejected":
    case "abandoned":
      return "error";
    default:
      return "pending";
  }
}

const FILTERS: { key: string; label: string; status?: InspectionStatus }[] = [
  { key: "all", label: "Todas" },
  { key: "pending_review", label: "Aguardando revisão", status: "pending_review" },
  { key: "in_progress", label: "Em andamento", status: "in_progress" },
  { key: "completed", label: "Concluídas", status: "completed" },
];

export default function TenantInspectionsPage() {
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [formAssetId, setFormAssetId] = useState("");
  const [formType, setFormType] = useState<InspectionType>("check_in");
  const [formPurpose, setFormPurpose] = useState<InspectionPurpose>("check_in");
  const [formBlueprintId, setFormBlueprintId] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (filterKey: string) => {
    setLoading(true);
    try {
      const activeFilter = FILTERS.find((f) => f.key === filterKey);
      const qs = activeFilter?.status ? `?status=${activeFilter.status}` : "";
      const res = await fetch(`/api/inspections${qs}`);
      const json = (await res.json()) as { data?: InspectionRow[] };
      setInspections(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  async function openForm() {
    setFormError(null);
    setShowForm(true);
    if (assets.length === 0) {
      const res = await fetch("/api/assets");
      const json = (await res.json()) as { data?: AssetOption[] };
      setAssets(json.data ?? []);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      const res = await fetch("/api/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: formAssetId,
          type: formType,
          purpose: formPurpose,
          blueprintId: formBlueprintId || undefined,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        message?: string;
        data?: { id: string };
      };
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Falha ao criar vistoria.");
      setShowForm(false);
      setFormAssetId("");
      setFormBlueprintId("");
      await load(filter);
      if (json.data) setSelectedId(json.data.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setCreating(false);
    }
  }

  const columns = [
    {
      key: "type",
      label: "Tipo",
      render: (row: InspectionRow) => TYPE_LABEL[row.type] ?? row.type,
    },
    {
      key: "status",
      label: "Status",
      render: (row: InspectionRow) => (
        <StatusBadge status={statusToUi(row.status)} label={STATUS_LABEL[row.status]} />
      ),
    },
    {
      key: "created_at",
      label: "Criada em",
      render: (row: InspectionRow) => new Date(row.created_at).toLocaleDateString("pt-BR"),
    },
    {
      key: "completed_at",
      label: "Concluída em",
      render: (row: InspectionRow) =>
        row.completed_at ? new Date(row.completed_at).toLocaleDateString("pt-BR") : "—",
    },
    {
      key: "actions",
      label: "",
      render: (row: InspectionRow) => (
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
    <AppShell title="Vistorias">
      <SectionHeader
        title="Vistorias"
        description="Vistorias digitais de check-in, check-out e periódicas dos seus ativos."
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/tenant/inspections/templates"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg no-underline"
            >
              <Settings2 className="w-3.5 h-3.5" /> Templates
            </Link>
            <button
              type="button"
              onClick={() => void openForm()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-shina-blue hover:bg-blue-600 text-white text-xs font-semibold rounded-lg border-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Nova Vistoria
            </button>
          </div>
        }
      />

      <div className="flex items-center gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border-0 cursor-pointer transition-colors ${
              filter === f.key
                ? "bg-shina-blue text-white"
                : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <DataTable columns={columns} data={inspections} loading={loading} />

      {!loading && inspections.length === 0 && (
        <p className="text-sm text-slate-500 mt-4 text-center">Nenhuma vistoria encontrada.</p>
      )}

      <InspectionDetail
        inspectionId={selectedId}
        onClose={() => setSelectedId(null)}
        onChange={() => void load(filter)}
      />

      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowForm(false)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Nova Vistoria
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
                <label className="block text-xs font-medium text-slate-500 mb-1">Ativo</label>
                <select
                  required
                  value={formAssetId}
                  onChange={(e) => setFormAssetId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="">Selecione...</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as InspectionType)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                >
                  {Object.entries(TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Propósito (checklist)
                </label>
                <select
                  value={formPurpose}
                  onChange={(e) => setFormPurpose(e.target.value as InspectionPurpose)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="check_in">Check-in</option>
                  <option value="check_out">Check-out</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Blueprint (opcional — só se o ativo não tiver um associado)
                </label>
                <input
                  placeholder="ex: rental-cars"
                  value={formBlueprintId}
                  onChange={(e) => setFormBlueprintId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              {formError && (
                <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={creating}
                className="w-full px-4 py-2.5 bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer"
              >
                {creating ? "Criando..." : "Criar vistoria"}
              </button>
            </form>
          </div>
        </>
      )}
    </AppShell>
  );
}
