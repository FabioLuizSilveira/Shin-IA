import { NextResponse } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";

export const dynamic = "force-dynamic";

// GET /api/mobile/customer/me — web customer portal's RLS→API migration
// (rentals-portal.ts's fetchMyRentalCustomerId). Trivial now that
// requireMobileContext() already resolves customerId from the verified
// session — no query needed here at all.
export async function GET() {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ data: { customerId: context.customerId } });
}
