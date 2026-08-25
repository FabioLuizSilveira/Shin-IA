import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// POST /api/inspections/:id/sign — records an acceptance/aceite (item 12
// of the spec). Same non-negotiable rule already applied twice this
// session for tenant_contract_acceptances: accepted_at/ip_address/
// user_agent are ALWAYS stamped by the backend from the request context,
// never accepted from the request body.
//
// Only tenant_staff signing is wired through this route (a staff member
// acknowledging the laudo on behalf of the tenant — e.g. "revisei e
// aprovo este laudo"). Customer/operator self-service signing needs its
// own customer-facing route (mirroring /api/customer-contracts/[id]/
// accept's requireMobileContext()-based auth, not requireTenantScope())
// — deliberately deferred, documented in docs/architecture/
// INSPECTION_ENGINE.md rather than faked with a staff session standing in
// for a customer's.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const { data: inspection, error: inspectionError } = await scope.db
    .from("inspections")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (inspectionError) return internalError(inspectionError);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });

  const { data: report, error: reportError } = await scope.db
    .from("inspection_reports")
    .select("id, content_hash")
    .eq("inspection_id", id)
    .eq("tenant_id", scope.tenantId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reportError) return internalError(reportError);
  if (!report) {
    return NextResponse.json(
      { error: "Gere o laudo antes de registrar a assinatura." },
      { status: 422 },
    );
  }

  const signatureId = crypto.randomUUID();
  const { error: insertError } = await scope.db.from("inspection_signatures").insert({
    id: signatureId,
    tenant_id: scope.tenantId,
    inspection_id: id,
    report_id: report.id,
    signer_type: "tenant_staff",
    user_id: scope.userId,
    ip_address: clientIp(req),
    user_agent: req.headers.get("user-agent") ?? null,
    document_hash: report.content_hash,
    acceptance_method: "clickwrap",
  });
  if (insertError) return internalError(insertError);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "inspection",
    entityId: id,
    action: "signed",
    metadata: { signerType: "tenant_staff", reportId: report.id },
  });

  return NextResponse.json({ data: { id: signatureId } }, { status: 201 });
}
