import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShinaIdentity } from "./types.js";

interface RawAuthorizationContext {
  tenant_id: string | null;
  tenant_role: string | null;
  platform_role: string | null;
  mfa_enrolled: boolean | null;
  platform_subscription_status: string | null;
  mkt_subscription_status: string | null;
  platform_contract_current: boolean | null;
}

function unprovisionedIdentity(uid: string, email: string | null): ShinaIdentity {
  return {
    uid,
    email,
    tenantId: null,
    tenantRole: null,
    platformRole: null,
    mfaEnrolled: false,
    platformSubscriptionStatus: null,
    mktSubscriptionStatus: null,
    platformContractCurrent: false,
  };
}

// Resolves any external provider's subject (Firebase UID today) into a full
// ShinaIdentity via external_identities + resolve_shina_authorization_context
// (both added by supabase/migrations/20260095000000_identity_provider_abstraction.sql).
// An unknown subject — authenticated with the provider, but never linked to
// a Shinã identity — resolves to an "authenticated but unprovisioned"
// identity (every tenant/platform field null) rather than an error or an
// auto-granted tenant, per the migration spec's explicit rule: a new
// provider identity is never auto-provisioned into a tenant.
export async function resolveCanonicalIdentity(
  supabaseAdmin: SupabaseClient,
  provider: "firebase" | "supabase",
  providerSubject: string,
  email: string | null,
): Promise<ShinaIdentity> {
  const { data: link } = await supabaseAdmin
    .from("external_identities")
    .select("shina_user_id")
    .eq("provider", provider)
    .eq("provider_subject", providerSubject)
    .maybeSingle();

  if (!link) return unprovisionedIdentity(providerSubject, email);

  const shinaUserId = link.shina_user_id as string;

  await supabaseAdmin
    .from("external_identities")
    .update({ last_authenticated_at: new Date().toISOString() })
    .eq("provider", provider)
    .eq("provider_subject", providerSubject);

  const { data: ctx, error } = await supabaseAdmin.rpc("resolve_shina_authorization_context", {
    p_user_id: shinaUserId,
  });
  if (error) throw error;

  const raw = ctx as RawAuthorizationContext;
  return {
    uid: shinaUserId,
    email,
    tenantId: raw.tenant_id ?? null,
    tenantRole: raw.tenant_role ?? null,
    platformRole: raw.platform_role ?? null,
    mfaEnrolled: raw.mfa_enrolled ?? false,
    platformSubscriptionStatus: raw.platform_subscription_status ?? null,
    mktSubscriptionStatus: raw.mkt_subscription_status ?? null,
    platformContractCurrent: raw.platform_contract_current ?? false,
  };
}
