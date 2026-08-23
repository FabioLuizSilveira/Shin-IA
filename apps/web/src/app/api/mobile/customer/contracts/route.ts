import { NextResponse } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { internalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const RENTAL_SELECT =
  "id, tenant_id, type, status, value_amount, value_currency, period_starts_at, period_ends_at, " +
  "template_id, template_version_id, snapshot_id, " +
  "contract_assets(id, quantity, assets(id, name, category, status, metadata))";

// GET /api/mobile/customer/contracts — the web customer portal's
// RLS→API migration (rentals-portal.ts's fetchMyRentals). Same shape the
// old direct `contracts` query returned, scoped server-side by
// context.customerId's real organization links instead of RLS.
export async function GET() {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgIds = context.organizations.map((o) => o.organizationId);
  if (orgIds.length === 0) return NextResponse.json({ data: [] });

  const { data, error } = await context.db
    .from("contracts")
    .select(RENTAL_SELECT)
    .in("organization_id", orgIds)
    .order("period_starts_at", { ascending: false });
  if (error) return internalError(error);

  return NextResponse.json({ data: data ?? [] });
}
