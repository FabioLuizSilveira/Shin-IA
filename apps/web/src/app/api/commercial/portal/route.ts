import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isTenantAdmin, isReadOnlyScope } from "@/lib/tenant-context";
import { createBillingProvider } from "@shina/billing-platform";
import { appUrl } from "@/lib/domain";

export const dynamic = "force-dynamic";

// Opens the Stripe billing portal (item 28: "método de pagamento, invoices")
// — reuses BillingProvider.createPortal(), already implemented and used by
// nothing else in apps/web yet (apps/mkt has its own portal wiring already;
// this is the Platform product's first).
export async function POST() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope) || !isTenantAdmin(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: sub, error: subError } = await scope.db
    .from("platform_subscriptions")
    .select("customer_id, platform_customers(stripe_customer_id)")
    .eq("tenant_id", scope.tenantId)
    .eq("product", "platform")
    .neq("status", "cancelled")
    .maybeSingle();
  if (subError) return internalError(subError);

  const stripeCustomerId = (
    sub?.platform_customers as unknown as { stripe_customer_id: string | null }
  )?.stripe_customer_id;
  if (!stripeCustomerId) {
    return NextResponse.json(
      {
        error:
          "Esta assinatura não tem método de pagamento no Stripe (billing_mode diferente de card).",
      },
      { status: 422 },
    );
  }

  try {
    const billingProvider = createBillingProvider(scope.db);
    const { url } = await billingProvider.createPortal({
      stripeCustomerId,
      returnUrl: appUrl("/tenant/settings/billing"),
    });
    return NextResponse.json({ data: { url } });
  } catch (err) {
    return internalError(err);
  }
}
