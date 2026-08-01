"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ContractDetail } from "@/components/ui/contract-detail";
import { ExportButton } from "@/components/ui/export-button";
import { Plus, X } from "lucide-react";
import type { Contract, ContractStatus, ContractType, OrganizationType } from "@/types/domain";

interface OrganizationOption {
  id: string;
  name: string;
  type: OrganizationType;
}

type ContractRow = Contract & Record<string, unknown>;

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const TYPE_LABEL: Record<ContractType, string> = {
  service: "Serviço",
  rental: "Locação",
  lease: "Arrendamento",
  subscription: "Assinatura",
  one_time: "Avulso",
};

const STATUS_LABEL: Record<ContractStatus, string> = {
  draft: "Rascunho",
  active: "Ativo",
  expired: "Expirado",
  terminated: "Rescindido",
  suspended: "Suspenso",
};

function statusToUi(status: ContractStatus): "active" | "inactive" | "pending" | "warning" {
  switch (status) {
    case "active":
      return "active";
    case "draft":
      return "pending";
    case "suspended":
      return "warning";
    default:
      return "inactive";
  }
}

export default function TenantContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formType, setFormType] = useState<ContractType>("service");
  const [formOrgId, setFormOrgId] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contracts");
      const json = (await res.json()) as { data?: Contract[] };
      setContracts(json.data ?? []);
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
    if (organizations.length === 0) {
      const res = await fetch("/api/organizations?activeOnly=1");
      const json = (await res.json()) as { data?: OrganizationOption[] };
      setOrganizations(json.data ?? []);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formType,
          organization_id: formOrgId,
          value_amount: Number(formValue),
          period_starts_at: formStart ? new Date(formStart).toISOString() : undefined,
          period_ends_at: formEnd ? new Date(formEnd).toISOString() : undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao criar contrato");
      setShowForm(false);
      setFormOrgId("");
      setFormValue("");
      setFormStart("");
      setFormEnd("");
      await load();
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
      render: (row: ContractRow) => TYPE_LABEL[row.type] ?? row.type,
    },
    {
      key: "organization_name",
      label: "Organização",
      render: (row: ContractRow) => row.organization_name ?? "—",
    },
    {
      key: "status",
      label: "Status",
      render: (row: ContractRow) => (
        <StatusBadge status={statusToUi(row.status)} label={STATUS_LABEL[row.status]} />
      ),
    },
    {
      key: "value_amount",
      label: "Valor",
      render: (row: ContractRow) => brl(Number(row.value_amount)),
    },
    {
      key: "period_ends_at",
      label: "Vence em",
      render: (row: ContractRow) => new Date(row.period_ends_at).toLocaleDateString("pt-BR"),
    },
    {
      key: "actions",
      label: "",
      render: (row: ContractRow) => (
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
    <AppShell title="Contratos">
      <SectionHeader
        title="Contratos"
        description="Contratos de serviço, locação e assinatura com organizações clientes."
        action={
          <div className="flex items-center gap-2">
            <ExportButton entity="contracts" />
            <button
              type="button"
              onClick={() => void openForm()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-shina-blue hover:bg-blue-600 text-white text-xs font-semibold rounded-lg border-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Novo Contrato
            </button>
          </div>
        }
      />

      <DataTable columns={columns} data={contracts as ContractRow[]} loading={loading} />

      {!loading && contracts.length === 0 && (
        <p className="text-sm text-slate-500 mt-4 text-center">Nenhum contrato ainda.</p>
      )}

      <ContractDetail
        contractId={selectedId}
        onClose={() => setSelectedId(null)}
        onStatusChange={() => void load()}
      />

      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowForm(false)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Novo Contrato
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
                  onChange={(e) => setFormType(e.target.value as ContractType)}
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
                <label className="block text-xs font-medium text-slate-500 mb-1">Organização</label>
                <select
                  required
                  value={formOrgId}
                  onChange={(e) => setFormOrgId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  <option value="">Selecione...</option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Valor (BRL)</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Início</label>
                <input
                  required
                  type="date"
                  value={formStart}
                  onChange={(e) => setFormStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Fim</label>
                <input
                  required
                  type="date"
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
                {submitting ? "Criando..." : "Criar contrato"}
              </button>
            </form>
          </div>
        </>
      )}
    </AppShell>
  );
}
