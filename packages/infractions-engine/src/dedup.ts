import type { DedupKey, ExternalInfraction } from "./types.js";
import { normalizePlate } from "./normalize.js";

// Deduplication key (item 8 of the spec). Providers that give a real
// external_id dedupe on (source, external_id) — the strong case. When no
// external_id exists (manual entry, some CSV sources), fall back to
// (auto_number, plate, occurred_at, authority_code) — matches the two
// partial unique indexes created in 20260105000000_infractions_engine.sql.
// This function only builds the logical key; the actual dedup happens at
// the DB unique-index level (real idempotency, not an in-memory check
// that a concurrent request could race past).
export function buildDedupKey(infraction: ExternalInfraction): DedupKey {
  if (infraction.externalId) {
    return { kind: "external_id", source: infraction.source, externalId: infraction.externalId };
  }
  return {
    kind: "fallback",
    source: infraction.source,
    autoNumber: infraction.autoNumber ?? undefined,
    plate: normalizePlate(infraction.plate),
    occurredAt: infraction.occurredAt,
    authorityCode: infraction.authorityCode ?? undefined,
  };
}
