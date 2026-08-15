import { NextResponse } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { internalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// Wave 2 Phase D — a self-context endpoint, not a generic customer lookup:
// there is no client-supplied customer_id anywhere in this route, only
// context.customerId (resolved server-side by requireMobileContext() from
// auth.uid(), never trusted from the request). Tenant staff already have a
// customer-listing view via the existing /api/organizations route (reused,
// not duplicated) — this route exists only because customer identities have
// no path into that route at all (requireTenantScope() rejects them
// structurally, same justification as every other api/mobile/* route this
// wave).
export async function GET() {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: profile, error: profileError } = await context.db
    .from("rental_customers")
    .select("id, full_name, email, phone, created_at")
    .eq("id", context.customerId)
    .maybeSingle();
  if (profileError) return internalError(profileError);
  if (!profile) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const organizationIds = context.organizations.map((o) => o.organizationId);
  const { data: organizations, error: orgError } =
    organizationIds.length > 0
      ? await context.db
          .from("organizations")
          .select("id, name, trade_name")
          .in("id", organizationIds)
      : { data: [] as { id: string; name: string; trade_name: string | null }[], error: null };
  if (orgError) return internalError(orgError);

  const { data: contracts, error: contractsError } =
    organizationIds.length > 0
      ? await context.db
          .from("contracts")
          .select(
            "id, type, status, value_amount, value_currency, period_starts_at, period_ends_at, organization_id",
          )
          .in("organization_id", organizationIds)
          .is("deleted_at", null)
      : { data: [] as unknown[], error: null };
  if (contractsError) return internalError(contractsError);

  return NextResponse.json({
    data: {
      profile,
      organizations: organizations ?? [],
      contracts: contracts ?? [],
    },
  });
}
