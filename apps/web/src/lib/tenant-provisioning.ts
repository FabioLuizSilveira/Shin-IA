import type { SupabaseClient } from "@supabase/supabase-js";
import { provisionPlatformSubscription } from "@/lib/platform-subscription";
import {
  recordContractAcceptance,
  createCommercialCheckout,
  type RepresentativeInfo,
  type RequestContext,
} from "@shina/commercial-platform";
import { createBillingProvider } from "@shina/billing-platform";

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

// Present only for the public, login-first onboarding flow (Unified
// Commercial Flow). Absent for the platform-staff "create tenant" action
// (/api/tenants POST), which stays exactly as it was: instant activation,
// no checkout — that path is the deliberate manual/enterprise-vetted
// equivalent of billing_mode "manual_contract" (item 26), not something this
// refactor forces through Stripe.
export interface CommercialOnboardingInput {
  userId: string;
  email: string;
  planVersionId: string;
  representative: RepresentativeInfo;
  request: RequestContext;
  /** tenantId is appended as ?tenant_id=... once known (created inside this function). */
  successUrlBase: string;
  cancelUrl: string;
  /**
   * The company's own CPF/CNPJ (Step 1's cnpj, not the individual
   * representative's document) — the actual payer for a B2B subscription.
   * Required by document-based gateways (Asaas); ignored by Stripe.
   */
  document?: string;
  /** Billing address, collected once at signup — see CreateCommercialCheckoutInput's own comment for why this exists. */
  billingAddress?: {
    phone: string;
    address: string;
    addressNumber: string;
    postalCode: string;
    province: string;
  };
}

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
  /** Redirect after the admin accepts the invite email (non-commercial path only). */
  inviteRedirectTo: string;
  commercial?: CommercialOnboardingInput;
}

export interface ProvisionTenantResult {
  tenantId: string;
  slug: string;
  inviteSent: boolean;
  /** Present only when `commercial` was supplied — send the caller here next. */
  checkoutUrl?: string;
}

// Single provisioning path for the public onboarding wizard, the
// platform-staff "create tenant" action, AND (new) the commercial-flow
// checkout gate. Always invites the admin by email (magic-link style)
// rather than setting a password directly EXCEPT in the commercial-flow
// case, where the caller is already an authenticated auth.users row
// (login-first — see onboarding-wizard.tsx's AuthGate) and inviting them
// again would be redundant/wrong.
export async function provisionTenant(
  admin: SupabaseClient,
  input: ProvisionTenantInput,
): Promise<ProvisionTenantResult> {
  const tenantId = crypto.randomUUID();
  // Commercial-flow tenants start pending_payment — real activation only
  // happens when the Stripe webhook confirms (item 16: "webhook é fonte de
  // verdade"), never here and never from a success-page redirect.
  const initialStatus = input.commercial ? "pending_payment" : input.status;

  const { error: tenantError } = await admin.from("tenants").insert({
    id: tenantId,
    name: input.name,
    slug: input.slug,
    plan: input.plan,
    status: initialStatus,
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
  const ownerRoleId = roleRows.find((r) => r.key === "tenant_owner")!.id;
  const adminRoleId = roleRows.find((r) => r.key === "tenant_admin")!.id;

  let authUserId: string | null = null;
  let inviteSent = false;

  if (input.commercial) {
    // Already a real, authenticated identity — no invite round trip needed.
    authUserId = input.commercial.userId;
  } else {
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      input.adminEmail,
      {
        data: { full_name: input.adminFullName, tenant_id: tenantId, role: "tenant_admin" },
        redirectTo: input.inviteRedirectTo,
      },
    );

    authUserId = inviteData?.user?.id ?? null;
    if (inviteError) {
      // Most common cause: the email already has an auth.users row (e.g. an
      // existing platform user being made an admin of a new tenant) — link
      // the existing user instead of failing the whole provisioning flow.
      const { data: userList } = await admin.auth.admin.listUsers();
      authUserId = userList?.users?.find((u) => u.email === input.adminEmail)?.id ?? null;
    }
    inviteSent = !inviteError;
  }

  if (!authUserId) {
    console.error("[tenant-provisioning] could not resolve an auth user for", input.adminEmail);
    return { tenantId, slug: input.slug, inviteSent };
  }

  const profileId = crypto.randomUUID();
  const { error: profileError } = await admin.from("user_profiles").insert({
    id: profileId,
    tenant_id: tenantId,
    auth_user_id: authUserId,
    email: input.adminEmail,
    full_name: input.adminFullName,
    status: "active",
  });
  // The commercial-flow representative becomes tenant_owner (they're the one
  // who accepted the contract on the org's behalf); the staff-assisted path
  // keeps its existing tenant_admin default.
  const roleForAdmin = input.commercial ? ownerRoleId : adminRoleId;
  if (!profileError) {
    await admin.from("tenant_user_roles").insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      user_id: profileId,
      role_id: roleForAdmin,
    });
  } else {
    console.error("[tenant-provisioning] profile insert failed:", profileError);
  }

  if (!input.commercial) {
    await provisionPlatformSubscription(admin, {
      authUserId,
      email: input.adminEmail,
      tenantId,
      planKey: input.plan,
      status: input.status,
    });
    return { tenantId, slug: input.slug, inviteSent };
  }

  // ── Commercial flow: accept -> snapshot -> checkout. No subscription row
  // exists until the webhook creates one (see api/webhooks/stripe-commercial).
  try {
    const acceptance = await recordContractAcceptance(admin, {
      tenantId,
      userId: input.commercial.userId,
      product: "platform",
      planVersionId: input.commercial.planVersionId,
      representative: input.commercial.representative,
      request: input.commercial.request,
    });

    const billingProvider = createBillingProvider(admin);
    const { url } = await createCommercialCheckout(admin, billingProvider, {
      tenantId,
      userId: input.commercial.userId,
      email: input.commercial.email,
      product: "platform",
      planVersionId: input.commercial.planVersionId,
      contractAcceptanceId: acceptance.contractAcceptanceId,
      commercialTermsSnapshotId: acceptance.commercialTermsSnapshotId,
      successUrl: `${input.commercial.successUrlBase}?tenant_id=${tenantId}`,
      cancelUrl: input.commercial.cancelUrl,
      customerName: input.commercial.representative.name,
      customerDocument: input.commercial.document,
      phone: input.commercial.billingAddress?.phone,
      address: input.commercial.billingAddress?.address,
      addressNumber: input.commercial.billingAddress?.addressNumber,
      postalCode: input.commercial.billingAddress?.postalCode,
      province: input.commercial.billingAddress?.province,
    });

    return { tenantId, slug: input.slug, inviteSent, checkoutUrl: url };
  } catch (err) {
    // Roll back the pending tenant entirely — a tenant stuck in
    // pending_payment with no way to ever reach checkout is worse than no
    // tenant at all.
    await admin.from("tenants").delete().eq("id", tenantId);
    throw err;
  }
}
