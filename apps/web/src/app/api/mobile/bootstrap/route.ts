import { NextResponse } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { createStudioRuntime } from "@/lib/studio-runtime-factory";
import { getEffectiveTenantPermissions } from "@/lib/tenant-context";
import { getEntitlements } from "@shina/commercial-platform";

export const dynamic = "force-dynamic";

// Wave 1 — the first official Mobile BFF endpoint. Aggregates identity +
// tenant/customer/operator context + branding + effective permissions +
// entitlements into one call, exactly per the pipeline mandated in Wave 0:
// authenticate -> resolve identity -> resolve userType -> resolve context
// -> (permission checks happen in mutating routes, not here — bootstrap is
// read-only) -> respond. Every field is derived server-side from tables
// already established as the source of truth (custom_access_token_hook's
// claims, rental_customers/rental_customer_organizations, operators,
// tenant_role_permissions, platform_subscriptions) — nothing here is a new
// authorization decision, it's a read-only projection of decisions other
// already-audited code makes.
const SCHEMA_VERSION = 1;

// Wave 0.2: unprovisioned users get generic Shinã branding, never a
// specific tenant's — they aren't associated with one.
const DEFAULT_BRANDING = { name: "Shinã" };

export async function GET() {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  if (context.userType === "tenant_user") {
    const [tenantResult, brandingVersion, permissions, entitlements] = await Promise.all([
      context.db.from("tenants").select("id, name, slug").eq("id", context.tenantId).maybeSingle(),
      createStudioRuntime(context.db)
        .getPublished("branding", context.tenantId)
        .catch(() => null),
      getEffectiveTenantPermissions(context),
      getEntitlements(context.db, { tenantId: context.tenantId, product: "platform" }).catch(
        () => ({ active: false, features: [] as string[], planKey: null }),
      ),
    ]);

    return NextResponse.json({
      data: {
        schemaVersion: SCHEMA_VERSION,
        user: { id: context.userId, email: context.email, userType: "tenant_user" },
        tenant: tenantResult.data
          ? { id: tenantResult.data.id, name: tenantResult.data.name, slug: tenantResult.data.slug }
          : null,
        branding: brandingVersion?.config ?? null,
        roles: context.tenantRole ? [context.tenantRole] : [],
        permissions,
        entitlements: entitlements.features,
        features: Object.fromEntries(entitlements.features.map((f) => [f, true])),
      },
    });
  }

  if (context.userType === "operator") {
    const [tenantResult, brandingVersion, entitlements] = await Promise.all([
      context.db.from("tenants").select("id, name, slug").eq("id", context.tenantId).maybeSingle(),
      createStudioRuntime(context.db)
        .getPublished("branding", context.tenantId)
        .catch(() => null),
      getEntitlements(context.db, { tenantId: context.tenantId, product: "platform" }).catch(
        () => ({ active: false, features: [] as string[], planKey: null }),
      ),
    ]);

    return NextResponse.json({
      data: {
        schemaVersion: SCHEMA_VERSION,
        user: { id: context.userId, email: context.email, userType: "operator" },
        tenant: tenantResult.data
          ? { id: tenantResult.data.id, name: tenantResult.data.name, slug: tenantResult.data.slug }
          : null,
        branding: brandingVersion?.config ?? null,
        // Operators aren't tenant staff — they have no tenant_user_roles
        // row, so no IAM role/permission set applies to them (Wave 0.7:
        // permission checks for operator-facing mutations are enforced by
        // the routes that need them directly, e.g. the existing
        // acknowledge-terms route's own manual checks — not by a role list
        // here that doesn't exist for this identity).
        roles: [],
        permissions: [],
        entitlements: entitlements.features,
        features: Object.fromEntries(entitlements.features.map((f) => [f, true])),
      },
    });
  }

  if (context.userType === "customer") {
    // A rental customer can belong to more than one tenant
    // (rental_customer_organizations is N:N) — there is no single "the"
    // tenant to resolve branding/entitlements against, so bootstrap
    // returns the organization memberships themselves and leaves
    // per-tenant detail to a future customer-contracts-style call, rather
    // than guessing which one the client wants (item 1.4: "não adicionar
    // tenant_id artificial").
    return NextResponse.json({
      data: {
        schemaVersion: SCHEMA_VERSION,
        user: { id: context.userId, email: context.email, userType: "customer" },
        tenant: null,
        branding: null,
        roles: [],
        permissions: [],
        entitlements: [],
        features: {},
        organizations: context.organizations,
      },
    });
  }

  // unprovisioned (Wave 0.2) — authenticated, but no tenant/customer/
  // operator membership found anywhere. No tenant-scoped data of any kind
  // is queried for this branch.
  return NextResponse.json({
    data: {
      schemaVersion: SCHEMA_VERSION,
      user: { id: context.userId, email: context.email, userType: "unprovisioned" },
      tenant: null,
      branding: DEFAULT_BRANDING,
      roles: [],
      permissions: [],
      entitlements: [],
      features: {},
    },
  });
}
