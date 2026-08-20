"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  fetchMyRentals,
  fetchMyInvoices,
  fetchUpgradeOptions,
  type Rental,
  type CustomerInvoice,
  type UpgradeOption,
} from "@/lib/rentals-portal";
import { CustomerHeader } from "@/components/customer/customer-header";
import { Loader2, ChevronRight, CarFront } from "lucide-react";

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

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
}

export default function RentalsListPage() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [options, setOptions] = useState<UpgradeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchMyRentals(), fetchMyInvoices()])
      .then(async ([r, i]) => {
        setRentals(r);
        setInvoices(i);
        const activeRental = r.find((x) => x.status === "active");
        if (activeRental) {
          const opts = await fetchUpgradeOptions(
            activeRental.tenant_id,
            Number(activeRental.value_amount),
          );
          setOptions(opts.filter((o) => o.id !== activeRental.contract_assets[0]?.assets?.id));
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const pending = invoices.filter((i) => i.status === "issued" || i.status === "overdue");
  const overdue = invoices.filter((i) => i.status === "overdue");
  const pendingTotal = pending.reduce((sum, i) => sum + Number(i.total_amount), 0);
  const currency = invoices[0]?.total_currency ?? "BRL";
  const activeRental = rentals.find((r) => r.status === "active");

  return (
    <div className="min-h-screen bg-slate-950">
      <CustomerHeader title="Minhas locações" />

      <div className="px-4 py-4 max-w-xl mx-auto space-y-3">
        {error && (
          <div className="px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          </div>
        ) : (
          <>
            {invoices.length > 0 && (
              <Link
                href="/rentals/invoices"
                className="block bg-white/5 border border-white/10 rounded-2xl p-4 hover:border-shina-blue/50 hover:bg-white/[0.07] transition"
              >
                <p className="text-xs font-semibold text-shina-cyan">PAGAMENTOS</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {formatCurrency(pendingTotal, currency)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {overdue.length > 0
                    ? `${overdue.length} fatura(s) em atraso`
                    : pending.length > 0
                      ? `${pending.length} fatura(s) a pagar`
                      : "Nenhuma fatura pendente"}
                </p>
              </Link>
            )}

            {rentals.length === 0 ? (
              <p className="text-center text-sm text-slate-500 py-16">
                Nenhuma locação encontrada.
              </p>
            ) : (
              rentals.map((rental) => {
                const first = rental.contract_assets[0]?.assets?.name ?? "Locação";
                const extra =
                  rental.contract_assets.length > 1 ? ` +${rental.contract_assets.length - 1}` : "";
                const photoUrl = rental.contract_assets[0]?.assets?.metadata?.photo_url;
                return (
                  <div
                    key={rental.id}
                    className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3"
                  >
                    <Link
                      href={`/rentals/${rental.id}`}
                      className="flex items-center gap-3 hover:opacity-80 transition"
                    >
                      {photoUrl ? (
                        <Image
                          src={photoUrl}
                          alt={first}
                          width={48}
                          height={48}
                          className="w-12 h-12 rounded-lg object-cover bg-white/10 shrink-0"
                          unoptimized
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-white/10 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white truncate">
                            {first}
                            {extra}
                          </p>
                          <span className="shrink-0 text-xs font-semibold text-shina-cyan">
                            {STATUS_LABEL[rental.status] ?? rental.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatDate(rental.period_starts_at)} —{" "}
                          {formatDate(rental.period_ends_at)}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                    </Link>
                    {rental.status === "active" && (
                      <Link
                        href={`/rentals/${rental.id}/renew`}
                        className="block text-center px-3 py-2 bg-gradient-to-r from-shina-blue to-shina-cyan text-white text-xs font-semibold rounded-lg transition hover:opacity-90"
                      >
                        Renovar contrato
                      </Link>
                    )}
                  </div>
                );
              })
            )}

            {activeRental && options.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <CarFront className="w-4 h-4 text-shina-cyan" />
                  <p className="text-sm font-bold text-white">Veículos disponíveis</p>
                </div>
                <p className="text-xs text-slate-400">
                  Mesmo valor ou superior ao seu plano atual — troque na renovação.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {options.slice(0, 4).map((opt) => (
                    <Link
                      key={opt.id}
                      href={`/rentals/${activeRental.id}/renew`}
                      className="bg-white/5 border border-white/10 rounded-xl p-3 hover:border-shina-blue/50 hover:bg-white/[0.07] transition"
                    >
                      {opt.metadata.photo_url ? (
                        <Image
                          src={opt.metadata.photo_url}
                          alt={opt.name}
                          width={200}
                          height={100}
                          className="w-full h-20 rounded-lg object-cover bg-white/10 mb-2"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-20 rounded-lg bg-white/10 mb-2" />
                      )}
                      <p className="text-xs font-semibold text-white truncate">{opt.name}</p>
                      <p className="text-xs font-semibold text-shina-cyan">
                        {formatCurrency(opt.metadata.weekly_rate ?? 0, currency)}/semana
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
