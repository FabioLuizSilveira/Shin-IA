import type { SupabaseClient } from "@supabase/supabase-js";
import { findAssetConflicts, type ResourceConflict } from "@/lib/resource-availability";
import {
  TenantContractRequirementResolver,
  ContractTemplateEngine,
  createContractSnapshot,
} from "@shina/tenant-contract-engine";

// Agent Runtime v3, Wave 2.5 ("Rental Domain Foundation") — see the
// migration's own header comment for the full REUSE audit. Rental is
// modeled as an `operations` row (type="vehicle_rental"), the exact same
// pattern Wave 2's createTrip()/createTowingServiceRequest() already
// use — never a parallel aggregate/status lifecycle (spec section 5,
// echoing operation_runtime.sql's own "no new table, no second status
// lifecycle" rule for Trip).

// ── Availability ────────────────────────────────────────────────────────

export interface RentalAvailability {
  available: boolean;
  conflicts: ResourceConflict[];
}

/** ACTIVE ≠ AVAILABLE (spec section 8/21) — deliberately does NOT check
 * assets.status at all, matching how the existing get_asset_availability
 * agent tool already works (confirmed by re-reading it before writing
 * this): a real overlapping operation is the only thing that actually
 * makes an asset unavailable, regardless of what its own status field
 * says. An asset under active maintenance already has a blocking
 * `operations` row (type="maintenance") — this check finds it for free,
 * no maintenance-specific code needed here. */
export async function checkRentalAvailability(
  db: SupabaseClient,
  params: {
    tenantId: string;
    assetId: string;
    startsAt: string;
    endsAt: string;
    excludeOperationId?: string;
  },
): Promise<RentalAvailability> {
  const conflicts = await findAssetConflicts(db, params);
  return { available: conflicts.length === 0, conflicts };
}

export class RentalConflictError extends Error {
  constructor(public readonly conflicts: ResourceConflict[]) {
    super("asset is already booked in this time window");
  }
}

// ── Pricing ──────────────────────────────────────────────────────────────

export interface RentalRate {
  id: string;
  dailyRateCents: number | null;
  hourlyRateCents: number | null;
  weeklyRateCents: number | null;
  monthlyRateCents: number | null;
  currency: string;
}

interface RateRow {
  id: string;
  daily_rate_cents: number | null;
  hourly_rate_cents: number | null;
  weekly_rate_cents: number | null;
  monthly_rate_cents: number | null;
  currency: string;
}

function fromRateRow(r: RateRow): RentalRate {
  return {
    id: r.id,
    dailyRateCents: r.daily_rate_cents,
    hourlyRateCents: r.hourly_rate_cents,
    weeklyRateCents: r.weekly_rate_cents,
    monthlyRateCents: r.monthly_rate_cents,
    currency: r.currency,
  };
}

const RATE_SELECT =
  "id, daily_rate_cents, hourly_rate_cents, weekly_rate_cents, monthly_rate_cents, currency";

/** Finds the most SPECIFIC active rate for this asset (spec section 11):
 * a rate pinned to this exact asset wins over one for its asset_type,
 * which wins over one for its whole category — never picks a rate whose
 * effective window doesn't cover "now". Returns null (never a fabricated
 * default) when nothing matches; the caller must then either ask the
 * user for a manual price or fail — this function never guesses one. */
