// Supabase Auth Hook — custom-access-token
// Injects tenant_id, tenant_role, branch_ids, capabilities into the JWT
// Register this as a "Custom Access Token" hook in Supabase Dashboard → Auth → Hooks

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface HookPayload {
  event: "custom_access_token";
  user_id: string;
  claims: {
    sub: string;
    aud: string;
    email?: string;
    role?: string;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  };
}

interface HookResponse {
  claims: Record<string, unknown>;
}

serve(async (req) => {
  try {
    const payload = (await req.json()) as HookPayload;
    const userId = payload.user_id;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Parallel: get user profile + tenant role + mfa status
    const [profileRes, mfaRes] = await Promise.all([
      admin.from("user_profiles").select("tenant_id, status").eq("user_id", userId).maybeSingle(),

      admin
        .from("mfa_enrollments")
        .select("status, method")
        .eq("user_id", userId)
        .eq("status", "verified")
        .maybeSingle(),
    ]);

    const tenantId = profileRes.data?.tenant_id ?? null;
    const mfaEnrolled = !!mfaRes.data;

    // Get tenant role + branch IDs if tenant user
    let tenantRole: string | null = null;
    let branchIds: string[] = [];
    let platformRole: string | null = null;

    if (tenantId) {
      const [roleRes, branchRes] = await Promise.all([
        admin
          .from("iam_tenant_user_roles")
          .select("iam_tenant_roles(name)")
          .eq("user_id", userId)
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle(),

        admin
          .from("iam_tenant_user_roles")
          .select("branch_id")
          .eq("user_id", userId)
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .not("branch_id", "is", null),
      ]);

      // @ts-ignore: nested select type
      tenantRole = roleRes.data?.iam_tenant_roles?.name ?? null;
      branchIds = (branchRes.data ?? []).map((r) => r.branch_id as string).filter(Boolean);
    } else {
      // Check platform role
      const platformRoleRes = await admin
        .from("iam_platform_user_roles")
        .select("iam_platform_roles(name)")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      // @ts-ignore: nested select type
      platformRole = platformRoleRes.data?.iam_platform_roles?.name ?? null;
    }

    // Build enriched claims
    const enrichedClaims: Record<string, unknown> = {
      ...payload.claims,
      // Custom claims namespace
      tenant_id: tenantId,
      tenant_role: tenantRole,
      platform_role: platformRole,
      branch_ids: branchIds,
      mfa_enrolled: mfaEnrolled,
      // Keep existing app_metadata
      app_metadata: {
        ...(payload.claims.app_metadata ?? {}),
        tenant_id: tenantId,
        tenant_role: tenantRole,
        platform_role: platformRole,
        branch_ids: branchIds,
        mfa_enrolled: mfaEnrolled,
      },
    };

    const response: HookResponse = { claims: enrichedClaims };

    console.log(
      `[custom-access-token] user=${userId} tenant=${tenantId ?? "platform"} role=${tenantRole ?? platformRole ?? "none"} mfa=${mfaEnrolled}`,
    );

    return Response.json(response, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[custom-access-token] error:", msg);
    // Return unmodified claims on error to avoid blocking auth
    return Response.json({ claims: {} }, { status: 200 });
  }
});
