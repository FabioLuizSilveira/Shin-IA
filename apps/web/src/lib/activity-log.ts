import type { SupabaseClient } from "@supabase/supabase-js";

// M31 gap — general tenant activity feed (see supabase/migrations/20260056000000).
// Call after a mutation succeeds; never let a logging failure fail the
// mutation itself (console.error + swallow, same posture as
// create-notification.ts's own error handling).
export async function logActivity(
  db: SupabaseClient,
  entry: {
    tenantId: string;
    actorId: string;
    entityType: string;
    entityId: string;
    action: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await db.from("tenant_activity_log").insert({
    tenant_id: entry.tenantId,
    actor_id: entry.actorId,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    action: entry.action,
    metadata: entry.metadata ?? {},
  });
  if (error) console.error("[activity-log]", error.message);
}
