import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import {
  isAsaasConfigured,
  findOrCreateAsaasCustomer,
  createOneOffCharge,
  ASAAS_MIN_CHARGE_CENTS,
} from "@/lib/asaas/client";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isAsaasConfigured) {
    return NextResponse.json({ error: "Asaas not configured" }, { status: 503 });
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
      "id, status, total_amount, total_currency, billing_account_id, billing_accounts(id, stripe_customer_id, organizations(id, name, email, document, phone))",
    )
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (error) return internalError(error);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status !== "issued" && invoice.status !== "overdue") {
    return NextResponse.json(
      { error: `invoice must be issued or overdue to pay (current: ${invoice.status})` },
      { status: 422 },
    );
  }
  const amountCents = Math.round(Number(invoice.total_amount) * 100);
  if (amountCents < ASAAS_MIN_CHARGE_CENTS) {
    return NextResponse.json(
      { error: `invoice total is below Asaas's minimum chargeable value (R$5,00)` },
      { status: 422 },
    );
  }

  const billingAccount = invoice.billing_accounts as unknown as {
    id: string;
    stripe_customer_id: string | null;
    organizations: {
      id: string;
      name: string;
      email: string | null;
      document: string;
      phone: string | null;
    } | null;
  } | null;
  const org = billingAccount?.organizations;
  if (!org)
    return NextResponse.json({ error: "Billing account has no organization" }, { status: 500 });

  const customerId = await findOrCreateAsaasCustomer({
    existingCustomerId: billingAccount?.stripe_customer_id,
    name: org.name,
    document: org.document,
    email: org.email,
    phone: org.phone,
  });
  if (!billingAccount?.stripe_customer_id) {
    // Obs-22 fix: re-scope by tenant_id even though invoice.billing_account_id
    // was already derived from a tenant-verified invoice row above — defense
    // in depth against this write surviving a future refactor unscoped.
    await supabase
      .from("billing_accounts")
      .update({ stripe_customer_id: customerId })
      .eq("id", invoice.billing_account_id)
      .eq("tenant_id", scope.tenantId);
  }

  const payment = await createOneOffCharge({
    customerId,
    valueCents: amountCents,
    description: `Fatura ${invoice.id.slice(0, 8).toUpperCase()}`,
    action: "invoice",
    invoiceId: invoice.id,
  });

  // Reusing the stripe-named column for the gateway payment id, same as
  // AsaasBillingProvider does for platform_customers/platform_subscriptions
  // (Fase A) -- rename deferred to Fase D, not this phase.
  await supabase
    .from("invoices")
    .update({ stripe_checkout_session_id: payment.id, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);

  return NextResponse.json({ data: { url: payment.invoiceUrl } });
}
