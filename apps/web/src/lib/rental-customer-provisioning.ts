import type { SupabaseClient } from "@supabase/supabase-js";

export interface InviteRentalCustomerInput {
  tenantId: string;
  organizationId: string;
  email: string;
  fullName?: string;
  phone?: string;
  /** Deep link the mobile app registers, e.g. shinacustomer://auth/callback */
  inviteRedirectTo: string;
}

export interface InviteRentalCustomerResult {
  rentalCustomerId: string;
  authUserId: string | null;
  inviteSent: boolean;
  alreadyLinked: boolean;
}

// Staff-invite path for the rental customer mobile app (Fase 1 onboarding —
// see plan doc for the deferred marketplace self-signup alternative). Unlike
// provisionTenant(), this never creates JWT claims or role rows: rental
// customer authorization is entirely RLS-based (see
// 20260055000000_rental_customers.sql), so all this does is create/reuse the
// rental_customers identity, link it to the calling tenant's organization,
// and send an invite email pointed at the mobile app's deep link.
export async function inviteRentalCustomer(
  admin: SupabaseClient,
  input: InviteRentalCustomerInput,
): Promise<InviteRentalCustomerResult> {
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    input.email,
    {
      data: { full_name: input.fullName, role: "rental_customer" },
      redirectTo: input.inviteRedirectTo,
    },
  );

  let authUserId = inviteData?.user?.id ?? null;
  if (inviteError) {
    // Same fallback as tenant-provisioning.ts: the email may already have an
    // auth.users row (e.g. a customer who already rents from another
    // tenant) — link the existing identity instead of failing outright.
    const { data: userList } = await admin.auth.admin.listUsers();
    authUserId = userList?.users?.find((u) => u.email === input.email)?.id ?? null;
  }

  if (!authUserId) {
    throw new Error(
      `could not resolve an auth user for ${input.email}: ${inviteError?.message ?? "unknown error"}`,
    );
  }

  let { data: rentalCustomer, error: fetchError } = await admin
    .from("rental_customers")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (fetchError) throw new Error(`rental_customers lookup failed: ${fetchError.message}`);

  if (!rentalCustomer) {
    const { data: created, error: createError } = await admin
      .from("rental_customers")
      .insert({
        auth_user_id: authUserId,
        email: input.email,
        full_name: input.fullName,
        phone: input.phone,
      })
      .select("id")
      .single();
    if (createError) throw new Error(`rental_customers insert failed: ${createError.message}`);
    rentalCustomer = created;
  }

  const { data: existingLink } = await admin
    .from("rental_customer_organizations")
    .select("id")
    .eq("rental_customer_id", rentalCustomer.id)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (!existingLink) {
    const { error: linkError } = await admin.from("rental_customer_organizations").insert({
      rental_customer_id: rentalCustomer.id,
      tenant_id: input.tenantId,
      organization_id: input.organizationId,
    });
    if (linkError)
      throw new Error(`rental_customer_organizations insert failed: ${linkError.message}`);
  }

  return {
    rentalCustomerId: rentalCustomer.id,
    authUserId,
    inviteSent: !inviteError,
    alreadyLinked: !!existingLink,
  };
}
