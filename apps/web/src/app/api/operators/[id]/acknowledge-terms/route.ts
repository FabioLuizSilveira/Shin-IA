import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import {
  TenantContractRequirementResolver,
  ContractTemplateEngine,
  createContractSnapshot,
  recordContractAcceptance,
} from "@shina/tenant-contract-engine";
import { clientIp } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

// Staff records OperatorTerms acknowledgement on behalf of an operator who
// has no login of their own (the common case, per Fase A's schema decision)
// — an administrative record, never a real electronic signature. Reuses the
// same resolver/engine/acceptance as the customer flow, parameterized by
// partyType: "operator" and acceptanceMethod: "operator_acknowledgement".
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: operatorId } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const { data: operator } = await scope.db
    .from("operators")
    .select("id")
    .eq("id", operatorId)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (!operator) return NextResponse.json({ error: "Operator not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { blueprint_id?: string };
  const blueprintId = body.blueprint_id ?? "generic-assets";

  try {
    const requirement = await TenantContractRequirementResolver.resolve(scope.db, {
      tenantId: scope.tenantId,
      partyType: "operator",
      blueprintId,
      operatorRequired: true,
      operatorIncluded: true,
      trackingEnabled: false,
      operatorId,
    });

    const rendered = await ContractTemplateEngine.render(scope.db, {
      templateId: requirement.templateId,
      context: {},
    });

    // OperatorTerms doesn't attach to a specific `contracts` row (it's a
    // standing agreement, not tied to one rental) — a lightweight internal
    // contract record is created just to anchor the snapshot/acceptance FKs,
    // same pattern as the customer flow, minus the organization linkage.
    const { data: contract, error: contractError } = await scope.db
      .from("contracts")
      .insert({
        id: crypto.randomUUID(),
        tenant_id: scope.tenantId,
        organization_id: null,
        type: "service",
        status: "active",
        value_amount: 0,
        value_currency: "BRL",
        period_starts_at: new Date().toISOString(),
        period_ends_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        template_id: requirement.templateId,
        template_version_id: requirement.versionId,
      })
      .select("id")
      .single();
    if (contractError || !contract)
      throw new Error(contractError?.message ?? "failed to anchor OperatorTerms");

    const snapshot = await createContractSnapshot(scope.db, {
      tenantId: scope.tenantId,
      contractId: contract.id,
      templateVersionId: requirement.versionId,
      renderedContent: rendered.renderedContent,
      contentHash: rendered.contentHash,
    });
    await scope.db.from("contracts").update({ snapshot_id: snapshot.id }).eq("id", contract.id);

    const result = await recordContractAcceptance(scope.db, {
      tenantId: scope.tenantId,
      partyType: "operator",
      userId: scope.userId,
      operatorId,
      contractId: contract.id,
      contractVersionId: requirement.versionId,
      snapshotId: snapshot.id,
      documentHash: rendered.contentHash,
      acceptanceMethod: "operator_acknowledgement",
      request: { ipAddress: clientIp(req), userAgent: req.headers.get("user-agent") },
      metadata: { acknowledged_on_behalf_of_operator_id: operatorId },
    });

    void logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "operator",
      entityId: operatorId,
      action: "contract.accepted",
      metadata: { acceptance_method: "operator_acknowledgement" },
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao registrar reconhecimento." },
      { status: 422 },
    );
  }
}
