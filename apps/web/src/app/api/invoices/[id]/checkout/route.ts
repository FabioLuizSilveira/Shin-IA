import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { stripe, isStripeConfigured } from "@/lib/stripe/client";

export const dynamic = "force-dynamic";

function appUrl(): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "shinaia.com.br";
  return process.env.NEXT_PUBLIC_APP_URL ?? `https://app.${root}`;
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isStripeConfigured) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  const supabase = scope.db;

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      "id, status, total_amount, total_currency, billing_account_id, billing_accounts(id, stripe_customer_id, organizations(id, name, email))",
    )
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status !== "issued" && invoice.status !== "overdue") {
    return NextResponse.json(
      { error: `invoice must be issued or overdue to pay (current: ${invoice.status})` },
      { status: 422 },
    );
  }

  const billingAccount = invoice.billing_accounts as unknown as {
    id: string;
    stripe_customer_id: string | null;
    organizations: { id: string; name: string; email: string | null } | null;
  } | null;

  let customerId = billingAccount?.stripe_customer_id ?? null;
  if (!customerId) {
    const org = billingAccount?.organizations;
    const customer = await stripe.customers.create({
      name: org?.name,
      email: org?.email ?? undefined,
      metadata: { billing_account_id: invoice.billing_account_id },
    });
    customerId = customer.id;
    await supabase
      .from("billing_accounts")
      .update({ stripe_customer_id: customerId })
      .eq("id", invoice.billing_account_id);
  }

  const base = appUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: invoice.total_currency.toLowerCase(),
          product_data: { name: `Fatura ${invoice.id.slice(0, 8).toUpperCase()}` },
          unit_amount: Math.round(Number(invoice.total_amount) * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${base}/tenant/billing?paid=${invoice.id}`,
    cancel_url: `${base}/tenant/billing?cancelled=${invoice.id}`,
    metadata: { invoice_id: invoice.id },
  });

  await supabase
    .from("invoices")
    .update({ stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ data: { url: session.url } });
}
