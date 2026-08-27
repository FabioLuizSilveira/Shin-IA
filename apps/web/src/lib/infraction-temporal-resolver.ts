import type { SupabaseClient } from "@supabase/supabase-js";
import { suggestResponsibility, type ResponsibilitySuggestion } from "@shina/infractions-engine";

// Temporal matching (item 10/11 of the spec) — there is no existing "who
// had this asset at time T" resolver anywhere in the codebase (confirmed
// via audit, see docs/architecture/INFRACTIONS_ENGINE.md Fase A). Built
// from scratch here, reusing the same point-in-time-covers-range idea as
// resource-availability.ts's overlap check, just against a single
// timestamp instead of a range. `contracts`/`operations`/`allocations`
// are queried independently and combined — never "current contract"
// (item 10 explicitly warns against that), always the row whose period
// actually covers occurredAt.

export interface TemporalMatchResult {
  contract: {
    id: string;
    organizationId: string;
    periodStartsAt: string;
    periodEndsAt: string;
  } | null;
  operation: { id: string; startsAt: string; endsAt: string; resourceId: string | null } | null;
  allocation: { id: string; startsAt: string; endsAt: string; resourceId: string } | null;
  operatorAssignment: { operatorId: string; status: string } | null;
  customerId: string | null;
  trackingConfirmed: boolean;
  suggestion: ResponsibilitySuggestion;
}

// Best-effort tracking evidence window — a GPS ping within 30 minutes of
// occurredAt is treated as "the asset was in operation around that time".
// This is contextual evidence only (item 13: "Tracking deve ser evidência
// contextual, nunca decisão jurídica isolada") — it only nudges
// confidence in suggestResponsibility, never decides anything by itself.
const TRACKING_WINDOW_MS = 30 * 60 * 1000;

export async function resolveTemporalContext(
  db: SupabaseClient,
  tenantId: string,
  assetId: string,
  occurredAt: string,
): Promise<TemporalMatchResult> {
  const [{ data: contractRows }, { data: operationRows }, { data: allocationRows }] =
    await Promise.all([
      db
        .from("contract_assets")
        .select("contracts(id, organization_id, period_starts_at, period_ends_at)")
        .eq("tenant_id", tenantId)
        .eq("asset_id", assetId),
      db
        .from("operations")
        .select("id, resource_id, scheduled_starts_at, scheduled_ends_at")
        .eq("tenant_id", tenantId)
        .eq("asset_id", assetId)
        .lte("scheduled_starts_at", occurredAt)
        .gte("scheduled_ends_at", occurredAt)
        .limit(1),
      db
        .from("allocations")
        .select("id, resource_id, period_starts_at, period_ends_at")
        .eq("tenant_id", tenantId)
        .eq("asset_id", assetId)
        .lte("period_starts_at", occurredAt)
        .gte("period_ends_at", occurredAt)
        .limit(1),
    ]);

  const occurredMs = new Date(occurredAt).getTime();
  const matchedContractRow = (contractRows ?? [])
    .map(
      (r) =>
        r.contracts as unknown as {
          id: string;
          organization_id: string;
          period_starts_at: string;
          period_ends_at: string;
        } | null,
    )
    .find(
      (c) =>
        c &&
        new Date(c.period_starts_at).getTime() <= occurredMs &&
        new Date(c.period_ends_at).getTime() >= occurredMs,
    );

  const contract = matchedContractRow
    ? {
        id: matchedContractRow.id,
        organizationId: matchedContractRow.organization_id,
        periodStartsAt: matchedContractRow.period_starts_at,
        periodEndsAt: matchedContractRow.period_ends_at,
      }
    : null;

  const operationRow = operationRows?.[0] ?? null;
  const operation = operationRow
    ? {
        id: operationRow.id,
        startsAt: operationRow.scheduled_starts_at,
        endsAt: operationRow.scheduled_ends_at,
        resourceId: operationRow.resource_id,
      }
    : null;

  const allocationRow = allocationRows?.[0] ?? null;
  const allocation = allocationRow
    ? {
        id: allocationRow.id,
        startsAt: allocationRow.period_starts_at,
        endsAt: allocationRow.period_ends_at,
        resourceId: allocationRow.resource_id,
      }
    : null;

  let operatorAssignment: { operatorId: string; status: string } | null = null;
  if (operation) {
    const { data: assignmentRows } = await db
      .from("operator_assignments")
      .select("operator_id, status")
      .eq("tenant_id", tenantId)
      .eq("operation_id", operation.id)
      .order("assigned_at", { ascending: false })
      .limit(1);
    if (assignmentRows?.[0]) {
      operatorAssignment = {
        operatorId: assignmentRows[0].operator_id,
        status: assignmentRows[0].status,
      };
    }
  }

  let customerId: string | null = null;
  if (contract) {
    const { data: linkRows } = await db
      .from("rental_customer_organizations")
      .select("rental_customer_id")
      .eq("tenant_id", tenantId)
      .eq("organization_id", contract.organizationId)
      .limit(1);
    customerId = linkRows?.[0]?.rental_customer_id ?? null;
  }

  const resourceIdForTracking = operation?.resourceId ?? allocation?.resourceId ?? null;
  let trackingConfirmed = false;
  if (resourceIdForTracking) {
    const windowStart = new Date(occurredMs - TRACKING_WINDOW_MS).toISOString();
    const windowEnd = new Date(occurredMs + TRACKING_WINDOW_MS).toISOString();
    const { count } = await db
      .from("resource_locations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("resource_id", resourceIdForTracking)
      .gte("recorded_at", windowStart)
      .lte("recorded_at", windowEnd);
    trackingConfirmed = Boolean(count && count > 0);
  }

  const suggestion = suggestResponsibility({
    occurredAt,
    contract,
    customerId,
    operation: operation
      ? { id: operation.id, startsAt: operation.startsAt, endsAt: operation.endsAt }
      : null,
    allocation: allocation
      ? { id: allocation.id, startsAt: allocation.startsAt, endsAt: allocation.endsAt }
      : null,
    operatorAssignment,
    trackingConfirmed,
  });

  return {
    contract,
    operation,
    allocation,
    operatorAssignment,
    customerId,
    trackingConfirmed,
    suggestion,
  };
}
