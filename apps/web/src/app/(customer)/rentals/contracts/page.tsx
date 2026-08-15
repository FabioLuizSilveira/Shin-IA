"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMyRentals, type Rental } from "@/lib/rentals-portal";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  draft: "Aguardando aceite",
  expired: "Expirado",
  terminated: "Encerrado",
  suspended: "Suspenso",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ContractsCenterPage() {
  const router = useRouter();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyRentals()
      .then(setRentals)
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
        <h1 className="text-base font-bold text-slate-900 dark:text-white">Meus Contratos</h1>
      </header>

      <div className="px-4 py-4 max-w-xl mx-auto space-y-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : rentals.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Nenhum contrato ainda.</p>
        ) : (
          rentals.map((r) => (
            <button
              key={r.id}
              onClick={() =>
                router.push(r.snapshot_id ? `/rentals/${r.id}/contract` : `/rentals/${r.id}`)
              }
              className="w-full flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer text-left"
            >
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {STATUS_LABEL[r.status] ?? r.status}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDate(r.period_starts_at)} — {formatDate(r.period_ends_at)}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
