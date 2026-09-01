"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { MaintenanceOrderDetail } from "@/components/ui/maintenance-order-detail";
import { Plus, X } from "lucide-react";
import type { MaintenanceOrderType, MaintenanceOrderStatus } from "@shina/maintenance-engine";

interface OrderRow {
  id: string;
  type: MaintenanceOrderType;
  status: MaintenanceOrderStatus;
  opened_at: string;
  total_cost_cents: number;
  description: string;
  assets: { id: string; name: string; category: string } | null;
  organizations: { id: string; name: string } | null;
  [key: string]: unknown;
}

interface AssetOption {
  id: string;
  name: string;
}

const TYPE_LABEL: Record<MaintenanceOrderType, string> = {
  preventive: "Preventiva",
  corrective: "Corretiva",
  predictive: "Preditiva",
  inspection_generated: "Gerada por vistoria",
  emergency: "Emergencial",
};

const STATUS_LABEL: Record<MaintenanceOrderStatus, string> = {
  scheduled: "Agendada",
  awaiting_approval: "Aguardando aprovação",
  approved: "Aprovada",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
};

function statusToUi(
  status: MaintenanceOrderStatus,
): "active" | "inactive" | "pending" | "warning" | "error" {
  switch (status) {
    case "completed":
      return "inactive";
    case "in_progress":
      return "active";
    case "cancelled":
      return "error";
    case "awaiting_approval":
      return "warning";
    default:
      return "pending";
  }
}

const FILTERS: { key: string; label: string; status?: MaintenanceOrderStatus }[] = [
  { key: "all", label: "Todas" },
  { key: "scheduled", label: "Agendadas", status: "scheduled" },
  { key: "awaiting_approval", label: "Aguardando aprovação", status: "awaiting_approval" },
  { key: "in_progress", label: "Em andamento", status: "in_progress" },
  { key: "completed", label: "Concluídas", status: "completed" },
];

function formatCents(cents: number | null): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function TenantMaintenancePage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [assetId, setAssetId] = useState("");
  const [type, setType] = useState<MaintenanceOrderType>("preventive");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (filterKey: string) => {
    setLoading(true);
    try {
      const activeFilter = FILTERS.find((f) => f.key === filterKey);
      const qs = activeFilter?.status ? `?status=${activeFilter.status}` : "";
      const res = await fetch(`/api/maintenance${qs}`);
      const json = (await res.json()) as { data?: OrderRow[] };
      setOrders(json.data ?? []);
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
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, type, description }),
      });
      const json = (await res.json()) as { error?: string; data?: { id: string } };
      if (!res.ok) throw new Error(json.error ?? "Falha ao criar ordem de manutenção.");
      setShowForm(false);
      setAssetId("");
      setDescription("");
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
      key: "asset",
      label: "Ativo",
      render: (row: OrderRow) => row.assets?.name ?? "—",
    },
    {
      key: "type",
      label: "Tipo",
      render: (row: OrderRow) => TYPE_LABEL[row.type] ?? row.type,
    },
    {
      key: "supplier",
      label: "Fornecedor",
      render: (row: OrderRow) => row.organizations?.name ?? "—",
    },
    {
      key: "opened_at",
      label: "Aberta em",
      render: (row: OrderRow) => new Date(row.opened_at).toLocaleDateString("pt-BR"),
    },
    {
      key: "total_cost_cents",
      label: "Custo total",
      render: (row: OrderRow) => formatCents(row.total_cost_cents),
    },
    {
      key: "status",
      label: "Status",
      render: (row: OrderRow) => (
        <StatusBadge status={statusToUi(row.status)} label={STATUS_LABEL[row.status]} />
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: OrderRow) => (
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
    <AppShell title="Manutenção">
      <SectionHeader
        title="Manutenção"
        description="Ordens de manutenção, custos, preventivas e histórico por ativo."
        action={
          <button
            type="button"
            onClick={() => void openForm()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-shina-blue hover:bg-blue-600 text-white text-xs font-semibold rounded-lg border-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Nova Ordem
          </button>
        }
      />

      <div className="flex items-center gap-2 mb-4 flex-wrap">
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

      <DataTable columns={columns} data={orders} loading={loading} />

      {!loading && orders.length === 0 && (
        <p className="text-sm text-slate-500 mt-4 text-center">
          Nenhuma ordem de manutenção encontrada.
        </p>
      )}

      <MaintenanceOrderDetail
        orderId={selectedId}
        onClose={() => setSelectedId(null)}
        onChange={() => void load(filter)}
      />

      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowForm(false)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Nova Ordem de Manutenção
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
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
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
                  value={type}
                  onChange={(e) => setType(e.target.value as MaintenanceOrderType)}
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
                <label className="block text-xs font-medium text-slate-500 mb-1">Descrição</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
                {creating ? "Criando..." : "Criar ordem"}
              </button>
            </form>
          </div>
        </>
      )}
    </AppShell>
  );
}
