// Wave 4 Phase B — the only max-days-window guard in the codebase.
// tenant-reports' ?period=start,end (staff) is fully unbounded today; the
// only existing "bounded" precedent anywhere is mobile tracking history's
// row-count limit (Wave 3 Phase C), which bounds count, not date span. This
// is new code, not a reuse of an existing pattern — the audit confirmed
// none exists to copy.
export type ReportRangePreset = "today" | "7d" | "30d" | "90d" | "custom";

export interface ReportPeriod {
  start: string;
  end: string;
}

export interface ReportPeriodError {
  error: string;
}

const PRESET_DAYS: Record<Exclude<ReportRangePreset, "custom">, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const MAX_CUSTOM_DAYS = 90;

export function resolveReportPeriod(
  searchParams: URLSearchParams,
): ReportPeriod | ReportPeriodError {
  const range = (searchParams.get("range") ?? "30d") as ReportRangePreset;

  if (range === "custom") {
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    if (!fromRaw || !toRaw) {
      return { error: "range=custom requires both from and to (ISO dates)" };
    }
    const from = new Date(fromRaw);
    const to = new Date(toRaw);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return { error: "from/to must be valid ISO dates" };
    }
    if (to <= from) {
      return { error: "to must be after from" };
    }
    const spanDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    if (spanDays > MAX_CUSTOM_DAYS) {
      return { error: `custom range cannot exceed ${MAX_CUSTOM_DAYS} days` };
    }
    return { start: from.toISOString(), end: to.toISOString() };
  }

  const days = PRESET_DAYS[range];
  if (!days) {
    return { error: "range must be one of today|7d|30d|90d|custom" };
  }
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function isReportPeriodError(
  period: ReportPeriod | ReportPeriodError,
): period is ReportPeriodError {
  return "error" in period;
}
