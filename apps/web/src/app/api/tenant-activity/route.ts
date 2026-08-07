import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("tenant_activity_log")
    .select("id, actor_id, entity_type, entity_id, action, metadata, created_at")
    .eq("tenant_id", scope.tenantId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return internalError(error);

  const actorIds = [...new Set((data ?? []).map((row) => row.actor_id))];
  const { data: actors } = await scope.db
    .from("user_profiles")
    .select("auth_user_id, full_name, email")
    .in("auth_user_id", actorIds);
  const actorMap = new Map((actors ?? []).map((a) => [a.auth_user_id, a]));

  const enriched = (data ?? []).map((row) => ({
    ...row,
    actor_name: actorMap.get(row.actor_id)?.full_name ?? actorMap.get(row.actor_id)?.email ?? null,
  }));

  return NextResponse.json({ data: enriched });
}
