"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { InfractionDetail } from "@/components/ui/infraction-detail";
import { Plus, X } from "lucide-react";

interface InfractionCaseRow {
  id: string;
  status: string;
  responsible_party_type: string | null;
  created_at: string;
  infractions: {
    plate: string;
    auto_number: string | null;
    occurred_at: string;
    amount_cents: number | null;
    amount_currency: string;
    authority_name: string | null;
  };
  [key: string]: unknown;
}

const STATUS_LABEL: Record<string, string> = {
  received: "Recebida",
  matching_asset: "Vinculando ativo",
  unmatched: "Sem ativo",
  matched: "Ativo vinculado",
  responsibility_pending: "Responsabilidade pendente",
  responsibility_confirmed: "Responsabilidade confirmada",
  driver_identification_pending: "Indicação pendente",
  driver_identified: "Condutor indicado",
  disputed: "Contestada",
  defense_pending: "Defesa pendente",
  appealed: "Recurso",
  paid: "Paga",
  closed: "Encerrada",
};

function statusToUi(status: string): "active" | "inactive" | "pending" | "warning" | "error" {
  switch (status) {
    case "paid":
    case "closed":
      return "inactive";
    case "responsibility_confirmed":
    case "driver_identified":
      return "active";
    case "disputed":
    case "unmatched":
      return "error";
    case "responsibility_pending":
    case "driver_identification_pending":
    case "defense_pending":
    case "appealed":
      return "warning";
    default:
      return "pending";
  }
}

const FILTERS: { key: string; label: string; status?: string }[] = [
  { key: "all", label: "Todas" },
  { key: "unmatched", label: "Sem ativo", status: "unmatched" },
  {
    key: "responsibility_pending",
    label: "Responsabilidade pendente",
    status: "responsibility_pending",
  },
  { key: "disputed", label: "Contestadas", status: "disputed" },
  { key: "paid", label: "Pagas", status: "paid" },
];

function formatCents(cents: number | null, currency = "BRL"): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

export default function TenantInfractionsPage() {
  const [rows, setRows] = useState<InfractionCaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [plate, setPlate] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (filterKey: string) => {
    setLoading(true);
    try {
      const activeFilter = FILTERS.find((f) => f.key === filterKey);
      const qs = activeFilter?.status ? `?status=${activeFilter.status}` : "";
      const res = await fetch(`/api/infractions${qs}`);
      const json = (await res.json()) as { data?: InfractionCaseRow[] };
      setRows(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      const res = await fetch("/api/infractions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plate,
          occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined,
          amountCents: amount ? Math.round(Number(amount) * 100) : undefined,
          description: description || undefined,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        data?: { caseId: string; deduplicated: boolean };
      };
      if (!res.ok) throw new Error(json.error ?? "Falha ao lançar infração.");
      setShowForm(false);
      setPlate("");
      setOccurredAt("");
      setAmount("");
      setDescription("");
      await load(filter);
      if (json.data?.caseId) setSelectedId(json.data.caseId);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setCreating(false);
    }
  }

  const columns = [
    {
      key: "plate",
      label: "Placa",
      render: (row: InfractionCaseRow) => row.infractions?.plate ?? "—",
    },
    {
      key: "auto_number",
      label: "Auto",
      render: (row: InfractionCaseRow) => row.infractions?.auto_number ?? "—",
    },
    {
      key: "occurred_at",
      label: "Data",
      render: (row: InfractionCaseRow) =>
        row.infractions?.occurred_at
          ? new Date(row.infractions.occurred_at).toLocaleDateString("pt-BR")
          : "—",
    },
    {
      key: "amount",
      label: "Valor",
      render: (row: InfractionCaseRow) =>
        formatCents(row.infractions?.amount_cents ?? null, row.infractions?.amount_currency),
    },
    {
      key: "status",
      label: "Status",
      render: (row: InfractionCaseRow) => (
        <StatusBadge
          status={statusToUi(row.status)}
          label={STATUS_LABEL[row.status] ?? row.status}
        />
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: InfractionCaseRow) => (
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
    <AppShell title="Infrações">
      <SectionHeader
        title="Infrações"
        description="Multas recebidas, vínculo com ativos/contratos, responsabilidade, prazos e cobrança."
        action={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-shina-blue hover:bg-blue-600 text-white text-xs font-semibold rounded-lg border-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Lançar infração
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

      <DataTable columns={columns} data={rows} loading={loading} />

      {!loading && rows.length === 0 && (
        <p className="text-sm text-slate-500 mt-4 text-center">Nenhuma infração encontrada.</p>
      )}

      <InfractionDetail
        caseId={selectedId}
        onClose={() => setSelectedId(null)}
        onChange={() => void load(filter)}
      />

      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowForm(false)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Lançar infração
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
              <p className="text-xs text-slate-500">
                Lançamento manual — item 33 do escopo (usável antes de qualquer integração oficial).
                Passa pelo mesmo pipeline de dedup/vínculo que uma importação futura.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Placa</label>
                <input
                  required
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  placeholder="ABC1D23"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Data/hora da infração
                </label>
                <input
                  required
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Valor (R$, opcional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Descrição (opcional)
                </label>
                <input
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
                {creating ? "Lançando..." : "Lançar infração"}
              </button>
            </form>
          </div>
        </>
      )}
    </AppShell>
  );
}
