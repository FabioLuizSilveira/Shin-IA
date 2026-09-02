import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isTenantAdmin, isReadOnlyScope } from "@/lib/tenant-context";
import { createBillingProvider } from "@shina/billing-platform";

export const dynamic = "force-dynamic";

// Fase E of the Stripe -> Asaas migration: the tenant-facing replacement
// for what Stripe's hosted Billing Portal used to do (item 28), since
// Asaas has no such portal (AsaasBillingProvider.createPortal() throws by
// design — see its own comment). This route is gateway-agnostic exactly
// like /api/commercial/portal was; it happens to only be reachable today
// via the Asaas-only manage-subscription UI (no real Stripe subscribers
// exist to route through the old portal instead).
//
// "Gateway confirms, then we sync": this never writes platform_subscriptions
// itself — cancelSubscription() only calls the gateway, and the DB status
// flips to "cancelled" only once the SUBSCRIPTION_DELETED/INACTIVATED (or
// customer.subscription.deleted) webhook actually confirms it.
export async function POST() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope) || !isTenantAdmin(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: sub, error: subError } = await scope.db
    .from("platform_subscriptions")
    .select("id, billing_mode")
    .eq("tenant_id", scope.tenantId)
    .eq("product", "platform")
    .neq("status", "cancelled")
    .maybeSingle();
  if (subError) return internalError(subError);
  if (!sub)
    return NextResponse.json({ error: "Nenhuma assinatura ativa encontrada." }, { status: 404 });
  if (sub.billing_mode !== "card") {
    return NextResponse.json(
      { error: "Assinaturas fora do fluxo de cartão precisam ser canceladas pelo suporte Shinã." },
      { status: 422 },
    );
  }

  try {
    const billingProvider = createBillingProvider(scope.db);
    await billingProvider.cancelSubscription(sub.id);
    return NextResponse.json({ data: { cancelling: true } });
  } catch (err) {
    return internalError(err);
  }
}
