import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { canTransitionCase } from "@shina/infractions-engine";

export const dynamic = "force-dynamic";

interface CreatePaymentBody {
  kind?: "to_authority" | "reimbursement_from_responsible";
  amountOriginalCents?: number;
  amountDiscountedCents?: number;
  amountPaidCents?: number;
  paymentMethod?: string;
  notes?: string;
}

// POST /api/infractions/:id/payment — item 27: payment TO the authority
// and reimbursement FROM the responsible party are tracked as distinct
// kinds, never conflated into one ambiguous row. Registration only here
// (tenant marks something as paid manually) -- automatic charge creation
// toward the responsible party is ensureInfractionCharge() (Fase G),
// triggered separately once a human-approved amount exists.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.infractions.manage_payment"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: infractionCase, error: caseError } = await scope.db
    .from("infraction_cases")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (caseError) return internalError(caseError);
  if (!infractionCase) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const body = (await req.json()) as CreatePaymentBody;
  if (!body.kind) return NextResponse.json({ error: "kind is required" }, { status: 400 });

  const paymentId = crypto.randomUUID();
  const { error: insertError } = await scope.db.from("infraction_payments").insert({
    id: paymentId,
    tenant_id: scope.tenantId,
    case_id: id,
    kind: body.kind,
    amount_original_cents: body.amountOriginalCents ?? null,
    amount_discounted_cents: body.amountDiscountedCents ?? null,
    amount_paid_cents: body.amountPaidCents ?? null,
    paid_at: body.amountPaidCents ? new Date().toISOString() : null,
    payment_method: body.paymentMethod ?? null,
    notes: body.notes ?? null,
    created_by: scope.userId,
  });
  if (insertError) return internalError(insertError);

  if (
    body.kind === "to_authority" &&
    body.amountPaidCents &&
    canTransitionCase(infractionCase.status, "paid")
  ) {
    await scope.db
      .from("infraction_cases")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", scope.tenantId);
  }

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "infraction_case",
    entityId: id,
    action: "payment_registered",
    metadata: { paymentId, kind: body.kind },
  });

  return NextResponse.json({ data: { id: paymentId } }, { status: 201 });
}
