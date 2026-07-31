import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["approved", "rejected", "resolved"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as { status?: string; review_notes?: string };
  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 422 },
    );
  }

  const { data: current, error: fetchError } = await scope.db
    .from("rental_service_requests")
    .select("status")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Service request not found" }, { status: 404 });
  if (current.status !== "pending") {
    return NextResponse.json({ error: "Only pending requests can be reviewed" }, { status: 422 });
  }

  const { error: updateError } = await scope.db
    .from("rental_service_requests")
    .update({
      status: body.status,
      review_notes: body.review_notes,
      reviewed_by: scope.userId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ data: { ok: true } });
}
