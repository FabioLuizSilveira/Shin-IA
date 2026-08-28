import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAssetMatch } from "@shina/infractions-engine";
import { createDeadlinesForCase } from "@/lib/infraction-deadlines";
import { logActivity } from "@/lib/activity-log";

// Item 32 of the spec: "Asset é cadastrado posteriormente; reprocessamento
// executado." Genuinely UNMATCHED cases (infraction_cases.tenant_id is
// null -- see infraction-ingest.ts's resolvedTenantId comment: a
// tenant-hinted entry with a failed match still gets its tenant set, so
// only truly tenant-unknown infractions land here, the ones an official
// provider or an unattributed CSV row would produce) are never reachable
// through a tenant-scoped route by construction, since nobody has a
// tenant to be scoped to yet -- POST /api/infractions/:id/match
// deliberately can't reach them (see that route's own comment). This is
// the system-level sweep that reprocesses them: every asset created or
// updated (plate typo fixed, RENAVAM filled in) since the case first
// failed to match is a chance for it to resolve now.
export async function sweepUnmatchedInfractions(db: SupabaseClient): Promise<{
  checked: number;
  resolved: number;
  stillUnmatched: number;
}> {
  const { data: cases, error } = await db
    .from("infraction_cases")
    .select("id, infraction_id, status")
    .eq("status", "unmatched")
    .is("tenant_id", null);
  if (error) throw error;

  let resolved = 0;

  for (const infractionCase of cases ?? []) {
    const { data: infraction } = await db
      .from("infractions")
      .select(
        "plate, renavam, driver_identification_deadline, defense_deadline, discount_deadline, payment_deadline",
      )
      .eq("id", infractionCase.infraction_id)
      .maybeSingle();
    if (!infraction) continue;

    const { data: candidateRows } = await db
      .from("assets")
      .select("id, tenant_id, plate, renavam")
      .eq("plate", infraction.plate);
    const candidates = (candidateRows ?? []).map((r) => ({
      assetId: r.id,
      tenantId: r.tenant_id,
      plate: r.plate,
      renavam: r.renavam,
    }));
    const match = resolveAssetMatch(infraction.renavam, infraction.plate, candidates);
    // Still not_found or ambiguous -- nothing changed, leave it for the
    // next run. Never auto-picks among multiple candidates (item 9).
    if (!match.assetId || !match.tenantId) continue;

    await db
      .from("infractions")
      .update({ tenant_id: match.tenantId })
      .eq("id", infractionCase.infraction_id);
    await db
      .from("infraction_cases")
      .update({
        tenant_id: match.tenantId,
        asset_id: match.assetId,
        match_confidence: match.confidence,
        status: "matched",
        updated_at: new Date().toISOString(),
      })
      .eq("id", infractionCase.id);

    await createDeadlinesForCase(db, match.tenantId, infractionCase.id, infraction).catch(() => {});

    void logActivity(db, {
      tenantId: match.tenantId,
      actorId: "00000000-0000-0000-0000-000000000000",
      entityType: "infraction_case",
      entityId: infractionCase.id,
      action: "unmatched_reprocessed",
      metadata: { matchConfidence: match.confidence },
    });

    resolved += 1;
  }

  const checked = cases?.length ?? 0;
  return { checked, resolved, stillUnmatched: checked - resolved };
}
