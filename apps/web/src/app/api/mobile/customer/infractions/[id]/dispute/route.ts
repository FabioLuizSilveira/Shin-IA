import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";
import { logActivity } from "@/lib/activity-log";
import { canTransitionCase, type InfractionCaseStatus } from "@shina/infractions-engine";

export const dynamic = "force-dynamic";

interface DisputeBody {
  description?: string;
  reason?: string;
}

// POST /api/mobile/customer/infractions/:id/dispute — the "respond" half
// of the customer.infractions.respond permission seeded back in Fase B
// (never checked anywhere until now — no customer route existed).
// Reuses the same infraction_disputes mechanism the tenant staff route
// (POST /api/infractions/:id/disputes) and the operator self-service
// route both use — party_type/party_id always forced server-side to
// this customer's own identity, never accepted from the request body.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    .select("id, tenant_id, status")
    .eq("id", id)
    .in("tenant_id", tenantIds)
    .eq("customer_id", context.customerId)
    .maybeSingle();
  if (caseError) return internalError(caseError);
  if (!infractionCase) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  const tenantId = infractionCase.tenant_id as string;

  const body = (await req.json().catch(() => ({}))) as DisputeBody;
  if (!body.description?.trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }

  const disputeId = crypto.randomUUID();
  const { error: insertError } = await context.db.from("infraction_disputes").insert({
    id: disputeId,
    tenant_id: tenantId,
    case_id: id,
    party_type: "customer",
    party_id: context.customerId,
    reason: body.reason?.trim() || null,
    description: body.description.trim(),
    status: "open",
  });
  if (insertError) return internalError(insertError);

  if (canTransitionCase(infractionCase.status as InfractionCaseStatus, "disputed")) {
    await context.db
      .from("infraction_cases")
      .update({ status: "disputed", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", tenantId);
  }

  void logActivity(context.db, {
    tenantId,
    actorId: context.customerId,
    entityType: "infraction_case",
    entityId: id,
    action: "disputed",
    metadata: { disputeId, partyType: "customer", source: "customer_mobile" },
  });

  return NextResponse.json({ data: { id: disputeId } }, { status: 201 });
}
