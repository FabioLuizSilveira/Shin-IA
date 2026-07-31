import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeSessionClaims } from "@/lib/jwt-claims";
import { IMPERSONATION_COOKIE } from "@/lib/impersonation-cookie";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const claims = decodeSessionClaims(session.access_token);
  if (!claims.platform_role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    tenant_id?: string;
    reason?: string;
    access_mode?: "full" | "read_only";
  };
  if (!body.tenant_id || !body.reason?.trim()) {
    return NextResponse.json({ error: "tenant_id and reason are required" }, { status: 422 });
  }
  const accessMode = body.access_mode === "read_only" ? "read_only" : "full";

  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name")
    .eq("id", body.tenant_id)
    .maybeSingle();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  // Prefer an owner/admin tenant_role user so support access sees the same
  // thing a real tenant admin would; fall back to any user in the tenant.
  const { data: roleRows } = await admin
    .from("tenant_user_roles")
    .select("user_id, tenant_roles(key)")
    .eq("tenant_id", body.tenant_id)
    .is("deleted_at", null);

  const preferred = (roleRows ?? []).find((r) => {
    const role = r.tenant_roles as unknown as { key: string } | null;
    return role && ["owner", "admin"].includes(role.key);
  });

  let targetUserId = preferred?.user_id as string | undefined;

  if (!targetUserId) {
    const { data: anyProfile } = await admin
      .from("user_profiles")
      .select("id")
      .eq("tenant_id", body.tenant_id)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    targetUserId = anyProfile?.id;
  }

  if (!targetUserId) {
    return NextResponse.json({ error: "Tenant has no users to impersonate" }, { status: 422 });
  }

  const maxDurationMinutes = accessMode === "full" ? 240 : 120;

  const { data: created, error } = await admin
    .from("impersonation_sessions")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: body.tenant_id,
      platform_actor_id: session.user.id,
      target_user_id: targetUserId,
      target_tenant_id: body.tenant_id,
      reason: body.reason.trim(),
      access_mode: accessMode,
      status: "active",
      max_duration_minutes: maxDurationMinutes,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, created.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxDurationMinutes * 60,
  });

  return NextResponse.json({ data: { sessionId: created.id, tenantName: tenant.name } });
}
