import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeSessionClaims } from "@/lib/jwt-claims";
import { getActiveImpersonation } from "@/lib/impersonation";

export interface TenantScope {
  tenantId: string;
  userId: string;
  tenantRole: string | null;
  isImpersonating: boolean;
  accessMode: "full" | "read_only";
  db: SupabaseClient;
}

// Every tenant-scoped route resolves its scope through here instead of
// trusting RLS on the plain session client — a platform admin impersonating
// a tenant has no tenant_id in their own JWT, so RLS alone would return zero
// rows for them. Using the admin client with an explicit tenant_id filter
// works identically for a real tenant user and for an impersonating platform
// admin, so individual routes don't need two code paths.
export async function requireTenantScope(): Promise<
  TenantScope | { error: string; status: number }
> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { error: "Unauthorized", status: 401 };

  const claims = decodeSessionClaims(session.access_token);

  if (claims.tenant_id) {
    return {
      tenantId: claims.tenant_id,
      userId: session.user.id,
      tenantRole: claims.tenant_role ?? null,
      isImpersonating: false,
      accessMode: "full",
      db: createAdminClient(),
    };
  }

  if (claims.platform_role) {
    const impersonation = await getActiveImpersonation(session.user.id);
    if (!impersonation) {
      return { error: "No active tenant context — start impersonation first", status: 403 };
    }
    return {
      tenantId: impersonation.tenantId,
      userId: session.user.id,
      tenantRole: null,
      isImpersonating: true,
      accessMode: impersonation.accessMode,
      db: createAdminClient(),
    };
  }

  return { error: "Forbidden", status: 403 };
}

export function isReadOnlyScope(scope: TenantScope): boolean {
  return scope.isImpersonating && scope.accessMode === "read_only";
}

// tenant_owner/tenant_admin are the only system roles meant to manage
// tenant-wide config (see lib/tenant-provisioning.ts's SYSTEM_ROLES — a
// tenant can also create custom roles via tenant/studio with other keys,
// which don't qualify here). A platform admin in full-access impersonation
// is treated as admin-equivalent, matching how the subscription gate
// already bypasses tenant-specific restrictions for full impersonation —
// read-only impersonation is not.
const TENANT_ADMIN_ROLES = new Set(["tenant_owner", "tenant_admin"]);

export function isTenantAdmin(scope: TenantScope): boolean {
  if (scope.isImpersonating) return scope.accessMode === "full";
  return scope.tenantRole !== null && TENANT_ADMIN_ROLES.has(scope.tenantRole);
}
