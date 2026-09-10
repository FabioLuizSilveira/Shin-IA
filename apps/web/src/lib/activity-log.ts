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
    // Wave 1 (Intelligent Onboarding) — additive: lets a multi-step flow
    // (discovery → recommendation → contract → provisioning) be
    // reconstructed from one correlationId, and distinguishes a tenant
    // user from a Shinã operator (assisted sales) or the system. Every
    // pre-existing caller omits these and inserts NULLs, unchanged.
    actorType?: "tenant_user" | "shina_operator" | "system";
    correlationId?: string;
    sessionId?: string;
  },
): Promise<void> {
  const { error } = await db.from("tenant_activity_log").insert({
    tenant_id: entry.tenantId,
    actor_id: entry.actorId,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    action: entry.action,
    metadata: entry.metadata ?? {},
    actor_type: entry.actorType ?? null,
    correlation_id: entry.correlationId ?? null,
    session_id: entry.sessionId ?? null,
  });
  if (error) console.error("[activity-log]", error.message);
}
