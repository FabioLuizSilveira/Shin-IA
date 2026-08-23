import { NextResponse, type NextRequest } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { internalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// GET/POST /api/mobile/customer/contracts/[id]/service-requests — web
// customer portal's RLS→API migration (rentals-portal.ts's
// fetchServiceRequests/createServiceRequest). rental_customer_id and
// tenant_id come from context, never from the request body — the old RLS
// insert policy trusted rental_customer_id from the row itself (validated
// against auth.uid() at insert time by Postgres); this route reproduces
// that same trust boundary in application code instead.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id: contractId } = await params;

  const { data, error } = await context.db
    .from("rental_service_requests")
    .select("id, type, message, status, created_at")
    .eq("contract_id", contractId)
    .eq("rental_customer_id", context.customerId)
    .order("created_at", { ascending: false });
  if (error) return internalError(error);

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id: contractId } = await params;

  const body = await req.json().catch(() => null);
  const type = body?.type as string | undefined;
  const message = body?.message as string | undefined;
  if (type !== "extension" && type !== "issue") {
    return NextResponse.json({ error: "type must be 'extension' or 'issue'" }, { status: 400 });
  }
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Confirms this contract actually belongs to the caller's organization
  // before allowing the insert — same guarantee the old RLS insert policy
  // gave via its contracts/rental_customer_organizations join.
  const { data: contract } = await context.db
    .from("contracts")
    .select("id, tenant_id, organization_id")
    .eq("id", contractId)
    .maybeSingle();
  const ownsContract =
    contract && context.organizations.some((o) => o.organizationId === contract.organization_id);
  if (!ownsContract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const { error } = await context.db.from("rental_service_requests").insert({
    contract_id: contractId,
    rental_customer_id: context.customerId,
    tenant_id: contract.tenant_id,
    type,
    message,
  });
  if (error) return internalError(error);

  return NextResponse.json({ data: { ok: true } });
}
