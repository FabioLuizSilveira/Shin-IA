import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";

export const dynamic = "force-dynamic";

const SELECT =
  "id, status, asset_id, responsible_party_type, created_at, " +
  "infractions(id, plate, auto_number, occurred_at, amount_cents, amount_currency, description, authority_name)";

// GET /api/mobile/customer/infractions — closes the "qualquer tela de
// cliente" gap documented in INFRACTIONS_ENGINE.md. Same shape/isolation
// posture as operator-infractions: a customer sees only cases where
// infraction_cases.customer_id is their own id (set by the temporal
// responsibility resolver when the case's occurred_at falls inside their
// own contract/rental window) — never the tenant's whole infractions
// list, never internal fields like responsible_party_id or staff notes.
export async function GET(_req: NextRequest) {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantIds = context.organizations.map((o) => o.tenantId);
  if (tenantIds.length === 0) return NextResponse.json({ data: [] });

  const { data, error } = await context.db
    .from("infraction_cases")
    .select(SELECT)
    .in("tenant_id", tenantIds)
    .eq("customer_id", context.customerId)
    .order("created_at", { ascending: false });
  if (error) return internalError(error);
  return NextResponse.json({ data: data ?? [] });
}
