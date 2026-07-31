import type { SupabaseClient } from "@supabase/supabase-js";
import { provisionPlatformSubscription } from "@/lib/platform-subscription";

// System roles every tenant gets on creation — mirrors what the demo tenant
// (Acme Logística) already has. tenant_roles is a PER-TENANT table (each
// tenant owns its own copy of these rows, unlike the global tenant_permissions
// catalog) — a tenant created without this seed step gets zero roles, and
// custom_access_token_hook's role lookup silently returns tenant_role: null
// forever for every one of its users. This was confirmed as a real,
// previously-shipped bug: only the demo tenant had any tenant_roles rows at
// all; /api/tenants POST pointed every new tenant's admin at the demo
// tenant's own "tenant_admin" row (the hook's join happens to not check
// tenant_roles.tenant_id, so role *keys* resolved by accident — but the row
// itself belonged to a different tenant entirely).
const SYSTEM_ROLES = [
  { key: "tenant_owner", name: "Tenant Owner" },
  { key: "tenant_admin", name: "Tenant Administrator" },
  { key: "fleet_manager", name: "Fleet Manager" },
  { key: "operations_manager", name: "Operations Manager" },
] as const;

export interface ProvisionTenantInput {
  name: string;
  slug: string;
  plan: string;
  status: "trialing" | "active";
  branchName: string;
  branchCode: string;
  branchMetadata?: Record<string, unknown>;
  tenantMetadata?: Record<string, unknown>;
  adminEmail: string;
  adminFullName: string;
  /** Redirect after the admin accepts the invite email. */
  inviteRedirectTo: string;
}

export interface ProvisionTenantResult {
  tenantId: string;
  slug: string;
  inviteSent: boolean;
}

// Single provisioning path for both the public onboarding wizard and the
// platform-staff "create tenant" action — previously two independent,
// diverging implementations (see git history of api/tenants and
// api/onboarding/complete). Always invites the admin by email (magic-link
// style) rather than setting a password directly: the public login UI has
// no password field since the Shinã Identity passwordless-login change, so
// a directly-set password would have been permanently unusable.
export async function provisionTenant(
  admin: SupabaseClient,
  input: ProvisionTenantInput,
): Promise<ProvisionTenantResult> {
  const tenantId = crypto.randomUUID();

  const { error: tenantError } = await admin.from("tenants").insert({
    id: tenantId,
    name: input.name,
    slug: input.slug,
    plan: input.plan,
    status: input.status,
    metadata: input.tenantMetadata ?? {},
  });
  if (tenantError) throw new Error(`tenant insert failed: ${tenantError.message}`);

  const { error: branchError } = await admin.from("branches").insert({
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    name: input.branchName,
    code: input.branchCode,
    active: true,
    metadata: input.branchMetadata ?? {},
  });
  if (branchError) {
    await admin.from("tenants").delete().eq("id", tenantId);
    throw new Error(`branch insert failed: ${branchError.message}`);
  }

  const { data: roleRows, error: rolesError } = await admin
    .from("tenant_roles")
    .insert(
      SYSTEM_ROLES.map((r) => ({
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        key: r.key,
        name: r.name,
        is_system: true,
      })),
    )
    .select("id, key");
  if (rolesError) {
    await admin.from("tenants").delete().eq("id", tenantId);
    throw new Error(`system roles insert failed: ${rolesError.message}`);
  }
  const adminRoleId = roleRows.find((r) => r.key === "tenant_admin")!.id;

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    input.adminEmail,
    {
      data: { full_name: input.adminFullName, tenant_id: tenantId, role: "tenant_admin" },
      redirectTo: input.inviteRedirectTo,
    },
  );

  let authUserId = inviteData?.user?.id ?? null;
  if (inviteError) {
    // Most common cause: the email already has an auth.users row (e.g. an
    // existing platform user being made an admin of a new tenant) — link
    // the existing user instead of failing the whole provisioning flow.
    const { data: userList } = await admin.auth.admin.listUsers();
    authUserId = userList?.users?.find((u) => u.email === input.adminEmail)?.id ?? null;
  }

  if (authUserId) {
    const profileId = crypto.randomUUID();
    const { error: profileError } = await admin.from("user_profiles").insert({
      id: profileId,
      tenant_id: tenantId,
      auth_user_id: authUserId,
      email: input.adminEmail,
      full_name: input.adminFullName,
      status: "active",
    });
    if (!profileError) {
      await admin
        .from("tenant_user_roles")
        .insert({
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          user_id: profileId,
          role_id: adminRoleId,
        });
    } else {
      console.error("[tenant-provisioning] profile insert failed:", profileError);
    }

    await provisionPlatformSubscription(admin, {
      authUserId,
      email: input.adminEmail,
      tenantId,
      planKey: input.plan,
      status: input.status,
    });
  } else {
    console.error("[tenant-provisioning] could not resolve an auth user for", input.adminEmail);
  }

  return { tenantId, slug: input.slug, inviteSent: !inviteError };
}
