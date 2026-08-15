import { NextResponse } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { customerOrganizationIds } from "@/lib/mobile-contracts-scope";
import { internalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// Wave 3 Phase A — customer-only list. Tenant staff already have
// GET /api/contracts (requireTenantScope) — reused, not duplicated.
// Operators have no contracts of their own in this schema (contracts are
// always organization-scoped; operator-party contracts, when they exist,
// aren't reachable by mobile in this wave — out of Phase A's stated scope).
const SELECT =
  "id, type, status, value_amount, value_currency, period_starts_at, period_ends_at, " +
  "template_id, template_version_id, snapshot_id, organization_id, created_at";

export async function GET() {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const organizationIds = customerOrganizationIds(context);
  if (organizationIds.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const { data, error } = await context.db
    .from("contracts")
    .select(SELECT)
    .in("organization_id", organizationIds)
    .is("deleted_at", null)
    .order("period_starts_at", { ascending: false });
  if (error) return internalError(error);

  return NextResponse.json({ data: data ?? [] });
}
