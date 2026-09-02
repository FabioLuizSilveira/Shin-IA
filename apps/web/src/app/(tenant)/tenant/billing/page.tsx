"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { InvoiceDetail } from "@/components/ui/invoice-detail";
import { ExportButton } from "@/components/ui/export-button";
import { CreditCard } from "lucide-react";
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

export default function TenantBillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/invoices");
      const json = (await res.json()) as { data?: Invoice[] };
      setInvoices(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handlePay(id: string) {
    setPayingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${id}/checkout`, { method: "POST" });
      const json = (await res.json()) as { data?: { url: string }; error?: string };
      if (!res.ok || !json.data?.url) throw new Error(json.error ?? "Falha ao iniciar pagamento");
      window.location.href = json.data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
      setPayingId(null);
    }
  }

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
        <StatusBadge
          status={invoiceStatusToUi(row.status)}
          label={invoiceStatusLabel[row.status]}
        />
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
    {
      key: "actions",
      label: "",
      render: (row: InvoiceRow) => (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedId(row.id)}
            className="text-xs text-shina-blue hover:text-blue-700 font-medium bg-transparent border-0 cursor-pointer p-0"
          >
            Ver detalhes
          </button>
          {(row.status === "issued" || row.status === "overdue") && (
            <button
              type="button"
              onClick={() => void handlePay(row.id)}
              disabled={payingId === row.id}
              className="flex items-center gap-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-2.5 py-1 rounded-lg font-medium border-0 cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              {payingId === row.id ? "Redirecionando..." : "Pagar fatura"}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppShell title="Faturamento">
      <SectionHeader
        title="Faturas"
        description="Faturas emitidas para as organizações vinculadas à sua conta."
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/tenant/billing/upgrade"
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-shina-blue text-white hover:bg-blue-600 transition no-underline"
            >
              Mudar de plano
            </Link>
            <ExportButton entity="invoices" />
          </div>
        }
      />

      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <DataTable columns={columns} data={invoices as InvoiceRow[]} loading={loading} />

      {!loading && invoices.length === 0 && (
        <p className="text-sm text-slate-500 mt-4 text-center">Nenhuma fatura ainda.</p>
      )}

      <InvoiceDetail
        invoiceId={selectedId}
        onClose={() => setSelectedId(null)}
        onStatusChange={() => void load()}
      />
    </AppShell>
  );
}
