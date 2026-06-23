"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { MetricCard } from "@/components/ui/metric-card";
import { ContractDetail } from "@/components/ui/contract-detail";
import { ExportButton } from "@/components/ui/export-button";
import { FileText, DollarSign, Plus } from "lucide-react";
import type { Contract, ContractStatus, ContractType, Organization } from "@/types/domain";

function contractStatusToUi(status: ContractStatus): "active" | "inactive" | "pending" | "warning" {
  switch (status) {
    case "active":
      return "active";
    case "draft":
      return "pending";
    case "suspended":
      return "warning";
    case "expired":
    case "terminated":
      return "inactive";
    default:
      return "inactive";
  }
}

function contractStatusLabel(status: ContractStatus): string {
  const labels: Record<ContractStatus, string> = {
    active: "Ativo",
    draft: "Rascunho",
    expired: "Expirado",
    terminated: "Rescindido",
    suspended: "Suspenso",
  };
  return labels[status] ?? status;
}

function contractTypeLabel(type: ContractType): string {
  const labels: Record<ContractType, string> = {
    service: "Serviço",
    rental: "Locação",
    lease: "Arrendamento",
    subscription: "Assinatura",
    one_time: "Avulso",
  };
  return labels[type] ?? type;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency === "BRL" ? "BRL" : currency,
  }).format(amount);
}

type ContractRow = Contract & {
  uiStatus: "active" | "inactive" | "pending" | "warning";
  typeLabel: string;
  valueFormatted: string;
  startFormatted: string;
  endFormatted: string;
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  const [formOrg, setFormOrg] = useState("");
  const [formType, setFormType] = useState<ContractType>("service");
  const [formAmount, setFormAmount] = useState("");
  const [formCurrency] = useState("BRL");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contracts");
      if (!res.ok) throw new Error("Falha ao carregar contratos");
      const json = (await res.json()) as { data: Contract[] };
      setContracts(json.data ?? []);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, []);

  async function fetchOrganizations() {
    try {
      const res = await fetch("/api/organizations");
      if (!res.ok) return;
      const json = (await res.json()) as { data: Organization[] };
      setOrganizations(json.data ?? []);
    } catch {
      // keep empty
    }
  }

  useEffect(() => {
    void fetchContracts();
    void fetchOrganizations();
  }, [fetchContracts]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: formOrg,
          type: formType,
          value_amount: parseFloat(formAmount),
          value_currency: formCurrency,
          period_starts_at: new Date(formStart).toISOString(),
          period_ends_at: new Date(formEnd).toISOString(),
        }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Falha ao criar contrato");
      }
      setShowForm(false);
      setFormOrg("");
      setFormType("service");
      setFormAmount("");
      setFormStart("");
      setFormEnd("");
      await fetchContracts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao criar contrato");
    } finally {
      setSubmitting(false);
    }
  }

  const tableData: ContractRow[] = contracts.map((c) => ({
    ...c,
    uiStatus: contractStatusToUi(c.status),
    typeLabel: contractTypeLabel(c.type),
    valueFormatted: formatCurrency(c.value_amount, c.value_currency),
    startFormatted: new Date(c.period_starts_at).toLocaleDateString("pt-BR"),
    endFormatted: new Date(c.period_ends_at).toLocaleDateString("pt-BR"),
  }));

  const activeContracts = contracts.filter((c) => c.status === "active");
  const totalValue = activeContracts.reduce((sum, c) => sum + c.value_amount, 0);
  const draftCount = contracts.filter((c) => c.status === "draft").length;

  const COLUMNS = [
    {
      key: "id",
      label: "Contrato",
      render: (row: ContractRow) => row.id.slice(0, 8).toUpperCase(),
    },
    { key: "organization_name", label: "Cliente" },
    { key: "typeLabel", label: "Tipo" },
    { key: "valueFormatted", label: "Valor" },
    {
      key: "uiStatus",
      label: "Status",
      render: (row: ContractRow) => (
        <StatusBadge status={row.uiStatus} label={contractStatusLabel(row.status)} />
      ),
    },
    { key: "startFormatted", label: "Início" },
    { key: "endFormatted", label: "Fim" },
    {
      key: "actions",
      label: "",
      render: (row: ContractRow) => (
        <button
          onClick={() => setSelectedContractId(row.id)}
          className="text-xs text-shina-blue hover:text-blue-700 font-medium bg-transparent border-0 cursor-pointer"
        >
          Detalhes →
        </button>
      ),
    },
  ];

  return (
    <AppShell title="Contratos">
      <SectionHeader
        title="Contratos"
        description="Gerencie contratos de locação e prestação de serviços."
        action={
          !showForm ? (
            <div className="flex items-center gap-2">
              <ExportButton entity="contracts" />
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-shina-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors cursor-pointer border-0"
              >
                <Plus className="w-4 h-4" />
                Novo Contrato
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
          <h3 className="text-base font-semibold text-slate-900 mb-4">Novo Contrato</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Organização <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formOrg}
                onChange={(e) => setFormOrg(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue bg-white"
              >
                <option value="">Selecione uma organização</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Tipo <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formType}
                onChange={(e) => setFormType(e.target.value as ContractType)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue bg-white"
              >
                <option value="service">Serviço</option>
                <option value="rental">Locação</option>
                <option value="lease">Arrendamento</option>
                <option value="subscription">Assinatura</option>
                <option value="one_time">Avulso</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Valor (BRL) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="Ex: 45000"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Início <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formStart}
                  onChange={(e) => setFormStart(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Fim <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formEnd}
                  onChange={(e) => setFormEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue"
                />
              </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <MetricCard
          title="Contratos Ativos"
          value={String(activeContracts.length)}
          trend="up"
          icon={<FileText className="w-5 h-5" />}
        />
        <MetricCard
          title="Valor Total"
          value={formatCurrency(totalValue, "BRL")}
          trend="up"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          title="Rascunhos"
          value={String(draftCount)}
          trend="neutral"
          icon={<FileText className="w-5 h-5" />}
        />
      </div>

      <DataTable
        columns={COLUMNS as Parameters<typeof DataTable>[0]["columns"]}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data={tableData as any}
        loading={loading}
      />

      <ContractDetail
        contractId={selectedContractId}
        onClose={() => setSelectedContractId(null)}
        onStatusChange={() => void fetchContracts()}
      />
    </AppShell>
  );
}
