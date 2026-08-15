import { NextResponse, type NextRequest } from "next/server";
import {
  requireMobileContext,
  type CustomerMobileContext,
  type OperatorMobileContext,
} from "@/lib/mobile-context";
import { internalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// Wave 3 Phase D — customer/operator only. tenant_user already has a
// reachable inbox via the existing GET/PATCH /api/notifications
// (requireTenantScope), reused, not duplicated. recipient_external_ref
// encodes the exact recipient ("customer:<id>"/"operator:<id>",
// server-determined by create-notification.ts) — the query below IS the
// ownership check, not a separate step: a notification addressed to another
// customer/operator simply never matches this filter, so it never appears
// in the list and can never be marked read by them either.
function recipientRef(context: CustomerMobileContext | OperatorMobileContext): string {
  return context.userType === "customer"
    ? `customer:${context.customerId}`
    : `operator:${context.operatorId}`;
}

export async function GET() {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer" && context.userType !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await context.db
    .from("notifications")
    .select("id, subject, body, priority, status, created_at, read_at")
    .eq("recipient_external_ref", recipientRef(context))
    .eq("channel", "in_app")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return internalError(error);

  return NextResponse.json({ data: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer" && context.userType !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { ids?: string[]; all?: boolean };
  const ref = recipientRef(context);

  let query = context.db
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("recipient_external_ref", ref);

  if (body.all) {
    query = query.neq("status", "read");
  } else if (body.ids && body.ids.length > 0) {
    query = query.in("id", body.ids);
  } else {
    return NextResponse.json({ error: "ids or all is required" }, { status: 422 });
  }

  const { error } = await query;
  if (error) return internalError(error);

  return NextResponse.json({ data: { ok: true } });
}
