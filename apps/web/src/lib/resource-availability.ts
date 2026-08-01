import type { SupabaseClient } from "@supabase/supabase-js";

// Overlap-conflict check for resource booking — the gap packages/resource-engine's
// AllocationEngine/AvailabilityChecker target, but that package's domain model
// (its own ResourceType/ResourceStatus enums, a resource_calendar table) doesn't
// match the live schema (resource_status: available/busy/offline/suspended,
// no calendar table) — adopting it as-is would mean inventing tables/adapters
// that serve no other purpose. This reimplements the same interval-overlap
// algorithm directly against the real `operations` table, which is the actual
// booking record (resource_id + scheduled_starts_at/ends_at per operation).
//
// Only pending/in_progress operations hold the resource — cancelled/failed/
// completed ones no longer occupy the time window.
const BLOCKING_STATUSES = ["pending", "in_progress"];

export interface ResourceConflict {
  id: string;
  type: string;
  scheduled_starts_at: string;
  scheduled_ends_at: string;
}

export async function findResourceConflicts(
  db: SupabaseClient,
  params: {
    tenantId: string;
    resourceId: string;
    startsAt: string;
    endsAt: string;
    excludeOperationId?: string;
  },
): Promise<ResourceConflict[]> {
  let query = db
    .from("operations")
    .select("id, type, scheduled_starts_at, scheduled_ends_at")
    .eq("tenant_id", params.tenantId)
    .eq("resource_id", params.resourceId)
    .in("status", BLOCKING_STATUSES)
    .is("deleted_at", null)
    // Standard interval-overlap: existing.start < new.end AND existing.end > new.start
    .lt("scheduled_starts_at", params.endsAt)
    .gt("scheduled_ends_at", params.startsAt);

  if (params.excludeOperationId) {
    query = query.neq("id", params.excludeOperationId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}
