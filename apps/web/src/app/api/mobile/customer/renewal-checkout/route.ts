import { NextResponse, type NextRequest } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { internalError } from "@/lib/api-error";
import {
  isAsaasConfigured,
  findOrCreateAsaasCustomer,
  createOneOffCharge,
  ASAAS_MIN_CHARGE_CENTS,
} from "@/lib/asaas/client";

export const dynamic = "force-dynamic";

// "Só pagar para renovar" — same car, no calendar/availability check needed
// (it's the exact asset the customer already has), just a real Stripe
// charge for one more week at the same rate. Paying is what renews it —
// the webhook (checkout.session.completed, metadata.action === "renewal")
// extends contracts.period_ends_at, not this route — this route only ever
// creates the invoice + checkout session, same "webhook is the source of
// truth" rule already used everywhere else money changes hands in this app.
export async function POST(req: NextRequest) {
  if (!isAsaasConfigured) {
    return NextResponse.json({ error: "Asaas not configured" }, { status: 503 });
  }

  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const contractId = body?.contractId;
  if (!contractId) {
    return NextResponse.json({ error: "contractId is required" }, { status: 400 });
  }

  const orgIds = context.organizations.map((o) => o.organizationId);
  const { data: contract, error: contractErr } = await context.db
    .from("contracts")
    .select("id, tenant_id, organization_id, status, value_amount, value_currency")
    .eq("id", contractId)
    .in("organization_id", orgIds)
    .maybeSingle();
  if (contractErr) return internalError(contractErr);
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (contract.status !== "active") {
    return NextResponse.json({ error: "Only active contracts can be renewed" }, { status: 422 });
  }
  const amountCents = Math.round(Number(contract.value_amount) * 100);
  if (amountCents < ASAAS_MIN_CHARGE_CENTS) {
    return NextResponse.json(
      { error: "renewal value is below Asaas's minimum chargeable value (R$5,00)" },
      { status: 422 },
    );
  }

  let { data: billingAccount } = await context.db
    .from("billing_accounts")
    .select("id, stripe_customer_id, organizations(name, email, document, phone)")
    .eq("organization_id", contract.organization_id)
    .eq("tenant_id", contract.tenant_id)
    .maybeSingle();
  if (!billingAccount) {
    const { data: created, error: baErr } = await context.db
      .from("billing_accounts")
      .insert({
        id: crypto.randomUUID(),
        tenant_id: contract.tenant_id,
        organization_id: contract.organization_id,
        cycle: "one_time",
        status: "active",
        credit_limit_amount: 5000,
        credit_limit_currency: contract.value_currency,
        balance_amount: 0,
        balance_currency: contract.value_currency,
      })
      .select("id, stripe_customer_id, organizations(name, email, document, phone)")
      .single();
    if (baErr) return internalError(baErr);
    billingAccount = created;
  }
  const org = billingAccount.organizations as unknown as {
    name: string;
    email: string | null;
    document: string;
    phone: string | null;
  } | null;
  if (!org)
    return NextResponse.json({ error: "Billing account has no organization" }, { status: 500 });

  const { data: invoice, error: invErr } = await context.db
    .from("invoices")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: contract.tenant_id,
      billing_account_id: billingAccount.id,
      status: "issued",
      total_amount: contract.value_amount,
      total_currency: contract.value_currency,
      due_date: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (invErr) return internalError(invErr);

  await context.db.from("invoice_line_items").insert({
    id: crypto.randomUUID(),
    invoice_id: invoice.id,
    tenant_id: contract.tenant_id,
    description: "Renovação semanal",
    quantity: 1,
    unit_price_amount: contract.value_amount,
    unit_price_currency: contract.value_currency,
    sort_order: 0,
  });

  const customerId = await findOrCreateAsaasCustomer({
    existingCustomerId: billingAccount.stripe_customer_id,
    name: org.name,
    document: org.document,
    email: org.email ?? context.email,
    phone: org.phone,
  });
  if (!billingAccount.stripe_customer_id) {
    await context.db
      .from("billing_accounts")
      .update({ stripe_customer_id: customerId })
      .eq("id", billingAccount.id);
  }

  const payment = await createOneOffCharge({
    customerId,
    valueCents: amountCents,
    description: "Renovação de locação — 1 semana",
    action: "renewal",
    invoiceId: invoice.id,
    refId: contract.id,
  });

  await context.db
    .from("invoices")
    .update({ stripe_checkout_session_id: payment.id })
    .eq("id", invoice.id);

  return NextResponse.json({ data: { url: payment.invoiceUrl } });
}
