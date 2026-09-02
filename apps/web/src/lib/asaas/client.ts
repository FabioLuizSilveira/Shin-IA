// Asaas equivalent of lib/stripe/client.ts, but for the one-off (DETACHED)
// customer-facing payment flows only (mobile deposit/balance/renewal,
// invoices/[id]/checkout) — Stripe -> Asaas migration, Fase C. The
// subscription-oriented provider (Fase A/B) lives in
// @shina/billing-platform's AsaasBillingProvider; this is deliberately a
// separate, smaller client since these routes never touched
// billing-platform to begin with (see checkout-orchestration.ts's own
// comment on that split) and one-off payments have a different shape
// (POST /v3/payments, not /v3/checkouts' subscription-only contract).
const BASE_URL =
  process.env.ASAAS_ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";

export const isAsaasConfigured = Boolean(process.env.ASAAS_API_KEY);

// Live-confirmed against the sandbox (Fase A): R$5,00 is Asaas's real
// minimum chargeable value; below it every endpoint 400s.
export const ASAAS_MIN_CHARGE_CENTS = 500;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: process.env.ASAAS_API_KEY ?? "",
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Asaas ${path} -> ${res.status}: ${JSON.stringify(body)}`);
  }
  return body as T;
}

interface AsaasCustomerResponse {
  id: string;
}

// Lazily creates (or reuses) an Asaas customer for a payer. document is
// mandatory here -- unlike Stripe, Asaas 400s customer creation without a
// cpfCnpj, which is why this migration's schema change
// (rental_customers.document, organizations.document already existed) was
// necessary at all.
export async function findOrCreateAsaasCustomer(params: {
  existingCustomerId?: string | null;
  name: string;
  document: string;
  email?: string | null;
  phone?: string | null;
}): Promise<string> {
  if (params.existingCustomerId) return params.existingCustomerId;
  const customer = await request<AsaasCustomerResponse>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: params.name,
      cpfCnpj: params.document,
      email: params.email ?? undefined,
      phone: params.phone ?? undefined,
    }),
  });
  return customer.id;
}

export interface AsaasPaymentResponse {
  id: string;
  invoiceUrl: string;
  status: string;
}

// A single DETACHED payment -- billingType: "UNDEFINED" lets the payer
// choose Pix/boleto/card on Asaas's own hosted invoiceUrl page, the closest
// equivalent to stripe.checkout.sessions.create({mode:"payment"}).
// externalReference is how the webhook (api/webhooks/asaas) finds its way
// back to the invoice/reservation/contract row afterward -- packed as
// "action|invoiceId|refId" (well under Asaas's 200-char cap; see the Fase A
// bug this format was chosen to avoid: packing full JSON metadata blew past
// that limit for the subscription checkout, live-caught during Fase A/B).
export async function createOneOffCharge(params: {
  customerId: string;
  valueCents: number;
  description: string;
  action: "deposit" | "balance" | "renewal" | "invoice";
  invoiceId: string;
  refId?: string | null;
}): Promise<AsaasPaymentResponse> {
  const externalReference = `${params.action}|${params.invoiceId}|${params.refId ?? ""}`;
  return request<AsaasPaymentResponse>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: params.customerId,
      billingType: "UNDEFINED",
      value: params.valueCents / 100,
      dueDate: new Date().toISOString().slice(0, 10),
      description: params.description,
      externalReference,
    }),
  });
}

// Fase E: replaces the payment method a subscription charges, without
// billing anything at the moment of the call -- Asaas's own documented
// replacement for Stripe's "update default payment method" portal action.
// Live-verified against a real sandbox subscription before this shipped:
// 200, response echoes back a masked card (creditCardNumber's last 4,
// creditCardBrand, creditCardToken) confirming the swap actually took.
// Caught one real discrepancy in the process -- this endpoint 400s
// ("Esta assinatura não é do tipo cartão de crédito") on any subscription
// not created with billingType: CREDIT_CARD; harmless here because
// createCheckout() (this file's subscription-checkout sibling in
// billing-platform) only ever offers billingTypes: ["CREDIT_CARD"], so
// every billing_mode: "card" platform_subscriptions row is guaranteed to
// qualify -- but worth knowing if this function is ever reused elsewhere.
// Card data passes through this server only in-memory, forwarded
// immediately and never persisted -- same PCI posture Stripe.js gave for
// free client-side; Asaas has no equivalent, so this backend proxy is the
// documented way integrators do it here.
export async function updateSubscriptionCreditCard(params: {
  gatewaySubscriptionId: string;
  remoteIp: string;
  card: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  holderInfo: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
  };
}): Promise<void> {
  await request(`/subscriptions/${params.gatewaySubscriptionId}/creditCard`, {
    method: "PUT",
    body: JSON.stringify({
      creditCard: params.card,
      creditCardHolderInfo: params.holderInfo,
      remoteIp: params.remoteIp,
    }),
  });
}

export function parseOneOffExternalReference(
  externalReference: string | null | undefined,
): { action: string; invoiceId: string; refId: string | null } | null {
  if (!externalReference) return null;
  const [action, invoiceId, refId] = externalReference.split("|");
  if (!action || !invoiceId) return null;
  return { action, invoiceId, refId: refId || null };
}
