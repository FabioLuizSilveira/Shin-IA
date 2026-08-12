"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchMyRentals, type Rental } from "@/lib/rentals-portal";
import { Loader2, ChevronRight } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  draft: "Rascunho",
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

export default function RentalsListPage() {
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
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4">
        <h1 className="text-base font-bold text-slate-900 dark:text-white">Minhas locações</h1>
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
        ) : rentals.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-16">Nenhuma locação encontrada.</p>
        ) : (
          rentals.map((rental) => {
            const first = rental.contract_assets[0]?.assets?.name ?? "Locação";
            const extra =
              rental.contract_assets.length > 1 ? ` +${rental.contract_assets.length - 1}` : "";
            return (
              <Link
                key={rental.id}
                href={`/rentals/${rental.id}`}
                className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:border-shina-blue transition"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {first}
                      {extra}
                    </p>
                    <span className="shrink-0 text-xs font-semibold text-shina-blue">
                      {STATUS_LABEL[rental.status] ?? rental.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {formatDate(rental.period_starts_at)} — {formatDate(rental.period_ends_at)}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
