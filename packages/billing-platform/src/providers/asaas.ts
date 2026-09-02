import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BillingProvider,
  CreateCheckoutParams,
  CreateCustomerParams,
  CreatePortalParams,
  NormalizedBillingEvent,
  PlatformSubscription,
  SubscriptionProduct,
  SubscriptionStatus,
  SyncWebhookResult,
} from "../types.js";
import { applyBillingEvent } from "../sync-webhook.js";

// Asaas billing provider (Fase A of the Stripe -> Asaas migration). Every
// call is authenticated via the `access_token` header (NOT a Bearer
// scheme -- confirmed against docs.asaas.com/docs/autenticação-1), not
// via an SDK -- Asaas has no official Node SDK, so this is a thin fetch
// wrapper, same shape as any other REST integration in this codebase.
//
// Endpoints below were each confirmed individually against the live
// docs.asaas.com reference (method + path + request/response schema),
// not guessed -- see the migration plan for the research trail. One
// exception, flagged where it matters: the PUT /v3/subscriptions/{id}
// schema as scraped doesn't list a `value` field even though Asaas's own
// prose says the charge amount can be changed (a known limitation of the
// markdown-export tooling, not a code decision) -- updateSubscription()
// sends `value` as the most likely real field name, but this is
// UNVERIFIED until Fase A's live sandbox test round-trips it.

export interface AsaasBillingProviderOptions {
  apiKey: string;
  env: "sandbox" | "production";
  webhookAuthToken?: string;
  /** Service-role Supabase client — all billing tables are service-role-only. */
  db: SupabaseClient;
}

const BASE_URL: Record<AsaasBillingProviderOptions["env"], string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
};

// Checkout pages live on a different host than the API, and sandbox vs
// production differ (live-confirmed during Fase A -- a checkout created
// against the sandbox API resolves at sandbox.asaas.com, not asaas.com).
const CHECKOUT_HOST: Record<AsaasBillingProviderOptions["env"], string> = {
  sandbox: "https://sandbox.asaas.com",
  production: "https://asaas.com",
};

const CYCLE_MAP: Record<NonNullable<CreateCheckoutParams["billingCycle"]>, string> = {
  monthly: "MONTHLY",
  yearly: "YEARLY",
};

interface AsaasErrorBody {
  errors?: { code?: string; description?: string }[];
}

// Webhook envelope, live-confirmed against docs.asaas.com/docs/webhook-
// para-cobrancas and .../eventos-para-assinaturas (not guessed): every
// delivery has a top-level `id` (the delivery id -- Asaas's own docs say
// "utilize o campo id do evento para evitar processamento duplicado",
// this is our idempotency key) and `event` (the event name), with the
// actual resource nested under `subscription` or `payment` depending on
// which fired.
interface AsaasWebhookEnvelope {
  id: string;
  event: string;
  subscription?: { id: string; customer: string; status: string; externalReference: string | null };
  payment?: { id: string; subscription?: string; status: string; externalReference: string | null };
}

const ASAAS_SUBSCRIPTION_STATUS_MAP: Record<string, SubscriptionStatus> = {
  ACTIVE: "active",
  INACTIVE: "suspended",
  EXPIRED: "cancelled",
};

