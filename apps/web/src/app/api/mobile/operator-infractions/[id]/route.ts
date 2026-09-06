import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";

export const dynamic = "force-dynamic";

const SELECT =
  "id, status, asset_id, responsible_party_type, responsibility_confidence, created_at, " +
  "infractions(id, plate, auto_number, occurred_at, amount_cents, amount_currency, description, authority_name)";

// GET /api/mobile/operator-infractions/:id — closes the "self-service de
// escrita do operador" gap's read side: without this, the operator had no
// way to see WHICH driver-identification row (if any) is waiting for
// their acknowledge/dispute response (the .../respond route needs its
// id). Same ownership scoping as the list route (operator_id = own id) —
// never every tenant case.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: infractionCase, error: caseError } = await context.db
    .from("infraction_cases")
    .select(SELECT)
    .eq("id", id)
    .eq("tenant_id", context.tenantId)
    .eq("operator_id", context.operatorId)
    .maybeSingle();
  if (caseError) return internalError(caseError);
  if (!infractionCase) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const { data: driverIdentifications, error: driverIdError } = await context.db
    .from("infraction_driver_identifications")
    .select("id, status, operator_acknowledgment, operator_acknowledged_at, operator_notes")
    .eq("case_id", id)
    .eq("operator_id", context.operatorId);
  if (driverIdError) return internalError(driverIdError);

  return NextResponse.json({
    data: { case: infractionCase, driverIdentifications: driverIdentifications ?? [] },
  });
}
