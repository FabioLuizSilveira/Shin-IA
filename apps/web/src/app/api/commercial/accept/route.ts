import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, hasTenantPermission, isReadOnlyScope } from "@/lib/tenant-context";
import { recordContractAcceptance } from "@shina/commercial-platform";
import { clientIp } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

// General-purpose "accept the current Platform contract" endpoint for an
// EXISTING tenant — used by /tenant/legal/reaccept after a material contract
// change (Fase F). Unlike onboarding, the tenant already has an active
// subscription; this reuses its current plan_version_id (falling back to
// looking one up by the subscription's plan_key for the rare pre-Fase-A row
// that predates plan_version_id existing at all).
export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope) || !(await hasTenantPermission(scope, "legal_contracts:accept"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    representativeName?: string;
    representativeRole?: string;
    representativeDocument?: string;
    declaredAuthority?: boolean;
  };
  if (!body.representativeName || !body.representativeRole || !body.declaredAuthority) {
    return NextResponse.json({ error: "Dados incompletos." }, { status: 422 });
  }

  const { data: subscription, error: subError } = await scope.db
    .from("platform_subscriptions")
    .select("plan_version_id, plan_key")
    .eq("tenant_id", scope.tenantId)
    .eq("product", "platform")
    .neq("status", "cancelled")
    .maybeSingle();
  if (subError) return internalError(subError);

  let planVersionId = subscription?.plan_version_id ?? null;
  if (!planVersionId && subscription?.plan_key) {
    const { data: fallback } = await scope.db
      .from("plan_versions")
      .select("id, plans!inner(product, key)")
      .eq("status", "published")
      .eq("plans.product", "platform")
      .eq("plans.key", subscription.plan_key)
      .maybeSingle();
    planVersionId = fallback?.id ?? null;
  }
  if (!planVersionId) {
    return NextResponse.json(
      { error: "Não foi possível determinar o plano atual do tenant." },
      { status: 500 },
    );
  }

  try {
    const result = await recordContractAcceptance(scope.db, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      product: "platform",
      planVersionId,
      representative: {
        name: body.representativeName,
        role: body.representativeRole,
        document: body.representativeDocument,
        declaredAuthority: body.declaredAuthority,
      },
      request: { ipAddress: clientIp(req), userAgent: req.headers.get("user-agent") },
    });
    void logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "contract_acceptance",
      entityId: result.contractAcceptanceId,
      action: "contract.accepted",
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    return internalError(err);
  }
}
