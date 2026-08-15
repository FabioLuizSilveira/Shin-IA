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

// First real consumer of tenant_role_permissions for actual access control
// (Unified Commercial Flow, Fase H) — every other route in this codebase
// checks a hardcoded role key via isTenantAdmin()/tenantRole comparisons;
// the tenant_permissions/tenant_role_permissions catalog previously only
// fed the tenant/studio admin UI (assigning permissions to custom roles had
// zero effect anywhere). tenant_owner/tenant_admin always pass (matches
// TENANT_ADMIN_ROLES's existing "owns everything" semantics) without a DB
// round trip; any other role is checked for real against the permission
// grant. Full-access impersonation bypasses like isTenantAdmin(); read-only
// impersonation never grants a mutating permission like this one.
export async function hasTenantPermission(scope: TenantScope, key: string): Promise<boolean> {
  if (scope.isImpersonating) return scope.accessMode === "full";
  if (scope.tenantRole && TENANT_ADMIN_ROLES.has(scope.tenantRole)) return true;

  // Two queries, not one PostgREST embed: tenant_user_roles and
  // tenant_role_permissions share a `role_id` column but there's no direct
  // FK between the two tables (both separately reference tenant_roles), so
  // PostgREST can't infer that join — confirmed the hard way, a
  // single-query embed here silently matched nothing.
  const { data: userRoles } = await scope.db
    .from("tenant_user_roles")
    .select("role_id")
    .eq("tenant_id", scope.tenantId)
    .eq("user_id", scope.userId)
    .is("deleted_at", null);
  const roleIds = (userRoles ?? []).map((r) => r.role_id);
  if (roleIds.length === 0) return false;

  const { data: grant } = await scope.db
    .from("tenant_role_permissions")
    .select("role_id, tenant_permissions!inner(key)")
    .in("role_id", roleIds)
    .eq("tenant_permissions.key", key)
    .limit(1)
    .maybeSingle();

  return !!grant;
}

// Lists every permission key actually granted to this user, for surfacing
// in UI (e.g. mobile bootstrap) — never used as an authorization decision
// itself, only hasTenantPermission()'s per-action check is. tenant_owner/
// tenant_admin implicitly hold the whole catalog (same short-circuit as
// hasTenantPermission), so their effective list is every key that exists;
// any other role's list is exactly what's been granted via tenant/studio.
export async function getEffectiveTenantPermissions(scope: TenantScope): Promise<string[]> {
  if (scope.isImpersonating && scope.accessMode !== "full") return [];
  if (scope.tenantRole && TENANT_ADMIN_ROLES.has(scope.tenantRole)) {
    const { data } = await scope.db.from("tenant_permissions").select("key").is("deleted_at", null);
    return (data ?? []).map((p) => p.key);
  }

  const { data: userRoles } = await scope.db
    .from("tenant_user_roles")
    .select("role_id")
    .eq("tenant_id", scope.tenantId)
    .eq("user_id", scope.userId)
    .is("deleted_at", null);
  const roleIds = (userRoles ?? []).map((r) => r.role_id);
  if (roleIds.length === 0) return [];

  const { data: grants } = await scope.db
    .from("tenant_role_permissions")
    .select("tenant_permissions!inner(key)")
    .in("role_id", roleIds);
  const keys = (grants ?? []).map(
    (g) => (g as unknown as { tenant_permissions: { key: string } }).tenant_permissions.key,
  );
  return Array.from(new Set(keys));
}

// Security fix (Obs-21): scope.db is always the service-role admin client
// (see the comment above requireTenantScope) — it bypasses RLS entirely,
// so a route's own `.eq("tenant_id", scope.tenantId)` is the *only* thing
// standing between a query and cross-tenant data, with no database-level
// backstop. Every route audited so far does remember it (see the security
// audit's IDOR findings — none confirmed), but that's discipline, not a
// guarantee: a single missed filter in a future route is an instant IDOR.
//
// These wrap the four mutation shapes so the tenant filter/injection lives
// in one place instead of being retyped at every call site — using them
// makes the tenant scope structurally impossible to forget, rather than
// relying on remembering to add it. Existing routes were not retrofitted
// (they're already correct, and touching ~80 verified-safe routes for a
// non-bug would be pure churn) — this is the recommended pattern for new
// tenant-scoped queries going forward.
export function scopedSelect(scope: TenantScope, table: string, columns = "*") {
  return scope.db.from(table).select(columns).eq("tenant_id", scope.tenantId);
}

export function scopedUpdate(scope: TenantScope, table: string, values: Record<string, unknown>) {
  return scope.db.from(table).update(values).eq("tenant_id", scope.tenantId);
}

export function scopedDelete(scope: TenantScope, table: string) {
  return scope.db.from(table).delete().eq("tenant_id", scope.tenantId);
}

export function scopedInsert(
  scope: TenantScope,
  table: string,
  values: Record<string, unknown> | Record<string, unknown>[],
) {
  const withTenant = Array.isArray(values)
    ? values.map((v) => ({ ...v, tenant_id: scope.tenantId }))
    : { ...values, tenant_id: scope.tenantId };
  return scope.db.from(table).insert(withTenant);
}