// Maps a verified Asaas webhook delivery into the same normalized shape
// StripeBillingProvider produces (mapStripeEventToNormalized). Exported
// standalone (not just a class method) so a raw webhook route that
// already has its own verified payload -- same pattern as the existing
// Stripe commercial webhook routes -- can normalize it without going
// through the class.
//
// Deliberately scoped: only SUBSCRIPTION_* events drive activation/status
// changes this round. PAYMENT_* events are logged (kind: null) but not
// acted on -- Asaas's own guidance says payment events are a separate
// per-charge stream correlated via `payment.subscription`, and mapping
// PAYMENT_OVERDUE into a "past_due" status transition needs its own
// verification pass, not bundled into this phase (documented gap, not a
// silent omission -- see the migration plan's Fase B).
//
// One thing this mapper canNOT resolve on its own: authUserId. Asaas's
// subscription object carries `externalReference` (our checkout_ref_id,
// see AsaasBillingProvider.createCheckout's own comment on why it's just
// that one id, not a full metadata blob) but never our internal user id
// directly -- commercial-platform's activateFromWebhook() resolves that
// via checkout_session_references before calling applyBillingEvent(),
// since only that package's schema has that table. authUserId is left
// null here on purpose, not guessed.
export function mapAsaasEventToNormalized(envelope: AsaasWebhookEnvelope): NormalizedBillingEvent {
  const base = {
    provider: "asaas" as const,
    gatewayEventId: envelope.id,
    eventType: envelope.event,
    rawPayload: (envelope.subscription ?? envelope.payment ?? {}) as unknown as Record<
      string,
      unknown
    >,
  };

  switch (envelope.event) {
    case "SUBSCRIPTION_CREATED": {
      const sub = envelope.subscription;
      if (!sub) return { ...base, kind: null };
      return {
        ...base,
        kind: "checkout_completed",
        authUserId: null, // resolved by commercial-platform via checkoutRefId
        gatewayCustomerId: sub.customer,
        gatewaySubscriptionId: sub.id,
        checkoutRefId: sub.externalReference,
      };
    }

    case "SUBSCRIPTION_UPDATED": {
      const sub = envelope.subscription;
      if (!sub) return { ...base, kind: null };
      return {
        ...base,
        kind: "subscription_updated",
        gatewaySubscriptionId: sub.id,
        status: ASAAS_SUBSCRIPTION_STATUS_MAP[sub.status] ?? "pending",
        // Asaas doesn't expose a period_start/end pair the way Stripe
        // does -- never inventing one from nextDueDate (that's a due
        // date, not a period boundary). Left undefined, not guessed.
      };
    }

    case "SUBSCRIPTION_INACTIVATED":
    case "SUBSCRIPTION_DELETED": {
      const sub = envelope.subscription;
      if (!sub) return { ...base, kind: null };
      return { ...base, kind: "subscription_cancelled", gatewaySubscriptionId: sub.id };
    }

    default:
      return { ...base, kind: null };
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export class AsaasBillingProvider implements BillingProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly checkoutHost: string;
  private readonly webhookAuthToken?: string;
  private readonly db: SupabaseClient;

  constructor(options: AsaasBillingProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = BASE_URL[options.env];
    this.checkoutHost = CHECKOUT_HOST[options.env];
    this.webhookAuthToken = options.webhookAuthToken;
    this.db = options.db;
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        access_token: this.apiKey,
        // Asaas asks for a User-Agent identifying the integration.
        "User-Agent": "shina-platform",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const errorBody = (await res.json().catch(() => ({}))) as AsaasErrorBody;
      const description = errorBody.errors?.[0]?.description ?? res.statusText;
      throw new Error(`Asaas ${method} ${path} failed (${res.status}): ${description}`);
    }
    return (await res.json()) as T;
  }

  async createCustomer(params: CreateCustomerParams): Promise<{ customerId: string }> {
    const { data: existing } = await this.db
      .from("platform_customers")
      .select("id, gateway_customer_id")
      .eq("auth_user_id", params.authUserId)
      .maybeSingle();

    if (existing?.gateway_customer_id) {
      return { customerId: existing.gateway_customer_id };
    }

    // Never invent a document -- Asaas requires a real cpfCnpj, and a
    // placeholder value would create a customer record tied to a fake
    // legal document (potentially a compliance problem, not just a bug).
    if (!params.document) {
      throw new Error(
        "AsaasBillingProvider.createCustomer requires a document (CPF/CNPJ) — none was provided",
      );
    }

    // Written into the same `gateway_customer_id` text column the Stripe
    // provider uses -- it's untyped free text with no Stripe-specific
    // constraint, so this "just works" ahead of Fase D's rename to a
    // gateway-neutral column name; keeping the rename in its own phase
    // avoids touching Stripe's already-working read/write paths here.
    const customer = await this.request<{ id: string }>("POST", "/customers", {
      name: params.email, // overwritten by the caller with a real name where available
      email: params.email,
      cpfCnpj: params.document,
      externalReference: params.authUserId,
    });

    const { error } = await this.db
      .from("platform_customers")
      .upsert(
        { auth_user_id: params.authUserId, email: params.email, gateway_customer_id: customer.id },
        { onConflict: "auth_user_id" },
      );
    if (error) throw new Error(`customer upsert failed: ${error.message}`);

    return { customerId: customer.id };
  }

  async createCheckout(params: CreateCheckoutParams): Promise<{ url: string }> {
    if (params.amountCents === undefined || !params.billingCycle) {
      throw new Error("AsaasBillingProvider.createCheckout requires amountCents and billingCycle");
    }
    if (
      !params.document ||
      !params.phone ||
      !params.address ||
      !params.addressNumber ||
      !params.postalCode ||
      !params.province
    ) {
      // Live-verified against the Asaas sandbox: the checkout call 422s
      // without every one of these on customerData. Never substitute a
      // placeholder -- a fabricated address on a real payment gateway
      // customer record is worse than failing loudly here.
      throw new Error(
        "AsaasBillingProvider.createCheckout requires document, phone, address, addressNumber, postalCode and province",
      );
    }
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1); // first charge tomorrow, no same-day surprise

    // Response schema live-verified against the real sandbox (docs
    // disagreed with themselves on this): `link` IS present and is the
    // ready-to-use hosted URL (https://sandbox.asaas.com/checkoutSession/
    // show/{uuid} in sandbox -- note this is a PATH segment, not a
    // `?id=` query string as one guide page claimed, and the sandbox host
    // differs from production, contradicting that same page's "one
    // pattern for both" claim). `id` kept only as a defensive fallback.
    const checkout = await this.request<{ id: string; link?: string }>("POST", "/checkouts", {
      billingTypes: ["CREDIT_CARD"],
      chargeTypes: ["RECURRENT"],
      minutesToExpire: 60,
      callback: {
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
        expiredUrl: params.cancelUrl,
      },
      items: [
        {
          name: params.planName ?? params.planKey,
          description: `Assinatura ${params.product} — ${params.planKey}`,
          quantity: 1,
          value: params.amountCents / 100,
        },
      ],
      customerData: {
        name: params.customerName ?? params.email,
        email: params.email,
        cpfCnpj: params.document,
        // Field name confirmed live: the wire field is `phone`, not
        // `phoneNumber` -- the API's own error message says "phoneNumber"
        // when this is missing, which is misleading (an internal DTO
        // field name leaking into the error text, not the actual request
        // key). Plain digits, no formatting -- also live-confirmed.
        phone: params.phone,
        address: params.address,
        addressNumber: params.addressNumber,
        postalCode: params.postalCode,
        province: params.province,
      },
      subscription: {
        cycle: CYCLE_MAP[params.billingCycle],
        nextDueDate: nextDueDate.toISOString().slice(0, 10),
      },
      // externalReference is the only free-text field this resource
      // carries, and Asaas caps it at 200 chars -- live-verified: a
      // Stripe-style JSON blob of the full metadata object (product, plan,
      // tenant_id, plan_version_id, contract_acceptance_id,
      // commercial_terms_snapshot_id, ...) blew straight past that limit
      // and 400'd every real commercial-platform checkout. checkout_ref_id
      // alone is enough for the webhook to reconcile everything else --
      // commercial-platform already persisted the full context on the
      // checkout_session_references row at insert time (see
      // checkout-orchestration.ts) -- so that single id is all this needs
      // to carry. Callers with no checkout_ref_id (a bare product+plan
      // checkout, no commercial-platform layer above it) fall back to a
      // short "product:plan" string instead of the full metadata object.
      externalReference:
        params.metadata?.checkout_ref_id ?? `${params.product}:${params.planKey}`.slice(0, 200),
    });

    // `link` was present on every live sandbox response during Fase A's
    // verification -- this fallback is defensive only, using the correct
    // per-environment host (sandbox vs production checkout pages live on
    // different hosts, live-confirmed) and the real path shape
    // (/show/{id}, not a ?id= query string).
    const url = checkout.link ?? `${this.checkoutHost}/checkoutSession/show/${checkout.id}`;
    return { url };
  }

  async createPortal(_params: CreatePortalParams): Promise<{ url: string }> {
    // Confirmed against docs.asaas.com: there is no hosted self-service
    // billing portal equivalent to Stripe's. Callers must use the
    // tenant-facing manage-subscription UI (Fase E) instead of this
    // method when BILLING_PROVIDER=asaas.
    throw new Error(
      "Asaas has no hosted billing portal — use the tenant-facing manage-subscription UI instead",
    );
  }

  async getSubscription(
    authUserId: string,
    product: SubscriptionProduct,
  ): Promise<PlatformSubscription | null> {
    // DB-only, already gateway-agnostic — identical to StripeBillingProvider.
    const { data } = await this.db
      .from("platform_subscriptions")
      .select("*, platform_customers!inner(auth_user_id)")
      .eq("platform_customers.auth_user_id", authUserId)
      .eq("product", product)
      .neq("status", "cancelled")
      .maybeSingle();
    return (data as PlatformSubscription | null) ?? null;
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    const { data: sub } = await this.db
      .from("platform_subscriptions")
      .select("gateway_subscription_id")
      .eq("id", subscriptionId)
      .maybeSingle();
    if (!sub?.gateway_subscription_id) throw new Error("Subscription has no gateway id");
    // Same "gateway confirms, then we sync" posture as Stripe: DB status
    // only changes when the SUBSCRIPTION_DELETED/INACTIVATED webhook fires.
    await this.request("DELETE", `/subscriptions/${sub.gateway_subscription_id}`);
  }

  async updateSubscription(
    subscriptionId: string,
    params: { priceId?: string; amountCents?: number },
  ): Promise<void> {
    if (params.amountCents === undefined) {
      throw new Error("AsaasBillingProvider.updateSubscription requires amountCents");
    }
    const { data: sub } = await this.db
      .from("platform_subscriptions")
      .select("gateway_subscription_id")
      .eq("id", subscriptionId)
      .maybeSingle();
    if (!sub?.gateway_subscription_id) throw new Error("Subscription has no gateway id");

    // UNVERIFIED field name (see file header) -- Fase A's live sandbox
    // test must confirm `value` actually changes the charge amount before
    // this is trusted with a real subscription.
    await this.request("PUT", `/subscriptions/${sub.gateway_subscription_id}`, {
      value: params.amountCents / 100,
    });
  }

  async syncWebhook(rawBody: string, signature: string): Promise<SyncWebhookResult> {
    if (!this.webhookAuthToken) throw new Error("ASAAS_WEBHOOK_AUTH_TOKEN not configured");
    // Asaas's webhook auth is a static shared-secret header comparison
    // (asaas-access-token), not an HMAC over the body — confirmed against
    // docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook.
    // Timing-safe compare, same discipline as the fleet-location webhook's
    // HMAC check elsewhere in this codebase.
    if (!timingSafeEqual(signature, this.webhookAuthToken)) {
      throw new Error("Invalid Asaas webhook token");
    }
    const envelope = JSON.parse(rawBody) as AsaasWebhookEnvelope;
    const normalized = mapAsaasEventToNormalized(envelope);
    // NOTE (matches StripeBillingProvider's own real-world usage): the
    // real webhook routes (api/webhooks/asaas-commercial,
    // apps/mkt/api/webhooks/asaas) do NOT call this method directly --
    // same as the existing Stripe webhook routes never call
    // StripeBillingProvider.syncWebhook() either. They verify the payload
    // themselves and call commercial-platform's activateFromWebhook()
    // directly with mapAsaasEventToNormalized()'s output, because only
    // that layer can resolve authUserId from checkoutRefId (see this
    // file's own mapAsaasEventToNormalized comment). Calling
    // applyBillingEvent() here directly means a checkout_completed event
    // is a no-op (authUserId is null) -- this method exists for
    // BillingProvider interface completeness and any future generic
    // caller that doesn't need the commercial-platform reconciliation
    // step, not as the production activation path.
    return applyBillingEvent(this.db, normalized);
  }
}
