import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { createSignatureProvider } from "@shina/signature-platform";

export const dynamic = "force-dynamic";

// POST /api/signature-requests/:id/cancel — the safety valve behind
// hiding the customer portal's clickwrap flow while a signature request
// is active (P2 product decision): without a way to cancel, a tenant
// whose Clicksign email bounces/lands in spam would leave the customer
// with zero way to accept the contract. Calls the real
// ClicksignProvider.cancelRequest() (live-verified in P1 — cancels via
// the envelope's document, not the envelope itself, see CLICKSIGN.md),
// then marks the local row cancelled so the customer portal's clickwrap
// fallback reappears on next read (getSignatureStatusForContract()).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const { data: request, error: fetchError } = await scope.db
    .from("signature_requests")
    .select("id, contract_id, provider, provider_request_id, status")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!request) return NextResponse.json({ error: "Signature request not found" }, { status: 404 });
  if (["cancelled", "signed", "expired", "failed"].includes(request.status)) {
    return NextResponse.json(
      { error: `cannot cancel a request in status "${request.status}"` },
      { status: 422 },
    );
  }

  const provider = createSignatureProvider();
  if (provider.type !== request.provider) {
    // The active SIGNATURE_PROVIDER changed since this request was
    // created — never happens in normal operation (single provider at a
    // time today), but fail loud rather than call the wrong gateway.
    return NextResponse.json(
      {
        error: `active provider "${provider.type}" does not match request's provider "${request.provider}"`,
      },
      { status: 409 },
    );
  }

  try {
    if (request.provider_request_id) {
      await provider.cancelRequest(request.provider_request_id);
    }
  } catch (err) {
    return internalError(err);
  }

  const { error: updateError } = await scope.db
    .from("signature_requests")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (updateError) return internalError(updateError);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "contract",
    entityId: request.contract_id,
    action: "signature_cancelled_by_tenant",
    metadata: { signatureRequestId: id },
  });

  return NextResponse.json({ data: { ok: true } });
}
