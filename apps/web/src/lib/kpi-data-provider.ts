import type { SupabaseClient } from "@supabase/supabase-js";
import type { KpiDataProvider, KpiType } from "@shina/reporting-engine";

// Real KpiEngine.computeAll adapter (see api/tenant-reports/route.ts) — the
// package only needed a data source, its trend-delta math was already
// correct. Definitions below are honest about what the schema can actually
// answer retroactively: no table tracks historical resource status, so
// "utilization" is derived from operations overlapping the window (which IS
// timestamped) rather than a snapshot we can't reconstruct for past periods.

function shiftedPeriod(period: { start: string; end: string }) {
  const start = new Date(period.start).getTime();
  const end = new Date(period.end).getTime();
  const duration = end - start;
  return {
    start: new Date(start - duration).toISOString(),
    end: new Date(start).toISOString(),
  };
}

async function countInWindow(
  db: SupabaseClient,
  table: string,
  dateColumn: string,
  tenantId: string,
  window: { start: string; end: string },
) {
  const { count, error } = await db
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .gte(dateColumn, window.start)
    .lt(dateColumn, window.end);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countCreatedBefore(
  db: SupabaseClient,
  table: string,
  tenantId: string,
  cutoff: string,
) {
  const { count, error } = await db
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .lt("created_at", cutoff);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function sumPaidInvoices(
  db: SupabaseClient,
  tenantId: string,
  window: { start: string; end: string },
) {
  const { data, error } = await db
    .from("invoices")
    .select("total_amount")
    .eq("tenant_id", tenantId)
    .eq("status", "paid")
    .gte("paid_at", window.start)
    .lt("paid_at", window.end);
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
}

async function sumCommissions(
  db: SupabaseClient,
  tenantId: string,
  window: { start: string; end: string },
) {
  const { data, error } = await db
    .from("commission_transactions")
    .select("total_amount")
    .eq("tenant_id", tenantId)
    .gte("created_at", window.start)
    .lt("created_at", window.end);
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
}

async function distinctResourceCountFromOperations(
  db: SupabaseClient,
  tenantId: string,
  window: { start: string; end: string },
) {
  const { data, error } = await db
    .from("operations")
    .select("resource_id")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .lt("scheduled_starts_at", window.end)
    .gt("scheduled_ends_at", window.start);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.resource_id)).size;
}

// infraction_cases has no deleted_at column (hard deletes only, per
// 20260105000000_infractions_engine.sql) -- countInWindow's .is(
// "deleted_at", null) would error against a column that doesn't exist,
// so this is a separate, smaller helper rather than forcing every table
// through the same shape.
async function countInWindowNoSoftDelete(
  db: SupabaseClient,
  table: string,
  dateColumn: string,
  tenantId: string,
  window: { start: string; end: string },
) {
  const { count, error } = await db
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte(dateColumn, window.start)
    .lt(dateColumn, window.end);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function distinctResourceCountFromLocations(
  db: SupabaseClient,
  tenantId: string,
  window: { start: string; end: string },
) {
  const { data, error } = await db
    .from("resource_locations")
    .select("resource_id")
    .eq("tenant_id", tenantId)
    .gte("recorded_at", window.start)
    .lt("recorded_at", window.end);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.resource_id)).size;
}

export function createKpiDataProvider(db: SupabaseClient): KpiDataProvider {
  return {
    async fetchMetric(tenantId: string, kpiType: KpiType, period: { start: string; end: string }) {
      const previous = shiftedPeriod(period);

      switch (kpiType) {
        case "operations": {
          const [value, previousValue] = await Promise.all([
            countInWindow(db, "operations", "scheduled_starts_at", tenantId, period),
            countInWindow(db, "operations", "scheduled_starts_at", tenantId, previous),
          ]);
          return { value, previousValue };
        }

        case "assets": {
          // Cumulative fleet size as of each period boundary — the only
          // "active assets at a past date" question created_at can answer
          // honestly (current status isn't tracked historically).
          const [value, previousValue] = await Promise.all([
            countCreatedBefore(db, "assets", tenantId, period.end),
            countCreatedBefore(db, "assets", tenantId, period.start),
          ]);
          return { value, previousValue };
        }

        case "revenue": {
          const [value, previousValue] = await Promise.all([
            sumPaidInvoices(db, tenantId, period),
            sumPaidInvoices(db, tenantId, previous),
          ]);
          return { value, previousValue };
        }

        case "commissions": {
          const [value, previousValue] = await Promise.all([
            sumCommissions(db, tenantId, period),
            sumCommissions(db, tenantId, previous),
          ]);
          return { value, previousValue };
        }

        case "utilization": {
          const { count: totalResources, error } = await db
            .from("resources")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .is("deleted_at", null);
          if (error) throw new Error(error.message);
          if (!totalResources) return { value: 0, previousValue: null };

          const [used, previousUsed] = await Promise.all([
            distinctResourceCountFromOperations(db, tenantId, period),
            distinctResourceCountFromOperations(db, tenantId, previous),
          ]);
          return {
            value: Math.round((used / totalResources) * 10000) / 100,
            previousValue: Math.round((previousUsed / totalResources) * 10000) / 100,
          };
        }

        case "tracking": {
          const [value, previousValue] = await Promise.all([
            distinctResourceCountFromLocations(db, tenantId, period),
            distinctResourceCountFromLocations(db, tenantId, previous),
          ]);
          return { value, previousValue };
        }

        case "infractions": {
          // Cases created in the window, not the underlying immutable
          // infractions.occurred_at -- created_at is when the tenant's
          // exposure actually started being tracked (a CSV/manual entry
          // for an old infraction still counts against the period it was
          // registered in, same as every other KPI here counts by
          // creation/scheduling, never by an external event date the
          // tenant didn't control).
          const [value, previousValue] = await Promise.all([
            countInWindowNoSoftDelete(db, "infraction_cases", "created_at", tenantId, period),
            countInWindowNoSoftDelete(db, "infraction_cases", "created_at", tenantId, previous),
          ]);
          return { value, previousValue };
        }

        default:
          return { value: 0, previousValue: null };
      }
    },
  };
}
