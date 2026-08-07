import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { inviteRentalCustomer } from "@/lib/rental-customer-provisioning";
import { MOBILE_APP_SCHEME } from "@/lib/domain";

export const dynamic = "force-dynamic";

// Rental customers linked to the same organization this contract belongs
// to — not to the contract itself (rental_customer_organizations links at
// the organization level, since one customer relationship covers all of an
// organization's contracts with the tenant).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data: contract, error: contractError } = await scope.db
    .from("contracts")
    .select("organization_id")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (contractError) return internalError(contractError);
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const { data, error } = await scope.db
    .from("rental_customer_organizations")
    .select("id, created_at, rental_customers(id, email, full_name, phone)")
    .eq("tenant_id", scope.tenantId)
    .eq("organization_id", contract.organization_id);
  if (error) return internalError(error);

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as { email?: string; full_name?: string; phone?: string };
  if (!body.email) {
    return NextResponse.json({ error: "email is required" }, { status: 422 });
  }

  const { data: contract, error: contractError } = await scope.db
    .from("contracts")
    .select("organization_id")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (contractError) return internalError(contractError);
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  try {
    const result = await inviteRentalCustomer(scope.db, {
      tenantId: scope.tenantId,
      organizationId: contract.organization_id,
      email: body.email,
      fullName: body.full_name,
      phone: body.phone,
      inviteRedirectTo: MOBILE_APP_SCHEME,
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to invite customer" },
      { status: 500 },
    );
  }
}
