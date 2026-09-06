import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";

export const dynamic = "force-dynamic";

// GET /api/mobile/customer/infractions/:id — case detail, deliberately
// narrower than the staff detail route (api/infractions/:id): no
// internal evidence/documents, no payments (a customer never needs to
// see what the tenant paid the authority or another party's driver
// identification), no other party's data. Deadlines are informational
// only (so the customer knows there's urgency); the customer's own
// disputes are shown so they can see the status of something they
// already contested.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantIds = context.organizations.map((o) => o.tenantId);
  if (tenantIds.length === 0)
    return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const { data: infractionCase, error: caseError } = await context.db
    .from("infraction_cases")
    .select(
      "id, status, asset_id, responsible_party_type, created_at, " +
        "infractions(id, plate, auto_number, occurred_at, amount_cents, amount_currency, description, authority_name)",
    )
    .eq("id", id)
    .in("tenant_id", tenantIds)
    .eq("customer_id", context.customerId)
    .maybeSingle();
  if (caseError) return internalError(caseError);
  if (!infractionCase) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const [{ data: deadlines }, { data: disputes }] = await Promise.all([
    context.db
      .from("infraction_deadlines")
      .select("kind, due_at, status")
      .eq("case_id", id)
      .order("due_at", { ascending: true }),
    context.db
      .from("infraction_disputes")
      .select("id, status, reason, description, created_at, resolved_at")
      .eq("case_id", id)
      .eq("party_type", "customer")
      .eq("party_id", context.customerId)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    data: { case: infractionCase, deadlines: deadlines ?? [], disputes: disputes ?? [] },
  });
}
