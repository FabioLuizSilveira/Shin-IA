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

export function parseOneOffExternalReference(
  externalReference: string | null | undefined,
): { action: string; invoiceId: string; refId: string | null } | null {
  if (!externalReference) return null;
  const [action, invoiceId, refId] = externalReference.split("|");
  if (!action || !invoiceId) return null;
  return { action, invoiceId, refId: refId || null };
}