export async function findApplicableRentalRate(
  db: SupabaseClient,
  params: { tenantId: string; assetId: string },
): Promise<RentalRate | null> {
  const { data: asset } = await db
    .from("assets")
    .select("id, asset_type_id, category")
    .eq("id", params.assetId)
    .eq("tenant_id", params.tenantId)
    .maybeSingle();
  if (!asset) return null;

  // Live-verified real bug: comparing effective_from (set by the
  // database's own `now()` at insert time) against a CLIENT-computed
  // timestamp is fragile to ordinary clock skew between the app server
  // and the Postgres server — a rate created moments ago could have an
  // effective_from a few hundred ms AHEAD of this process's own clock,
  // making it invisible right after creation. A generous tolerance
  // buffer (a rate's effective window is a business-day-granularity
  // concept, never sub-second-sensitive) fixes this without weakening
  // the real semantics.
  const CLOCK_SKEW_TOLERANCE_MS = 60_000;
  // Two separate reference points, each leaning the forgiving direction
  // for its own comparison — a rate whose effective_from looks up to a
  // minute in the future, or whose effective_to looks up to a minute in
  // the past, purely due to skew, still counts as currently effective.
  const notBefore = new Date(Date.now() + CLOCK_SKEW_TOLERANCE_MS).toISOString();
  const notAfter = new Date(Date.now() - CLOCK_SKEW_TOLERANCE_MS).toISOString();
  const baseQuery = () =>
    db
      .from("rental_rates")
      .select(RATE_SELECT)
      .eq("tenant_id", params.tenantId)
      .eq("status", "active")
      .lte("effective_from", notBefore)
      .or(`effective_to.is.null,effective_to.gte.${notAfter}`);

  const { data: byAsset } = await baseQuery().eq("asset_id", params.assetId).limit(1).maybeSingle();
  if (byAsset) return fromRateRow(byAsset as RateRow);

  if (asset.asset_type_id) {
    const { data: byType } = await baseQuery()
      .eq("asset_type_id", asset.asset_type_id)
      .is("asset_id", null)
      .limit(1)
      .maybeSingle();
    if (byType) return fromRateRow(byType as RateRow);
  }

  const { data: byCategory } = await baseQuery()
    .eq("asset_category", asset.category)
    .is("asset_id", null)
    .is("asset_type_id", null)
    .limit(1)
    .maybeSingle();
  return byCategory ? fromRateRow(byCategory as RateRow) : null;
}

export interface RentalPriceResult {
  subtotalCents: number;
  totalCents: number;
  currency: string;
  /** pt-BR, human-readable breakdown of how the total was reached —
   * shown to the user before confirmation, never silently computed. */
  breakdown: string;
}

interface PriceCandidate {
  tierLabel: string;
  qty: number;
  unitCents: number;
  totalCents: number;
}

/** Pure, deterministic — never the LLM (spec section 23/12). Computes
 * every tier the rate plan actually has priced, then picks whichever
 * costs the CUSTOMER least — never a fixed "coarsest tier that covers
 * the duration" rule, which a real live test caught overcharging: for
 * an 8-day rental, rounding up to 2 whole weeks (paying for 14 days'
 * worth) costs MORE than 8 separate daily charges would, so a
 * threshold-based rule picks the wrong, more expensive tier. Minimum-
 * cost selection is simple, still fully deterministic, and never
 * disadvantages the customer. Throws (never a fabricated 0) when the
 * rate plan has no tier priced at all, or when the period itself is
 * invalid. */
export function calculateRentalPrice(
  rate: RentalRate,
  startsAt: string,
  endsAt: string,
): RentalPriceResult {
  const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  if (!(ms > 0)) throw new Error("endsAt must be after startsAt");
  const hours = ms / 3_600_000;
  const days = Math.ceil(hours / 24);

  const candidates: PriceCandidate[] = [];
  if (rate.hourlyRateCents) {
    const qty = Math.ceil(hours);
    candidates.push({
      tierLabel: "hora(s)",
      qty,
      unitCents: rate.hourlyRateCents,
      totalCents: qty * rate.hourlyRateCents,
    });
  }
  if (rate.dailyRateCents) {
    candidates.push({
      tierLabel: "diária(s)",
      qty: days,
      unitCents: rate.dailyRateCents,
      totalCents: days * rate.dailyRateCents,
    });
  }
  if (rate.weeklyRateCents) {
    const qty = Math.ceil(days / 7);
    candidates.push({
      tierLabel: "semana(s)",
      qty,
      unitCents: rate.weeklyRateCents,
      totalCents: qty * rate.weeklyRateCents,
    });
  }
  if (rate.monthlyRateCents) {
    const qty = Math.ceil(days / 30);
    candidates.push({
      tierLabel: "mês(es)",
      qty,
      unitCents: rate.monthlyRateCents,
      totalCents: qty * rate.monthlyRateCents,
    });
  }
  if (candidates.length === 0) {
    throw new Error("rate plan has no tier applicable to this rental's duration");
  }

  const best = candidates.reduce((min, c) => (c.totalCents < min.totalCents ? c : min));
  const fmt = (cents: number) => (cents / 100).toFixed(2);
  return {
    subtotalCents: best.totalCents,
    totalCents: best.totalCents,
    currency: rate.currency,
    breakdown: `${best.qty} ${best.tierLabel} x ${rate.currency} ${fmt(best.unitCents)}`,
  };
}

// ── Pricing snapshot ────────────────────────────────────────────────────

export interface RentalPricingSnapshot {
  id: string;
  rateId: string | null;
  assetId: string;
  startsAt: string;
  endsAt: string;
  subtotalCents: number;
  totalCents: number;
  currency: string;
  manualOverride: boolean;
}

