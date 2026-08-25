import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";

export const dynamic = "force-dynamic";

const SELECT =
  "id, asset_id, contract_id, type, status, linked_inspection_id, started_at, completed_at, created_at";

// GET /api/mobile/customer/inspections — the real vínculo is
// customer -> inspection.customer_id (direct FK to rental_customers,
// same table requireMobileContext() already resolved auth.uid() against
// to build customerId) — never a client-supplied customer/contract id.
// A customer never sees an inspection whose customer_id isn't theirs,
// full stop, regardless of what contract/organization it's under.
export async function GET(req: NextRequest) {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status");
  const contractId = req.nextUrl.searchParams.get("contractId");
  let query = context.db.from("inspections").select(SELECT).eq("customer_id", context.customerId);
  if (status) query = query.eq("status", status);
  if (contractId) query = query.eq("contract_id", contractId);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return internalError(error);
  return NextResponse.json({ data: data ?? [] });
}
