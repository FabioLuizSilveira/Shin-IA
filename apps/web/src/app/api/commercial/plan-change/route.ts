import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, hasTenantPermission, isReadOnlyScope } from "@/lib/tenant-context";
import { changePlan } from "@shina/commercial-platform";
import { createBillingProvider } from "@shina/billing-platform";
import { clientIp } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

// Current subscription + available plans for the upgrade/downgrade screen.
export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data: subscription, error: subError } = await scope.db
    .from("platform_subscriptions")
    .select("plan_version_id, plan_key, status")
    .eq("tenant_id", scope.tenantId)
    .eq("product", "platform")
    .neq("status", "cancelled")
    .maybeSingle();
  if (subError) return internalError(subError);

  const { data: plans, error: plansError } = await scope.db
    .from("plan_versions")
    .select(
      "id, name, price_cents, currency, billing_cycle, included_features, plans!inner(product, key)",
    )
    .eq("status", "published")
    .eq("plans.product", "platform")
    .order("price_cents", { ascending: true });
  if (plansError) return internalError(plansError);

  return NextResponse.json({
    data: {
      currentPlanVersionId: subscription?.plan_version_id ?? null,
      currentPlanKey: subscription?.plan_key ?? null,
      plans: (plans ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        price_cents: p.price_cents,
        currency: p.currency,
        billing_cycle: p.billing_cycle,
        included_features: p.included_features,
      })),
    },
  });
}

// Upgrade/downgrade for the "platform" product (item 20-22). Gated by the
// granular billing_plan:change permission (item 30) — tenant_owner/
// tenant_admin have it by default, delegable to a custom role via
// tenant/studio.
export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope) || !(await hasTenantPermission(scope, "billing_plan:change"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { toPlanVersionId?: string };
  if (!body.toPlanVersionId) {
    return NextResponse.json({ error: "toPlanVersionId is required" }, { status: 422 });
  }

  try {
    const billingProvider = createBillingProvider(scope.db);
    const result = await changePlan(scope.db, billingProvider, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      product: "platform",
      toPlanVersionId: body.toPlanVersionId,
      request: { ipAddress: clientIp(req), userAgent: req.headers.get("user-agent") },
    });
    void logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "subscription",
      entityId: result.planChangeAcceptanceId,
      action:
        result.direction === "up"
          ? "plan.upgraded"
          : result.direction === "down"
            ? "plan.downgraded"
            : "plan.changed",
      metadata: {
        fromPlanVersionId: result.fromPlanVersionId,
        toPlanVersionId: result.toPlanVersionId,
      },
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    if (err instanceof Error && err.message === "contract_reacceptance_required") {
      return NextResponse.json({ error: "contract_reacceptance_required" }, { status: 409 });
    }
    return internalError(err);
  }
}
