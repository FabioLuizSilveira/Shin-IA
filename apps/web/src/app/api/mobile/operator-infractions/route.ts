import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";
import { resolveInfractionVisibility } from "@/lib/mobile-infractions-scope";

export const dynamic = "force-dynamic";

const SELECT =
  "id, infraction_id, status, asset_id, responsible_party_type, responsible_party_id, created_at, " +
  "infractions(id, plate, auto_number, occurred_at, amount_cents, amount_currency, description)";

// GET /api/mobile/operator-infractions — mobile screens phase. Read-only
// (item 47: no write path for operator self-service was built this
// round -- documented as a follow-up, not silently missing): an operator
// sees the infraction cases they're linked to (operator_id = own id, set
// once responsibility naming/confirmation points at them), so they at
// least know an infraction exists against them before a tenant staff
// member drives the actual workflow from the web app. Never every
// tenant infraction -- same isolation shape as operator-inspections.
export async function GET(req: NextRequest) {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const visibility = resolveInfractionVisibility(context);
  if (visibility?.kind !== "operator") {
    // Structurally unreachable given the userType check above, but kept
    // explicit rather than assumed -- see operator-inspections' own
    // route for the precedent of not trusting the earlier check alone.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status");
  let query = context.db
    .from("infraction_cases")
    .select(SELECT)
    .eq("tenant_id", visibility.tenantId)
    .eq("operator_id", visibility.operatorId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return internalError(error);
  return NextResponse.json({ data: data ?? [] });
}
