"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ExportButton } from "@/components/ui/export-button";
import { Plus, X } from "lucide-react";
import type { Asset, AssetCategory, AssetStatus } from "@/types/domain";

interface AssetType {
  id: string;
  name: string;
  category: AssetCategory;
}

type AssetRow = Asset & Record<string, unknown>;

const CATEGORY_LABEL: Record<AssetCategory, string> = {
  vehicle: "Veículo",
  equipment: "Equipamento",
  tool: "Ferramenta",
  property: "Imóvel",
  technology: "Tecnologia",
};

const STATUS_LABEL: Record<AssetStatus, string> = {
  available: "Disponível",
  in_use: "Em uso",
  maintenance: "Manutenção",
  decommissioned: "Desativado",
};

const STATUS_OPTIONS: AssetStatus[] = ["available", "in_use", "maintenance", "decommissioned"];

function statusToUi(status: AssetStatus): "active" | "inactive" | "pending" | "warning" {
  switch (status) {
    case "available":
      return "active";
    case "in_use":
      return "pending";
    case "maintenance":
      return "warning";
    case "decommissioned":
      return "inactive";
  }
}

export default function TenantAssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<AssetCategory>("vehicle");
  const [formTypeId, setFormTypeId] = useState("");
  const [formSerial, setFormSerial] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/assets");
      const json = (await res.json()) as { data?: Asset[] };
      setAssets(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openForm() {
    setFormError(null);
    setShowForm(true);
    if (assetTypes.length === 0) {
      const res = await fetch("/api/asset-types");
      const json = (await res.json()) as { data?: AssetType[] };
      setAssetTypes(json.data ?? []);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          category: formCategory,
          asset_type_id: formTypeId,
          serial_number: formSerial || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao criar ativo");
      setShowForm(false);
      setFormName("");
      setFormTypeId("");
      setFormSerial("");
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(status: AssetStatus) {
    if (!selected) return;
    setChangingStatus(true);
    try {
      await fetch(`/api/assets/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setSelected(null);
      await load();
    } finally {
      setChangingStatus(false);
    }
  }

  const columns = [
    { key: "name", label: "Nome" },
    {
      key: "category",
      label: "Categoria",
      render: (row: AssetRow) => CATEGORY_LABEL[row.category],
    },
    { key: "type_name", label: "Tipo", render: (row: AssetRow) => row.type_name ?? "—" },
    {
      key: "serial_number",
      label: "Nº de série",
      render: (row: AssetRow) => row.serial_number ?? "—",
    },
    {
      key: "status",
      label: "Status",
      render: (row: AssetRow) => (
        <StatusBadge status={statusToUi(row.status)} label={STATUS_LABEL[row.status]} />
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: AssetRow) => (
        <button
          type="button"
          onClick={() => setSelected(row)}
          className="text-xs text-shina-blue hover:text-blue-700 font-medium bg-transparent border-0 cursor-pointer p-0"
        >
          Ver detalhes
        </button>
      ),
    },
  ];

  return (
    <AppShell title="Ativos">
      <SectionHeader
        title="Ativos"
        description="Veículos, equipamentos, ferramentas e demais ativos do tenant."
        action={
          <div className="flex items-center gap-2">
            <ExportButton entity="assets" />
            <button
              type="button"
              onClick={() => void openForm()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-shina-blue hover:bg-blue-600 text-white text-xs font-semibold rounded-lg border-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Novo Ativo
            </button>
          </div>
        }
      />

      <DataTable columns={columns} data={assets as AssetRow[]} loading={loading} />

      {!loading && assets.length === 0 && (
        <p className="text-sm text-slate-500 mt-4 text-center">Nenhum ativo cadastrado ainda.</p>
      )}

      {selected && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSelected(null)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Detalhe do Ativo
              </h2>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Nome</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-50">
                    {selected.name}
                  </p>
                </div>
                <StatusBadge
                  status={statusToUi(selected.status)}
                  label={STATUS_LABEL[selected.status]}
                />
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Categoria</span>
                  <span className="font-medium text-slate-900 dark:text-slate-50">
                    {CATEGORY_LABEL[selected.category]}
                  </span>
                </div>
                {selected.type_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Tipo</span>
                    <span className="font-medium text-slate-900 dark:text-slate-50">
                      {selected.type_name}
                    </span>
                  </div>
                )}
                {selected.serial_number && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Nº de série</span>
                    <span className="font-medium text-slate-900 dark:text-slate-50">
                      {selected.serial_number}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {selected.status !== "decommissioned" && (
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 space-y-2">
                <p className="text-xs font-medium text-slate-500 mb-3">Alterar status</p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.filter((s) => s !== selected.status).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={changingStatus}
                      onClick={() => void handleStatusChange(s)}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-60 border-0 cursor-pointer"
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowForm(false)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Novo Ativo
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
                <label className="block text-xs font-medium text-slate-500 mb-1">Categoria</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as AssetCategory)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                <select
                  required
                  value={formTypeId}
                  onChange={(e) => setFormTypeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  <option value="">Selecione...</option>
                  {assetTypes
                    .filter((t) => t.category === formCategory)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Nº de série (opcional)
                </label>
                <input
                  value={formSerial}
                  onChange={(e) => setFormSerial(e.target.value)}
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
                {submitting ? "Criando..." : "Criar ativo"}
              </button>
            </form>
          </div>
        </>
      )}
    </AppShell>
  );
}
