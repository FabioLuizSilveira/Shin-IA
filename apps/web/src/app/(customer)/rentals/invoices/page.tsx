"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMyInvoices, type CustomerInvoice } from "@/lib/rentals-portal";
import { ArrowLeft, Loader2 } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  issued: "A pagar",
  overdue: "Em atraso",
  paid: "Paga",
};

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function CustomerInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyInvoices()
      .then(setInvoices)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => router.push("/rentals")}
          className="p-1 -ml-1 cursor-pointer border-0 bg-transparent text-slate-500 dark:text-slate-400"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-slate-900 dark:text-white">Pagamentos</h1>
      </header>

      <div className="px-4 py-4 max-w-xl mx-auto space-y-3">
        {error && (
          <div className="px-4 py-3 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-xl text-sm text-red-600 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : invoices.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-16">Nenhuma fatura encontrada.</p>
        ) : (
          invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatCurrency(Number(invoice.total_amount), invoice.total_currency)}
                </p>
                <span className="text-xs font-semibold text-shina-blue">
                  {STATUS_LABEL[invoice.status] ?? invoice.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Vencimento: {formatDate(invoice.due_date)}
              </p>
              {invoice.paid_at && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pago em {formatDate(invoice.paid_at)}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
