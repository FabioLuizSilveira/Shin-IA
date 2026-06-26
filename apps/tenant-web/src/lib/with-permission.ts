import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type NextHandler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) => Promise<NextResponse> | NextResponse;

// Permission → allowed tenant roles (simplified RBAC matrix)
// Full matrix lives in docs/ACCESS_MATRIX.md
const ROLE_PERMISSIONS: Record<string, string[]> = {
  "operations:read": [
    "owner",
    "admin",
    "fleet_manager",
    "operations_manager",
    "supervisor",
    "operator",
    "driver",
  ],
  "operations:write": ["owner", "admin", "fleet_manager", "operations_manager", "supervisor"],
  "assets:read": [
    "owner",
    "admin",
    "fleet_manager",
    "operations_manager",
    "supervisor",
    "operator",
  ],
  "assets:write": ["owner", "admin", "fleet_manager"],
  "tracking:read": [
    "owner",
    "admin",
    "fleet_manager",
    "operations_manager",
    "supervisor",
    "operator",
  ],
  "tracking:write": ["owner", "admin", "fleet_manager"],
  "crm:read": ["owner", "admin", "commercial_manager", "supervisor"],
  "crm:write": ["owner", "admin", "commercial_manager"],
  "financial:read": ["owner", "admin", "financial_manager"],
  "financial:write": ["owner", "admin", "financial_manager"],
  "commissions:read": ["owner", "admin", "financial_manager", "commercial_manager", "supervisor"],
  "commissions:write": ["owner", "admin", "financial_manager"],
  "commissions:approve": ["owner", "admin", "financial_manager"],
  "contracts:read": ["owner", "admin", "commercial_manager", "supervisor"],
  "contracts:write": ["owner", "admin", "commercial_manager"],
  "settings:read": ["owner", "admin"],
  "settings:write": ["owner", "admin"],
  "iam:read": ["owner", "admin"],
  "iam:write": ["owner"],
  "reports:read": ["owner", "admin", "financial_manager", "fleet_manager", "commercial_manager"],
};

export function withPermission(permission: string, handler: NextHandler): NextHandler {
  return async (req, ctx) => {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.app_metadata?.tenant_id as string | undefined;
    const tenantRole = user.app_metadata?.tenant_role as string | undefined;

    if (!tenantId) {
      return NextResponse.json({ error: "No tenant context" }, { status: 403 });
    }

    // Fast path: check role from JWT claim (no DB query)
    const allowedRoles = ROLE_PERMISSIONS[permission] ?? [];
    if (tenantRole && allowedRoles.includes(tenantRole)) {
      return handler(req, ctx);
    }

    // Fallback: check DB (handles delegated access and custom roles)
    const admin = createAdminClient();
    const { data: roleRow } = await admin
      .from("iam_tenant_user_roles")
      .select("iam_tenant_roles(name)")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .maybeSingle();

    // @ts-ignore: nested select
    const dbRole: string | undefined = roleRow?.iam_tenant_roles?.name;

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
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) return null;

  return {
    userId: user.id,
    tenantId,
    role: (user.app_metadata?.tenant_role as string | null) ?? null,
  };
}
