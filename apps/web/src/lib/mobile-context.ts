import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { identityProvider } from "@/lib/identity";
import { type SessionClaims } from "@/lib/jwt-claims";
import { getActiveImpersonation } from "@/lib/impersonation";

// Wave 0.4 — the mobile equivalent of TenantScope (tenant-context.ts), but
// covering all four identities the mobile app can authenticate as. This is
// deliberately a tagged union, not one loose object with optional fields —
// a route that destructures `{ tenantId }` from an UnprovisionedMobileContext
// should fail to compile, not silently get `undefined`.
export type UserType = "tenant_user" | "customer" | "operator" | "unprovisioned";

export interface TenantUserMobileContext {
  userType: "tenant_user";
  userId: string;
  email: string | null;
  tenantId: string;
  tenantRole: string | null;
  isImpersonating: boolean;
  accessMode: "full" | "read_only";
  db: SupabaseClient;
}

export interface CustomerOrganizationLink {
  organizationId: string;
  tenantId: string;
}

export interface CustomerMobileContext {
  userType: "customer";
  userId: string;
  email: string | null;
  customerId: string;
  organizations: CustomerOrganizationLink[];
  db: SupabaseClient;
}

export interface OperatorMobileContext {
  userType: "operator";
  userId: string;
  email: string | null;
  operatorId: string;
  tenantId: string;
  db: SupabaseClient;
}

export interface UnprovisionedMobileContext {
  userType: "unprovisioned";
  userId: string;
  email: string | null;
}

export type MobileContext =
  | TenantUserMobileContext
  | CustomerMobileContext
  | OperatorMobileContext
  | UnprovisionedMobileContext;

export interface MobileContextError {
  error: string;
  status: number;
}

// The pure resolution step — given an already-verified session's claims and
// a service-role db client, decides which of the four identities applies.
// Split out from requireMobileContext() (which does the actual session
// fetch) purely so this decision logic is unit-testable without a Next.js
// request context: every branch here is driven only by `claims`/`userId`
// (never by anything a request body could contain), which is exactly the
// property the "forged tenant_id" security tests assert.
export async function resolveMobileContext(input: {
  claims: SessionClaims;
  userId: string;
  email: string | null;
  db: SupabaseClient;
}): Promise<MobileContext> {
  const { claims, userId, email, db } = input;

  // tenant_id/platform_role only ever come from the JWT claims (injected
  // server-side by custom_access_token_hook) — never from a header, query
  // param, or body field. This mirrors requireTenantScope() exactly rather
  // than re-deriving tenant membership, so a tenant_user mobile context has
  // identical trust guarantees to every existing staff route.
  if (claims.tenant_id) {
    return {
      userType: "tenant_user",
      userId,
      email,
      tenantId: claims.tenant_id,
      tenantRole: claims.tenant_role ?? null,
      isImpersonating: false,
      accessMode: "full",
      db,
    };
  }

  if (claims.platform_role) {
    const impersonation = await getActiveImpersonation(userId);
    if (impersonation) {
      return {
        userType: "tenant_user",
        userId,
        email,
        tenantId: impersonation.tenantId,
        tenantRole: null,
        isImpersonating: true,
        accessMode: impersonation.accessMode,
        db,
      };
    }
    // Platform staff with no active impersonation session isn't a supported
    // mobile identity this wave (the mobile app targets tenant staff/
    // customers/operators, not platform admins) — falls through to the
    // customer/operator/unprovisioned checks below like any other user.
  }

  // rental_customers/operators carry no tenant/role claim at all (the auth
  // hook has no knowledge of either table — confirmed in the mobile API
  // audit), so these two identities are resolved by querying, never by
  // decoding anything from the token.
  const { data: customer } = await db
    .from("rental_customers")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (customer) {
    const { data: links } = await db
      .from("rental_customer_organizations")
      .select("organization_id, tenant_id")
      .eq("rental_customer_id", customer.id);
    if (links && links.length > 0) {
      return {
        userType: "customer",
        userId,
        email,
        customerId: customer.id,
        organizations: links.map((l) => ({
          organizationId: l.organization_id,
          tenantId: l.tenant_id,
        })),
        db,
      };
    }
    // A rental_customers row with zero organization links has no valid
    // vínculo — per Wave 0.2, that's unprovisioned, not "customer with an
    // empty list": there is nothing this identity can access either way,
    // but the type should say so honestly rather than imply a working
    // customer session.
  }

  const { data: operator } = await db
    .from("operators")
    .select("id, tenant_id")
    .eq("auth_user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (operator) {
    return {
      userType: "operator",
      userId,
      email,
      operatorId: operator.id,
      tenantId: operator.tenant_id,
      db,
    };
  }

  return { userType: "unprovisioned", userId, email };
}

// The route-facing entry point — fetches and verifies the caller's identity,
// then delegates to resolveMobileContext(). Every mobile route calls this
// first, per the mandatory pipeline (Wave 0.3): authenticate -> resolve
// identity -> resolve user type -> resolve tenant/customer/operator context.
// Permission checks and scope enforcement happen after this, in the route
// itself, using hasTenantPermission()/scopedSelect() etc. for tenant_user
// contexts (TenantUserMobileContext is structurally identical to
// TenantScope, so those functions accept it directly with no adapter
// needed).
//
// Two auth transports are supported:
//   - Authorization: Bearer <token> — the ONLY transport a real React
//     Native client can use (it has no cookie jar at all, unlike a
//     browser). Found live in production: every /api/mobile/* call from
//     the built Android app 401'd until this path was added, because
//     createClient()'s cookie-only session read never sees a bearer
//     header. The token is verified with a real call to Supabase Auth
//     (auth.getUser(token)) — never trusted from decodeSessionClaims()
//     alone, which only decodes, it doesn't verify a signature.
//   - Cookie-based session (createClient() + getSession()) — the existing
//     browser/web path, unchanged, still used by any web-based testing of
//     these same routes.
export async function requireMobileContext(): Promise<MobileContext | MobileContextError> {
  const headerStore = await headers();
  const authHeader = headerStore.get("authorization");
  const bearerToken = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice("bearer ".length).trim()
    : null;

  const db = createAdminClient();

  const session = bearerToken
    ? await identityProvider.getSessionFromBearerToken(bearerToken)
    : await identityProvider.getSessionFromCookies();
  if (!session) return { error: "Unauthorized", status: 401 };

  const { uid: userId, email, tenantId, tenantRole, platformRole } = session.identity;
  const claims: SessionClaims = {
    tenant_id: tenantId,
    tenant_role: tenantRole,
    platform_role: platformRole,
  };

  return resolveMobileContext({ claims, userId, email, db });
}

export function isUnprovisioned(context: MobileContext): context is UnprovisionedMobileContext {
  return context.userType === "unprovisioned";
}