interface SnapshotRow {
  id: string;
  rate_id: string | null;
  asset_id: string;
  starts_at: string;
  ends_at: string;
  subtotal_cents: number;
  total_cents: number;
  currency: string;
  manual_override: boolean;
}

function fromSnapshotRow(r: SnapshotRow): RentalPricingSnapshot {
  return {
    id: r.id,
    rateId: r.rate_id,
    assetId: r.asset_id,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    subtotalCents: r.subtotal_cents,
    totalCents: r.total_cents,
    currency: r.currency,
    manualOverride: r.manual_override,
  };
}

/** Persists an IMMUTABLE record of what a rental cost at the moment it
 * was priced (spec section 13/23) — application code only ever INSERTs
 * here, never UPDATEs. A rate table change tomorrow must never alter a
 * snapshot written today. */
export async function createRentalPricingSnapshot(
  db: SupabaseClient,
  input: {
    tenantId: string;
    assetId: string;
    startsAt: string;
    endsAt: string;
    rateId: string | null;
    subtotalCents: number;
    totalCents: number;
    currency: string;
    manualOverride?: boolean;
    overrideReason?: string;
    authorizedBy?: string;
  },
): Promise<RentalPricingSnapshot> {
  const { data, error } = await db
    .from("rental_pricing_snapshots")
    .insert({
      tenant_id: input.tenantId,
      asset_id: input.assetId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      rate_id: input.rateId,
      subtotal_cents: input.subtotalCents,
      total_cents: input.totalCents,
      currency: input.currency,
      manual_override: input.manualOverride ?? false,
      override_reason: input.overrideReason ?? null,
      authorized_by: input.authorizedBy ?? null,
    })
    .select(
      "id, rate_id, asset_id, starts_at, ends_at, subtotal_cents, total_cents, currency, manual_override",
    )
    .single();
  if (error || !data) throw new Error(`createRentalPricingSnapshot: ${error?.message}`);
  return fromSnapshotRow(data as SnapshotRow);
}

// ── Reservation (the operations row itself) ─────────────────────────────

export interface CreateRentalInput {
  tenantId: string;
  assetId: string;
  customerOrganizationId?: string | null;
  scheduledStartsAt: string;
  scheduledEndsAt: string;
  pricingSnapshotId?: string | null;
}

export interface Rental {
  id: string;
  tenantId: string;
  branchId: string;
  assetId: string | null;
  scheduledStartsAt: string;
  scheduledEndsAt: string;
  status: string;
  metadata: Record<string, unknown>;
}

interface OperationRow {
  id: string;
  tenant_id: string;
  branch_id: string;
  asset_id: string | null;
  scheduled_starts_at: string;
  scheduled_ends_at: string;
  status: string;
  metadata: Record<string, unknown>;
}

function fromOperationRow(r: OperationRow): Rental {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    branchId: r.branch_id,
    assetId: r.asset_id,
    scheduledStartsAt: r.scheduled_starts_at,
    scheduledEndsAt: r.scheduled_ends_at,
    status: r.status,
    metadata: r.metadata ?? {},
  };
}

/** Creates the real reservation — an `operations` row, type
 * "vehicle_rental". Same app-level pre-check + DB-level GiST exclusion
 * race guard as createTrip()/createTowingServiceRequest() (spec section
 * 10: two concurrent requests for the same asset/period must never both
 * succeed) — the app-level findAssetConflicts() check here is a
 * SELECT-then-INSERT race window; the real guard against a genuine
 * concurrent double-book is the 23P01 (exclusion_violation) case below,
 * backed by the GiST constraint the whole `operations` table already
 * has (20260066000000_operations_asset_link.sql) — no new constraint
 * needed for Rental specifically. */
