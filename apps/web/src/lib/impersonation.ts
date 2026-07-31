import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { IMPERSONATION_COOKIE } from "@/lib/impersonation-cookie";

export { IMPERSONATION_COOKIE };

export interface ActiveImpersonation {
  sessionId: string;
  tenantId: string;
  targetUserId: string;
  accessMode: "full" | "read_only";
  reason: string;
  startedAt: string;
  maxDurationMinutes: number;
}

// impersonation_sessions has no insert/update RLS policy — only a select
// policy scoped to the target tenant's own admins — so every write goes
// through the service-role admin client, same pattern as platform_settings.
export async function getActiveImpersonation(
  platformActorId: string,
): Promise<ActiveImpersonation | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  if (!sessionId) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("impersonation_sessions")
    .select(
      "id, target_tenant_id, target_user_id, access_mode, reason, status, started_at, max_duration_minutes",
    )
    .eq("id", sessionId)
    .eq("platform_actor_id", platformActorId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data || data.status !== "active") return null;

  const expiresAt =
    new Date(data.started_at).getTime() + (data.max_duration_minutes ?? 240) * 60_000;
  if (Date.now() > expiresAt) return null;

  return {
    sessionId: data.id,
    tenantId: data.target_tenant_id,
    targetUserId: data.target_user_id,
    accessMode: data.access_mode as "full" | "read_only",
    reason: data.reason,
    startedAt: data.started_at,
    maxDurationMinutes: data.max_duration_minutes ?? 240,
  };
}
