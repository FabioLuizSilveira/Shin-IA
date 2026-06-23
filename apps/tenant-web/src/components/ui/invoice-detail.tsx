"use client";

import { useState, useEffect } from "react";
import { X, Calendar, DollarSign, Building2, Receipt, Printer } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import type { InvoiceDetail as InvoiceDetailData, InvoiceStatus } from "@/types/domain";

interface InvoiceDetailProps {
  invoiceId: string | null;
  onClose: () => void;
  onStatusChange: () => void;
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const cycleLabels: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  annual: "Anual",
  one_time: "Avulso",
};

const ACTIONS: Record<string, { label: string; status: string; color: string }[]> = {
  draft: [
    { label: "Emitir", status: "issued", color: "bg-shina-blue hover:bg-blue-600 text-white" },
    {
      label: "Cancelar",
      status: "cancelled",
      color: "bg-slate-100 hover:bg-slate-200 text-slate-700",
    },
  ],
  issued: [
    {
      label: "Marcar como Pago",
      status: "paid",
      color: "bg-emerald-600 hover:bg-emerald-700 text-white",
    },
    {
      label: "Vencida",
      status: "overdue",
      color: "bg-red-100 hover:bg-red-200 text-red-700",
    },
    {
      label: "Cancelar",
      status: "cancelled",
      color: "bg-slate-100 hover:bg-slate-200 text-slate-700",
    },
  ],
  overdue: [
    {
      label: "Marcar como Pago",
      status: "paid",
      color: "bg-emerald-600 hover:bg-emerald-700 text-white",
    },
    {
      label: "Cancelar",
      status: "cancelled",
      color: "bg-slate-100 hover:bg-slate-200 text-slate-700",
    },
  ],
};

function invoiceStatusToUi(
  status: InvoiceStatus,
): "active" | "inactive" | "pending" | "warning" | "error" {
  switch (status) {
    case "paid":
      return "active";
    case "draft":
      return "pending";
    case "issued":
      return "pending";
    case "overdue":
      return "error";
    case "cancelled":
    case "voided":
      return "inactive";
    default:
      return "inactive";
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function InvoiceDetail({ invoiceId, onClose, onStatusChange }: InvoiceDetailProps) {
  const [invoice, setInvoice] = useState<InvoiceDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!invoiceId) {
      setInvoice(null);
      return;
    }
    setLoading(true);
    fetch(`/api/invoices/${invoiceId}`)
      .then((r) => r.json())
      .then((j: { data: InvoiceDetailData }) => setInvoice(j.data))
      .catch(() => setInvoice(null))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  async function handleAction(newStatus: string) {
    if (!invoiceId) return;
    setActing(true);
    try {
      await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } finally {
      setActing(false);
    }
    onStatusChange();
    onClose();
  }

  if (!invoiceId) return null;

  const actions = invoice ? (ACTIONS[invoice.status] ?? null) : null;
  const lineItems = invoice?.invoice_line_items ?? [];
  const sortedItems = [...lineItems].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Detalhe da Fatura</h2>
          <div className="flex items-center gap-2">
            {invoiceId && (
              <a
                href={`/financial/invoices/${invoiceId}/print`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer border-0 bg-transparent"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading || !invoice ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status + ID */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Nº Fatura</p>
                  <p className="text-sm font-mono text-slate-700">
                    {invoice.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <StatusBadge
                  status={invoiceStatusToUi(invoice.status)}
                  label={invoiceStatusLabel[invoice.status]}
                />
              </div>

              {/* Organization */}
              {invoice.billing_accounts?.organizations && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Organização</p>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-9 h-9 rounded-full bg-shina-blue/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-shina-blue" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {invoice.billing_accounts.organizations.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {cycleLabels[invoice.billing_accounts.cycle] ??
                          invoice.billing_accounts.cycle}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Financial details */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Total</span>
                  <span className="ml-auto font-bold text-slate-900 text-base">
                    {brl(Number(invoice.total_amount))}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Vencimento</span>
                  <span className="ml-auto font-medium text-slate-900">
                    {formatDate(invoice.due_date)}
                  </span>
                </div>
                {invoice.paid_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <Receipt className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-600 font-medium">
                      Pago em {formatDate(invoice.paid_at)}
                    </span>
                  </div>
                )}
              </div>

              {/* Line items */}
              {sortedItems.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Itens da Fatura</p>
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                            Descrição
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">
                            Qtd
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">
                            Unit.
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">
                            Subtotal
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {sortedItems.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2 text-slate-700">{item.description}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{item.quantity}</td>
                            <td className="px-3 py-2 text-right text-slate-600">
                              {brl(Number(item.unit_price_amount))}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-slate-900">
                              {brl(Number(item.unit_price_amount) * item.quantity)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {invoice && actions && (
          <div className="px-6 py-4 border-t border-slate-100 space-y-2">
            <p className="text-xs font-medium text-slate-500 mb-3">Ações disponíveis</p>
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <button
                  key={action.status}
                  onClick={() => void handleAction(action.status)}
                  disabled={acting}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer border-0 ${action.color}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {invoice && !actions && (
          <div className="px-6 py-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">
              Esta fatura está em estado terminal e não pode ser alterada.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
