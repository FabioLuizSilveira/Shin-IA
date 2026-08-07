import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeSessionClaims } from "@/lib/jwt-claims";

export type NextHandler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) => Promise<NextResponse> | NextResponse;

// Permission → allowed tenant roles (simplified RBAC matrix)
// Full matrix lives in docs/ACCESS_MATRIX.md
const ROLE_PERMISSIONS: Record<string, string[]> = {
  "operations:read": [
    "tenant_owner",
    "tenant_admin",
    "fleet_manager",
    "operations_manager",
    "supervisor",
    "operator",
    "driver",
  ],
  "operations:write": [
    "tenant_owner",
    "tenant_admin",
    "fleet_manager",
    "operations_manager",
    "supervisor",
  ],
  "assets:read": [
    "tenant_owner",
    "tenant_admin",
    "fleet_manager",
    "operations_manager",
    "supervisor",
    "operator",
  ],
  "assets:write": ["tenant_owner", "tenant_admin", "fleet_manager"],
  "tracking:read": [
    "tenant_owner",
    "tenant_admin",
    "fleet_manager",
    "operations_manager",
    "supervisor",
    "operator",
  ],
  "tracking:write": ["tenant_owner", "tenant_admin", "fleet_manager"],
  "crm:read": ["tenant_owner", "tenant_admin", "commercial_manager", "supervisor"],
  "crm:write": ["tenant_owner", "tenant_admin", "commercial_manager"],
  "financial:read": ["tenant_owner", "tenant_admin", "financial_manager"],
  "financial:write": ["tenant_owner", "tenant_admin", "financial_manager"],
  "commissions:read": [
    "tenant_owner",
    "tenant_admin",
    "financial_manager",
    "commercial_manager",
    "supervisor",
  ],
  "commissions:write": ["tenant_owner", "tenant_admin", "financial_manager"],
  "commissions:approve": ["tenant_owner", "tenant_admin", "financial_manager"],
  "contracts:read": ["tenant_owner", "tenant_admin", "commercial_manager", "supervisor"],
  "contracts:write": ["tenant_owner", "tenant_admin", "commercial_manager"],
  "settings:read": ["tenant_owner", "tenant_admin"],
  "settings:write": ["tenant_owner", "tenant_admin"],
  "iam:read": ["tenant_owner", "tenant_admin"],
  "iam:write": ["tenant_owner"],
  "reports:read": [
    "tenant_owner",
    "tenant_admin",
    "financial_manager",
    "fleet_manager",
    "commercial_manager",
  ],
};

// Security fix (Obs-20): this file was dead code (never imported by any
// route) with three real bugs, found while investigating whether it was
// safe to wire up — fixed rather than left broken, since dead-but-broken
// code is worse than dead-but-correct code for whoever adopts this next.
//   1. Read tenant_id/tenant_role from getUser()'s user.app_metadata, which
//      reflects auth.users' stored column, not the claims
//      custom_access_token_hook injects into the issued JWT (see
//      jwt-claims.ts) — this would have always seen stale/missing values.
//      Now decodes the session's access token instead, matching the
//      pattern every other tenant-scoped route in this codebase uses.
//   2. ROLE_PERMISSIONS used role keys "owner"/"admin" that don't match
//      the real system role keys "tenant_owner"/"tenant_admin" (same class
//      of bug as the MFA_REQUIRED_ROLES and impersonation-preferred-role
//      issues found elsewhere in the security audit) — fixed to the real
//      keys; the other entries (financial_manager, commercial_manager,
//      supervisor, operator, driver) are tenant-created custom roles, not
//      system-seeded ones, so their names are left as-is.
//   3. The DB fallback queried iam_tenant_user_roles/iam_tenant_roles,
//      which don't exist — the real tables are tenant_user_roles/
//      tenant_roles (no iam_ prefix), and "active" is
//      deleted_at is null + expires_at not yet passed, not an is_active
//      column that was never in the schema.
//
// Still not imported by any route — this is a correctness fix for
// whichever route adopts it next, not a retroactive rewrite of the
// isTenantAdmin()-based gates already in place and verified elsewhere.
export function withPermission(permission: string, handler: NextHandler): NextHandler {
  return async (req, ctx) => {
    const supabase = await createServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const claims = decodeSessionClaims(session.access_token);
    const tenantId = claims.tenant_id;
    const tenantRole = claims.tenant_role ?? undefined;

    if (!tenantId) {
      return NextResponse.json({ error: "No tenant context" }, { status: 403 });
    }

    // Fast path: check role from JWT claim (no DB query) — only covers
    // system roles, since custom_access_token_hook only ever resolves
    // tenant_role from tenant_roles.key, which is null for custom roles.
    const allowedRoles = ROLE_PERMISSIONS[permission] ?? [];
    if (tenantRole && allowedRoles.includes(tenantRole)) {
      return handler(req, ctx);
    }

    // Fallback: check DB directly (handles custom roles, whose key is
    // null and so never appears in the JWT claim above).
    const admin = createAdminClient();
    const { data: roleRow } = await admin
      .from("tenant_user_roles")
      .select("tenant_roles(key, name)")
      .eq("user_id", session.user.id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .maybeSingle();

    const role = roleRow?.tenant_roles as unknown as { key: string | null; name: string } | null;
    const dbRole = role?.key ?? role?.name;

    if (!dbRole || !allowedRoles.includes(dbRole)) {
      return NextResponse.json(
        { error: `Forbidden: requires permission '${permission}'` },
        { status: 403 },
      );
    }

    return handler(req, ctx);
  };
}

// Helper to get tenant context from request (for use inside handlers)
export async function getTenantContext(_req: NextRequest): Promise<{
  userId: string;
  tenantId: string;
  role: string | null;
} | null> {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  const claims = decodeSessionClaims(session.access_token);
  if (!claims.tenant_id) return null;

  return {
    userId: session.user.id,
    tenantId: claims.tenant_id,
    role: claims.tenant_role ?? null,
  };
}
