"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { InvoiceDetail } from "@/components/ui/invoice-detail";
import { ExportButton } from "@/components/ui/export-button";
import { Link2 } from "lucide-react";
import { useToast } from "@shina/design-system";
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
  const { show } = useToast();
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

  // These invoices are issued BY this tenant TO one of ITS OWN customers
  // (organizations) — the checkout route builds the Asaas charge using
  // the ORGANIZATION's own document/email/phone (api/invoices/[id]/checkout),
  // never the tenant staff member's. Redirecting the staff's own browser
  // there (the previous behavior) put them on a checkout page addressed
  // to their customer — confusing, and not something staff should "pay"
  // themselves. The real action here is generating the payment link and
  // handing it to the customer (WhatsApp, e-mail, etc.), so this now
  // creates the charge, copies the real link, and stays on this page —
  // same "create a link, copy it, tell the user" pattern already
  // established by inspection-detail.tsx's createShareLink().
  async function handleGeneratePaymentLink(id: string) {
    setPayingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${id}/checkout`, { method: "POST" });
      const json = (await res.json()) as { data?: { url: string }; error?: string };
      if (!res.ok || !json.data?.url)
        throw new Error(json.error ?? "Falha ao gerar link de pagamento");
      await navigator.clipboard.writeText(json.data.url).catch(() => {});
      show({
        message: "Link de pagamento copiado! Envie para o cliente para que ele possa pagar.",
        variant: "success",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro inesperado";
      setError(message);
      show({ message, variant: "danger" });
    } finally {
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
              onClick={() => void handleGeneratePaymentLink(row.id)}
              disabled={payingId === row.id}
              title="Gera o link de pagamento do cliente e copia para a área de transferência"
              className="flex items-center gap-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-2.5 py-1 rounded-lg font-medium border-0 cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" />
              {payingId === row.id ? "Gerando link..." : "Copiar link de pagamento"}
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
        action={<ExportButton entity="invoices" />}
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
