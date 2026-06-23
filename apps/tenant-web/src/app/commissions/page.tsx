"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricCard } from "@/components/ui/metric-card";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Award, DollarSign, TrendingUp } from "lucide-react";
import type { Contract, ContractStatus } from "@/types/domain";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const COMMISSION_RATE = 0.05;

const contractStatusLabel: Record<ContractStatus, string> = {
  active: "Ativo",
  draft: "Rascunho",
  expired: "Expirado",
  terminated: "Rescindido",
  suspended: "Suspenso",
};

function contractStatusToUi(
  status: ContractStatus,
): "active" | "inactive" | "pending" | "warning" | "error" {
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

interface CommissionRow extends Record<string, unknown> {
  id: string;
  org_name: string;
  contract_type: string;
  status: ContractStatus;
  value_amount: number;
  commission: number;
}

export default function CommissionsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((j: { data: Contract[] }) => setContracts(j.data ?? []))
      .catch(() => setContracts([]))
      .finally(() => setLoading(false));
  }, []);

  const activeContracts = contracts.filter((c) => c.status === "active");
  const totalBase = activeContracts.reduce((s, c) => s + Number(c.value_amount), 0);
  const totalCommission = totalBase * COMMISSION_RATE;
  const paidCommission = contracts
    .filter((c) => c.status === "active")
    .reduce((s, c) => s + Number(c.value_amount) * COMMISSION_RATE, 0);
  const pendingCount = contracts.filter((c) => c.status === "draft").length;

  const rows: CommissionRow[] = contracts.map((c) => ({
    id: c.id,
    org_name: c.organization_name ?? "—",
    contract_type: c.type,
    status: c.status,
    value_amount: Number(c.value_amount),
    commission: Number(c.value_amount) * COMMISSION_RATE,
  }));

  const contractTypeLabel: Record<string, string> = {
    service: "Serviço",
    rental: "Locação",
    lease: "Arrendamento",
    subscription: "Assinatura",
    one_time: "Avulso",
  };

  const columns = [
    {
      key: "id",
      label: "Contrato",
      render: (row: CommissionRow) => (
        <span className="font-mono text-xs text-slate-500">
          {String(row.id).slice(0, 8).toUpperCase()}
        </span>
      ),
    },
    { key: "org_name", label: "Organização" },
    {
      key: "contract_type",
      label: "Tipo",
      render: (row: CommissionRow) => (
        <span className="text-slate-700">
          {contractTypeLabel[String(row.contract_type)] ?? String(row.contract_type)}
        </span>
      ),
    },
    {
      key: "value_amount",
      label: "Valor Base",
      render: (row: CommissionRow) => (
        <span className="text-slate-700">{brl(Number(row.value_amount))}</span>
      ),
    },
    {
      key: "commission",
      label: `Comissão (${COMMISSION_RATE * 100}%)`,
      render: (row: CommissionRow) => (
        <span className="font-semibold text-emerald-600">{brl(Number(row.commission))}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: CommissionRow) => (
        <StatusBadge
          status={contractStatusToUi(row.status as ContractStatus)}
          label={contractStatusLabel[row.status as ContractStatus]}
        />
      ),
    },
  ];

  return (
    <AppShell title="Comissões">
      <SectionHeader
        title="Comissões"
        description="Comissões calculadas automaticamente sobre contratos ativos (5%)."
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <MetricCard
          title="Total Comissões"
          value={brl(totalCommission)}
          trend="up"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          title="Pagas (Contratos Ativos)"
          value={brl(paidCommission)}
          trend="up"
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          title="Pendentes"
          value={pendingCount}
          trend="neutral"
          icon={<Award className="w-5 h-5" />}
        />
      </div>

      <DataTable
        columns={columns as Parameters<typeof DataTable>[0]["columns"]}
        data={rows as unknown as Record<string, unknown>[]}
        loading={loading}
      />
    </AppShell>
  );
}
