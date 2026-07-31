import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeSessionClaims } from "@/lib/jwt-claims";
import { getActiveImpersonation } from "@/lib/impersonation";

export interface TenantScope {
  tenantId: string;
  userId: string;
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
