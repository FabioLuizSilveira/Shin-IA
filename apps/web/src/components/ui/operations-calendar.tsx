"use client";
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Calendar, Zap } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface CalendarOperation {
  id: string;
  type: string;
  status: string;
  scheduled_starts_at: string;
  scheduled_ends_at: string;
  resources: { name: string } | null;
  assets: { name: string } | null;
}

interface OperationsCalendarProps {
  onSelectOperation?: (id: string) => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const typeLabels: Record<string, string> = {
  delivery: "Entrega",
  pickup: "Coleta",
  maintenance: "Manutenção",
  inspection: "Inspeção",
  transfer: "Transferência",
};

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  pending: { bg: "bg-amber-100", text: "text-amber-800", dot: "bg-amber-400" },
  in_progress: { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500" },
  completed: { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" },
  cancelled: { bg: "bg-slate-100", text: "text-slate-500", dot: "bg-slate-400" },
  failed: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

function statusLabel(status: string): string {
  switch (status) {
    case "in_progress":
      return "Em andamento";
    case "pending":
      return "Pendente";
    case "completed":
      return "Concluída";
    case "cancelled":
      return "Cancelada";
    case "failed":
      return "Falhou";
    default:
      return status;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function OperationsCalendar({ onSelectOperation }: OperationsCalendarProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [ops, setOps] = useState<CalendarOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const fetchOps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/operations/calendar?year=${year}&month=${month}`);
      const json = (await res.json()) as { data: CalendarOperation[] };
      setOps(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void fetchOps();
    setSelectedDay(null);
  }, [fetchOps]);

  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
  }

  // Group ops by day-of-month
  const opsByDay = new Map<number, CalendarOperation[]>();
  for (const op of ops) {
    const d = new Date(op.scheduled_starts_at).getDate();
    if (!opsByDay.has(d)) opsByDay.set(d, []);
    opsByDay.get(d)!.push(op);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month); // 0=Sun
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;

  const isToday = (day: number) =>
    year === today.getFullYear() && month === today.getMonth() + 1 && day === today.getDate();

  const selectedOps = selectedDay !== null ? (opsByDay.get(selectedDay) ?? []) : [];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-shina-blue" />
          <h2 className="text-base font-semibold text-slate-900">
            {MONTHS[month - 1]} {year}
          </h2>
          {loading && <span className="text-xs text-slate-400 animate-pulse">Carregando...</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <button
            onClick={() => {
              setYear(today.getFullYear());
              setMonth(today.getMonth() + 1);
            }}
            className="px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Hoje
          </button>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-6 py-2 bg-slate-50 border-b border-slate-100">
        {Object.entries(statusConfig).map(([status, cfg]) => (
          <span key={status} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            {statusLabel(status)}
          </span>
        ))}
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {Array.from({ length: totalCells }).map((_, idx) => {
          const day = idx - firstDow + 1;
          const isValid = day >= 1 && day <= daysInMonth;
          const dayOps = isValid ? (opsByDay.get(day) ?? []) : [];
          const isSelected = selectedDay === day && isValid;

          return (
            <div
              key={idx}
              onClick={() => isValid && setSelectedDay(isSelected ? null : day)}
              className={[
                "min-h-[88px] p-1.5 border-b border-r border-slate-100 last:border-r-0 transition-colors",
                isValid ? "cursor-pointer" : "bg-slate-50/50",
                isToday(day) ? "bg-blue-50/60" : "",
                isSelected
                  ? "bg-indigo-50 ring-1 ring-inset ring-indigo-200"
                  : isValid
                    ? "hover:bg-slate-50"
                    : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {isValid && (
                <>
                  <div
                    className={[
                      "w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1",
                      isToday(day) ? "bg-shina-blue text-white" : "text-slate-700",
                    ].join(" ")}
                  >
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayOps.slice(0, 2).map((op) => {
                      const cfg = statusConfig[op.status] ?? statusConfig.pending;
                      return (
                        <div
                          key={op.id}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate ${cfg.bg} ${cfg.text}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectOperation?.(op.id);
                          }}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                          <span className="truncate">{typeLabels[op.type] ?? op.type}</span>
                        </div>
                      );
                    })}
                    {dayOps.length > 2 && (
                      <div className="text-[10px] text-slate-400 pl-1">
                        +{dayOps.length - 2} mais
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Day detail panel */}
      {selectedDay !== null && (
        <div className="border-t border-slate-200 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            {selectedDay} de {MONTHS[month - 1]} —{" "}
            {selectedOps.length === 0
              ? "Nenhuma operação"
              : `${selectedOps.length} operaç${selectedOps.length > 1 ? "ões" : "ão"}`}
          </h3>
          {selectedOps.length > 0 && (
            <div className="space-y-2">
              {selectedOps.map((op) => {
                const cfg = statusConfig[op.status] ?? statusConfig.pending;
                const startTime = new Date(op.scheduled_starts_at).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const endTime = new Date(op.scheduled_ends_at).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <div
                    key={op.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${cfg.bg} cursor-pointer hover:opacity-80 transition-opacity`}
                    onClick={() => onSelectOperation?.(op.id)}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${cfg.text}`}>
                        {typeLabels[op.type] ?? op.type}
                      </p>
                      <p className="text-xs text-slate-500">
                        {op.resources?.name ?? op.assets?.name ?? "—"} · {startTime}–{endTime}
                      </p>
                    </div>
                    <Zap className={`w-4 h-4 ${cfg.text} opacity-60 shrink-0`} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
