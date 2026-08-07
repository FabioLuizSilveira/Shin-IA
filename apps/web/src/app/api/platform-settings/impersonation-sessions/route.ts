import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformRole } from "@/lib/platform-guard";

export const dynamic = "force-dynamic";

interface SessionRow {
  id: string;
  target_tenant_id: string;
  platform_actor_id: string;
  target_user_id: string;
  reason: string;
  access_mode: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  max_duration_minutes: number;
}

export async function GET() {
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createAdminClient();

  const { data: sessions, error } = await admin
    .from("impersonation_sessions")
    .select(
      "id, target_tenant_id, platform_actor_id, target_user_id, reason, access_mode, status, started_at, ended_at, max_duration_minutes",
    )
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .limit(200);
  if (error) return internalError(error);

  const rows = (sessions ?? []) as SessionRow[];
  const tenantIds = [...new Set(rows.map((r) => r.target_tenant_id))];
  const userIds = [...new Set(rows.map((r) => r.target_user_id))];
  const actorIds = [...new Set(rows.map((r) => r.platform_actor_id))];

  const [tenantsRes, profilesRes, actors] = await Promise.all([
    tenantIds.length > 0
      ? admin.from("tenants").select("id, name").in("id", tenantIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length > 0
      ? admin.from("user_profiles").select("id, full_name, email").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    Promise.all(
      actorIds.map(async (id) => {
        const { data } = await admin.auth.admin.getUserById(id);
        return { id, email: data.user?.email ?? id };
      }),
    ),
  ]);

  const tenantById = new Map((tenantsRes.data ?? []).map((t) => [t.id, t.name]));
  const profileById = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, { name: p.full_name, email: p.email }]),
  );
  const actorEmailById = new Map(actors.map((a) => [a.id, a.email]));

  const data = rows.map((r) => {
    const expiresAt = new Date(r.started_at).getTime() + r.max_duration_minutes * 60_000;
    const isEffectivelyExpired = r.status === "active" && Date.now() > expiresAt;
    return {
      id: r.id,
      tenant_name: tenantById.get(r.target_tenant_id) ?? r.target_tenant_id,
      actor_email: actorEmailById.get(r.platform_actor_id) ?? r.platform_actor_id,
      target_user_name: profileById.get(r.target_user_id)?.name ?? null,
      target_user_email: profileById.get(r.target_user_id)?.email ?? null,
      reason: r.reason,
      access_mode: r.access_mode,
      status: isEffectivelyExpired ? "expired" : r.status,
      started_at: r.started_at,
      ended_at: r.ended_at,
    };
  });

  return NextResponse.json({ data });
}
