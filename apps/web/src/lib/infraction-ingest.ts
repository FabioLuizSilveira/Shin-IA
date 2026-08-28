import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildDedupKey,
  resolveAssetMatch,
  normalizePlate,
  normalizeRenavam,
  type ExternalInfraction,
} from "@shina/infractions-engine";

export interface IngestResult {
  infractionId: string;
  caseId: string;
  deduplicated: boolean;
  matchConfidence: string;
}

// Shared ingestion path (item 6/9/30 of the spec) for every provider —
// manual entry today, CSV import and a future official adapter later all
// funnel through this one function so dedup/matching behavior is
// identical regardless of source. Never silently overwrites an existing
// infraction on a duplicate — returns the existing case instead (item 8:
// idempotent reingestion).
export async function ingestInfraction(
  db: SupabaseClient,
  external: ExternalInfraction,
  createdBy: string | null,
  // When the caller already knows the tenant (manual entry by tenant
  // staff), asset-matching candidates are scoped to that tenant only —
  // a staff member typing in a plate must never accidentally resolve to
  // another tenant's vehicle just because the plate string collides.
  // CSV/official-provider ingestion (tenant genuinely unknown) omits
  // this and searches across all tenants, same as item 5 describes.
  tenantHint?: string,
): Promise<IngestResult> {
  const dedupKey = buildDedupKey(external);

  const existingQuery =
    dedupKey.kind === "external_id"
      ? db
          .from("infractions")
          .select("id")
          .eq("source", dedupKey.source)
          .eq("external_id", dedupKey.externalId!)
      : (() => {
          // dedupKey.autoNumber/authorityCode are genuinely undefined
          // (not "") whenever the source infraction has no value for
          // them -- and the DB stores that as NULL, not ''. .eq(col, "")
          // never matches a NULL column, so a plain .eq() chain here
          // silently failed to find a real duplicate whenever both were
          // absent (found live during Fase I CSV import verification;
          // see infractions_fallback_dedup_idx's NULLS NOT DISTINCT fix,
          // migration 20260110000000, which is the layer that actually
          // enforces this -- this query is only the cheap pre-check).
          let q = db
            .from("infractions")
            .select("id")
            .eq("source", dedupKey.source)
            .is("external_id", null)
            .eq("plate", dedupKey.plate ?? "")
            .eq("occurred_at", dedupKey.occurredAt ?? "");
          q = dedupKey.autoNumber
            ? q.eq("auto_number", dedupKey.autoNumber)
            : q.is("auto_number", null);
          q = dedupKey.authorityCode
            ? q.eq("authority_code", dedupKey.authorityCode)
            : q.is("authority_code", null);
          return q;
        })();

  const { data: existing } = await existingQuery.maybeSingle();
  if (existing) {
    const { data: existingCase } = await db
      .from("infraction_cases")
      .select("id")
      .eq("infraction_id", existing.id)
      .maybeSingle();
    return {
      infractionId: existing.id,
      caseId: existingCase!.id,
      deduplicated: true,
      matchConfidence: "n/a",
    };
  }

  const infractionId = crypto.randomUUID();
  const { error: insertError } = await db.from("infractions").insert({
    id: infractionId,
    tenant_id: null, // resolved below once the asset match is known
    source: external.source,
    external_id: external.externalId,
    auto_number: external.autoNumber,
    authority_code: external.authorityCode,
    authority_name: external.authorityName,
    infraction_code: external.infractionCode,
    description: external.description,
    plate: normalizePlate(external.plate),
    renavam: external.renavam ? normalizeRenavam(external.renavam) : null,
    occurred_at: external.occurredAt,
    location: external.location,
    municipality: external.municipality,
    state: external.state,
    amount_cents: external.amountCents,
    amount_currency: external.amountCurrency,
    due_date: external.dueDate,
    driver_identification_deadline: external.driverIdentificationDeadline,
    defense_deadline: external.defenseDeadline,
    payment_deadline: external.paymentDeadline,
    discount_deadline: external.discountDeadline,
    external_status: external.externalStatus,
    raw_payload: external.rawPayload,
    created_by: createdBy,
  });
  if (insertError) throw insertError;

  // Asset matching (item 9) — candidates are scoped by plate (indexed),
  // renavam narrows further when present. Deliberately not scoped by
  // tenant_id yet: the infraction arrives without a known tenant, so this
  // is exactly where the tenant gets discovered (or the case stays
  // UNMATCHED, per item 5).
  let candidateQuery = db
    .from("assets")
    .select("id, tenant_id, plate, renavam")
    .eq("plate", normalizePlate(external.plate));
  if (tenantHint) candidateQuery = candidateQuery.eq("tenant_id", tenantHint);
  const { data: candidateRows } = await candidateQuery;
  const candidates = (candidateRows ?? []).map((r) => ({
    assetId: r.id,
    tenantId: r.tenant_id,
    plate: r.plate,
    renavam: r.renavam,
  }));
  const match = resolveAssetMatch(external.renavam, external.plate, candidates);

  // Bug found while building the unmatched-reprocessing cron: when the
  // caller already knows the tenant (tenantHint -- manual entry or CSV
  // import, both done by an authenticated staff member registering
  // *their own* fleet's infraction), a failed asset match used to leave
  // tenant_id null anyway, making the case invisible to that very tenant
  // via RLS -- indistinguishable from a genuinely external, tenant-unknown
  // infraction. A vehicle not yet onboarded as an asset is a real,
  // common case (the ticket often arrives before the asset does), so
  // "known tenant, no asset yet" must stay visible and correctable via
  // the existing tenant-scoped POST /api/infractions/:id/match retry --
  // only a genuinely unknown tenant (no hint) goes into the anonymous
  // UNMATCHED pool the cron sweep (infraction-unmatched-sweep.ts) processes.
  const resolvedTenantId = match.tenantId ?? tenantHint ?? null;
  if (resolvedTenantId) {
    await db.from("infractions").update({ tenant_id: resolvedTenantId }).eq("id", infractionId);
  }

  const caseId = crypto.randomUUID();
  const caseStatus = match.assetId ? "matched" : "unmatched";
  await db.from("infraction_cases").insert({
    id: caseId,
    tenant_id: resolvedTenantId, // nullable — null only when the tenant is genuinely unknown (item 5)
    infraction_id: infractionId,
    status: caseStatus,
    asset_id: match.assetId,
    match_confidence: match.confidence,
  });

  return { infractionId, caseId, deduplicated: false, matchConfidence: match.confidence };
}
