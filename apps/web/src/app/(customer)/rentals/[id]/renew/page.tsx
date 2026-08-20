"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  fetchMyRentals,
  fetchMyInvoices,
  fetchUpgradeOptions,
  fetchMyReservations,
  fetchAssetAvailability,
  renewalCheckout,
  createReservation,
  reservationBalanceCheckout,
  type Rental,
  type CustomerInvoice,
  type UpgradeOption,
  type Reservation,
} from "@/lib/rentals-portal";

const RESERVATION_STATUS_LABEL: Record<string, string> = {
  pending_deposit: "Aguardando sinal",
  reserved: "Reservado — saldo pendente",
  completed: "Confirmado",
  forfeited: "Sinal perdido",
  cancelled: "Cancelado",
};

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
}

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10);
}

function eachDateInRange(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const cur = new Date(startIso);
  const end = new Date(endIso);
  while (cur < end) {
    out.push(toDateString(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// Same "renovar contrato" logic as apps/mobile/src/screens/RenewalScreen.tsx:
// same car = pay-only, no calendar (the webhook's action:"renewal" extends
// the contract the moment payment clears); a different (equal-or-higher)
// car = pick a period on the calendar, pay a 20% deposit to hold it
// (webhook action:"deposit"), pay the 80% balance any time up to the day
// before it starts, or the cron job (api/cron/forfeit-reservations) marks it
// forfeited and the deposit is kept.
export default function RenewalPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const rentalId = params.id;

  const [rental, setRental] = useState<Rental | null>(null);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [options, setOptions] = useState<UpgradeOption[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentAssetId = rental?.contract_assets[0]?.assets?.id ?? null;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchMyRentals()
      .then(async (rentals) => {
        const r = rentals.find((x) => x.id === rentalId) ?? null;
        setRental(r);
        const currentRate = Number(r?.value_amount ?? 0);
        const [opts, inv, res] = await Promise.all([
          r ? fetchUpgradeOptions(r.tenant_id, currentRate) : Promise.resolve([]),
          fetchMyInvoices(),
          fetchMyReservations(),
        ]);
        setOptions(opts);
        setInvoices(inv);
        setReservations(res.filter((x) => x.tenant_id === r?.tenant_id));
        setSelectedId(r?.contract_assets[0]?.assets?.id ?? null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [rentalId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadAvailability = useCallback(async (assetId: string) => {
    const ranges = await fetchAssetAvailability(assetId);
    const days = new Set<string>();
    ranges.forEach((r) => eachDateInRange(r.start, r.end).forEach((d) => days.add(d)));
    setBookedDates(days);
  }, []);

  function selectOption(id: string) {
    setSelectedId(id);
    setRangeStart(null);
    setRangeEnd(null);
    if (id !== currentAssetId) void loadAvailability(id);
  }

  function onDayClick(dateStr: string) {
    if (bookedDates.has(dateStr)) return;
    if (dateStr < toDateString(new Date())) return;
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(dateStr);
      setRangeEnd(null);
      return;
    }
    if (dateStr <= rangeStart) {
      setRangeStart(dateStr);
      return;
    }
    const spanned = eachDateInRange(rangeStart, dateStr);
    if (spanned.some((d) => bookedDates.has(d))) {
      setError("Esse intervalo passa por dias já reservados.");
      return;
    }
    setError(null);
    setRangeEnd(dateStr);
  }

  const selectedOption = options.find((o) => o.id === selectedId);
  const isSameCar = selectedId === currentAssetId;
  const weeklyRate = isSameCar
    ? Number(rental?.value_amount ?? 0)
    : Number(selectedOption?.metadata.weekly_rate ?? 0);

  const weeks =
    rangeStart && rangeEnd
      ? Math.max(
          1,
          Math.ceil((new Date(rangeEnd).getTime() - new Date(rangeStart).getTime()) / 604800000),
        )
      : 0;
  const previewTotal = weeklyRate * weeks;
  const previewDeposit = Math.round(previewTotal * 0.2 * 100) / 100;
  const previewBalance = Math.round((previewTotal - previewDeposit) * 100) / 100;

  async function handleRenewSameCar() {
    if (!rental) return;
    setSubmitting(true);
    setError(null);
    try {
      const { url } = await renewalCheckout(rental.id);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao iniciar pagamento");
      setSubmitting(false);
    }
  }

  async function handleReserveDifferentCar() {
    if (!selectedId || !rangeStart || !rangeEnd) {
      setError("Selecione o período no calendário primeiro.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { url } = await createReservation({
        assetId: selectedId,
        startsAt: new Date(rangeStart).toISOString(),
        endsAt: new Date(new Date(rangeEnd).getTime() + 86400000).toISOString(),
      });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar reserva");
      setSubmitting(false);
    }
  }

  async function handlePayBalance(reservationId: string) {
    setSubmitting(true);
    setError(null);
    try {
      const { url } = await reservationBalanceCheckout(reservationId);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao iniciar pagamento");
      setSubmitting(false);
    }
  }

  const calendarCells = useMemo(() => {
    const first = viewMonth;
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const leading = first.getDay();
    const cells: (string | null)[] = Array(leading).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(toDateString(new Date(first.getFullYear(), first.getMonth(), d)));
    }
    return cells;
  }, [viewMonth]);

  if (loading || !rental) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const pending = invoices.filter((i) => i.status === "issued" || i.status === "overdue");
  const pendingTotal = pending.reduce((sum, i) => sum + Number(i.total_amount), 0);
  const currency = invoices[0]?.total_currency ?? rental.value_currency;
  const today = toDateString(new Date());

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => router.push(`/rentals/${rental.id}`)}
          className="p-1 -ml-1 cursor-pointer border-0 bg-transparent text-slate-500 dark:text-slate-400"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-slate-900 dark:text-white">Renovar contrato</h1>
      </header>

      <div className="px-4 py-4 max-w-xl mx-auto space-y-5">
        {error && (
          <div className="px-4 py-3 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-xl text-sm text-red-600 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-xs font-semibold text-shina-blue">LOCAÇÃO ATUAL</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
            {rental.contract_assets[0]?.assets?.name ?? "Locação"}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {formatCurrency(Number(rental.value_amount), rental.value_currency)}/semana
          </p>
        </div>

        <div
          onClick={() => router.push("/rentals/invoices")}
          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 cursor-pointer hover:border-shina-blue transition"
        >
          <p className="text-xs font-semibold text-shina-blue">PAGAMENTO</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {formatCurrency(pendingTotal, currency)}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {pending.length > 0 ? `${pending.length} fatura(s) pendente(s)` : "Nenhuma pendência"}
          </p>
        </div>

        {reservations.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Suas reservas</p>
            {reservations.map((r) => (
              <div
                key={r.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {r.assets?.name ?? "Veículo"}
                  </p>
                  <span className="text-xs font-semibold text-shina-blue">
                    {RESERVATION_STATUS_LABEL[r.status]}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {new Date(r.period_starts_at).toLocaleDateString("pt-BR")} —{" "}
                  {new Date(r.period_ends_at).toLocaleDateString("pt-BR")}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sinal: {formatCurrency(r.deposit_amount, r.total_currency)} · Saldo:{" "}
                  {formatCurrency(r.balance_amount, r.total_currency)}
                </p>
                {r.status === "reserved" && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handlePayBalance(r.id)}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-shina-blue hover:bg-blue-600 text-white text-xs font-semibold rounded-lg border-0 cursor-pointer transition disabled:opacity-60"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Pagar saldo
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-900 dark:text-white">Veículos disponíveis</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Mesmo valor ou superior ao seu plano atual.
          </p>

          <button
            type="button"
            onClick={() => selectOption(currentAssetId ?? "")}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left cursor-pointer transition ${
              isSameCar
                ? "border-shina-blue"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            }`}
          >
            <div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <span className="text-xs text-slate-500">Atual</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {rental.contract_assets[0]?.assets?.name ?? "Veículo atual"}
              </p>
              <p className="text-xs font-semibold text-shina-blue">
                {formatCurrency(Number(rental.value_amount), rental.value_currency)}/semana
              </p>
            </div>
          </button>

          {options.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">
              Nenhum outro veículo disponível no momento.
            </p>
          ) : (
            options.map((opt) => {
              const selected = opt.id === selectedId;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => selectOption(opt.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left cursor-pointer transition ${
                    selected
                      ? "border-shina-blue"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  }`}
                >
                  {opt.metadata.photo_url ? (
                    <Image
                      src={opt.metadata.photo_url}
                      alt={opt.name}
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 shrink-0"
                      unoptimized
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {opt.name}
                    </p>
                    <p className="text-xs font-semibold text-shina-blue">
                      {formatCurrency(opt.metadata.weekly_rate ?? 0, currency)}/semana
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {isSameCar ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleRenewSameCar()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-shina-blue hover:bg-blue-600 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer transition disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Abrindo pagamento..." : "Pagar e renovar"}
          </button>
        ) : (
          selectedOption && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-slate-900 dark:text-white">Escolha o período</p>
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <button
                    type="button"
                    onClick={() =>
                      setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
                    }
                    className="px-2 py-1 text-sm text-slate-500 cursor-pointer border-0 bg-transparent"
                  >
                    ‹
                  </button>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {viewMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))
                    }
                    className="px-2 py-1 text-sm text-slate-500 cursor-pointer border-0 bg-transparent"
                  >
                    ›
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {WEEKDAYS.map((w, i) => (
                    <span key={i} className="text-[11px] text-slate-400 py-1">
                      {w}
                    </span>
                  ))}
                  {calendarCells.map((dateStr, i) => {
                    if (!dateStr) return <span key={i} />;
                    const disabled = bookedDates.has(dateStr) || dateStr < today;
                    const inRange =
                      rangeStart && rangeEnd && dateStr >= rangeStart && dateStr <= rangeEnd;
                    const isStart = dateStr === rangeStart;
                    return (
                      <button
                        key={dateStr}
                        type="button"
                        disabled={disabled}
                        onClick={() => onDayClick(dateStr)}
                        className={`text-xs py-1.5 rounded-lg cursor-pointer border-0 transition ${
                          disabled
                            ? "text-slate-300 dark:text-slate-700 cursor-not-allowed"
                            : inRange || isStart
                              ? "bg-shina-blue text-white font-semibold"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {Number(dateStr.slice(-2))}
                      </button>
                    );
                  })}
                </div>
              </div>

              {weeks > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                  <p className="text-xs font-semibold text-shina-blue">
                    {weeks} semana(s) selecionada(s)
                  </p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {formatCurrency(previewTotal, currency)}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Sinal (20%): {formatCurrency(previewDeposit, currency)} agora · Saldo (80%):{" "}
                    {formatCurrency(previewBalance, currency)} até 1 dia antes
                  </p>
                </div>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleReserveDifferentCar()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-shina-blue hover:bg-blue-600 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer transition disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? "Abrindo pagamento..." : "Reservar com sinal de 20%"}
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