export async function createRental(db: SupabaseClient, input: CreateRentalInput): Promise<Rental> {
  const { data: asset, error: assetError } = await db
    .from("assets")
    .select("id, branch_id")
    .eq("id", input.assetId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (assetError) throw assetError;
  if (!asset) throw new Error("asset not found");

  const availability = await checkRentalAvailability(db, {
    tenantId: input.tenantId,
    assetId: input.assetId,
    startsAt: input.scheduledStartsAt,
    endsAt: input.scheduledEndsAt,
  });
  if (!availability.available) throw new RentalConflictError(availability.conflicts);

  const { data, error } = await db
    .from("operations")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: input.tenantId,
      branch_id: asset.branch_id,
      asset_id: input.assetId,
      resource_id: null,
      type: "vehicle_rental",
      scheduled_starts_at: input.scheduledStartsAt,
      scheduled_ends_at: input.scheduledEndsAt,
      metadata: {
        customerOrganizationId: input.customerOrganizationId ?? null,
        pricingSnapshotId: input.pricingSnapshotId ?? null,
      },
    })
    .select(
      "id, tenant_id, branch_id, asset_id, scheduled_starts_at, scheduled_ends_at, status, metadata",
    )
    .single();
  if (error) {
    if (error.code === "23P01") throw new RentalConflictError([]);
    throw error;
  }
  if (!data) throw new Error("failed to create rental");
  return fromOperationRow(data as OperationRow);
}

/** Cancelling releases availability structurally, not by convention: the
 * GiST exclusion constraint only blocks `status in ('pending',
 * 'in_progress')` rows (20260066000000) — a cancelled rental's row stops
 * counting as a conflict the instant this update commits, same as any
 * other operation type already relies on. No separate "release" step. */
export async function cancelRental(
  db: SupabaseClient,
  params: { tenantId: string; rentalId: string },
): Promise<void> {
  const { error } = await db
    .from("operations")
    .update({ status: "cancelled" })
    .eq("id", params.rentalId)
    .eq("tenant_id", params.tenantId)
    .eq("type", "vehicle_rental");
  if (error) throw new Error(`cancelRental: ${error.message}`);
}

// ── Contract integration ─────────────────────────────────────────────────

export interface CreateRentalContractInput {
  tenantId: string;
  organizationId: string;
  valueAmount: number;
  valueCurrency: string;
  periodStartsAt: string;
  periodEndsAt: string;
  rentalOperationId: string;
  /** Optional — mirrors POST /api/contracts' own exact optionality
   * (confirmed by reading it before writing this): without a
   * blueprintId, this produces a plain, always-functional contract row,
   * same as every contract created today. With one, it resolves +
   * snapshots the tenant's real dynamic legal template via the SAME
   * @shina/tenant-contract-engine package that route already uses —
   * never a parallel contract-rendering implementation. */
  blueprintId?: string | null;
}

export interface RentalContract {
  id: string;
  type: string;
  status: string;
  valueAmount: number;
  valueCurrency: string;
  organizationId: string;
}

/** Creates the Contract for a rental — reuses the plain `contracts`
 * table (M27) exactly as POST /api/contracts does, with data already
 * known from the Rental (spec section 17: "não pedir ao usuário
 * novamente dados existentes") instead of a human typing value_amount
 * by hand. */
export async function createRentalContract(
  db: SupabaseClient,
  input: CreateRentalContractInput,
): Promise<RentalContract> {
  const { data: created, error } = await db
    .from("contracts")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: input.tenantId,
      organization_id: input.organizationId,
      type: "rental",
      value_amount: input.valueAmount,
      value_currency: input.valueCurrency,
      period_starts_at: input.periodStartsAt,
      period_ends_at: input.periodEndsAt,
      metadata: { rentalOperationId: input.rentalOperationId },
    })
    .select("id, type, status, value_amount, value_currency, organization_id")
    .single();
  if (error || !created) throw new Error(`createRentalContract: ${error?.message}`);

  if (input.blueprintId) {
    const requirement = await TenantContractRequirementResolver.resolve(db, {
      tenantId: input.tenantId,
      partyType: "customer",
      blueprintId: input.blueprintId,
      operatorRequired: false,
      operatorIncluded: false,
      trackingEnabled: false,
      contractId: created.id as string,
    });
    const rendered = await ContractTemplateEngine.render(db, {
      templateId: requirement.templateId,
      context: {},
    });
    const snapshot = await createContractSnapshot(db, {
      tenantId: input.tenantId,
      contractId: created.id as string,
      templateVersionId: requirement.versionId,
      renderedContent: rendered.renderedContent,
      contentHash: rendered.contentHash,
    });
    await db
      .from("contracts")
      .update({
        template_id: requirement.templateId,
        template_version_id: requirement.versionId,
        snapshot_id: snapshot.id,
      })
      .eq("id", created.id as string);
  }

  return {
    id: created.id as string,
    type: created.type as string,
    status: created.status as string,
    valueAmount: created.value_amount as number,
    valueCurrency: created.value_currency as string,
    organizationId: created.organization_id as string,
  };
}
