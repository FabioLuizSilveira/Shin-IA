"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Invoice, InvoiceStatus } from "@/types/domain";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function invoiceStatusToUi(
  status: InvoiceStatus,
): "active" | "inactive" | "pending" | "warning" | "error" {
  switch (status) {
    case "paid":
      return "active";
    case "overdue":
      return "error";
    case "cancelled":
    case "voided":
      return "inactive";
    default:
      return "pending";
  }
}

const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  draft: "Rascunho",
  issued: "Emitida",
  paid: "Paga",
  overdue: "Vencida",
  cancelled: "Cancelada",
  voided: "Anulada",
};

type InvoiceRow = Invoice & Record<string, unknown>;

const columns = [
  {
    key: "id",
    label: "Fatura",
    render: (row: InvoiceRow) => (
      <span className="font-mono text-xs">{row.id.slice(0, 8).toUpperCase()}</span>
    ),
  },
  {
    key: "organization",
    label: "Organização",
    render: (row: InvoiceRow) => row.billing_accounts?.organizations?.name ?? "—",
  },
  {
    key: "status",
    label: "Status",
    render: (row: InvoiceRow) => (
      <StatusBadge status={invoiceStatusToUi(row.status)} label={invoiceStatusLabel[row.status]} />
    ),
  },
  {
    key: "due_date",
    label: "Vencimento",
    render: (row: InvoiceRow) => new Date(row.due_date).toLocaleDateString("pt-BR"),
  },
  {
    key: "total_amount",
    label: "Total",
    render: (row: InvoiceRow) => (
      <span className="font-semibold">{brl(Number(row.total_amount))}</span>
    ),
  },
];

export default function PlatformBillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/invoices?scope=platform");
      const json = (await res.json()) as { data?: Invoice[] };
      setInvoices(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const outstanding = invoices
    .filter((i) => i.status === "issued" || i.status === "overdue")
    .reduce((sum, i) => sum + Number(i.total_amount), 0);

  return (
    <AppShell title="Faturamento">
      <SectionHeader
        title="Faturamento e Assinaturas"
        description="Visão consolidada das faturas emitidas por todos os tenants — somente leitura; o pagamento é feito pelo próprio tenant."
      />

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 mb-6">
        <p className="text-xs text-slate-500 mb-1">Em aberto (emitidas + vencidas)</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">{brl(outstanding)}</p>
      </div>

      <DataTable columns={columns} data={invoices as InvoiceRow[]} loading={loading} />

      {!loading && invoices.length === 0 && (
        <p className="text-sm text-slate-500 mt-4 text-center">Nenhuma fatura no sistema ainda.</p>
      )}
    </AppShell>
  );
}
