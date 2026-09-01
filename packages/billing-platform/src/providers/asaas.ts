import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BillingProvider,
  CreateCheckoutParams,
  CreateCustomerParams,
  CreatePortalParams,
  PlatformSubscription,
  SubscriptionProduct,
  SyncWebhookResult,
} from "../types.js";

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
      .select("id, stripe_customer_id")
      .eq("auth_user_id", params.authUserId)
      .maybeSingle();

    if (existing?.stripe_customer_id) {
      return { customerId: existing.stripe_customer_id };
    }

    // Never invent a document -- Asaas requires a real cpfCnpj, and a
    // placeholder value would create a customer record tied to a fake
    // legal document (potentially a compliance problem, not just a bug).
    if (!params.document) {
      throw new Error(
        "AsaasBillingProvider.createCustomer requires a document (CPF/CNPJ) — none was provided",
      );
    }

    // Written into the same `stripe_customer_id` text column the Stripe
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
        { auth_user_id: params.authUserId, email: params.email, stripe_customer_id: customer.id },
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
      // Asaas metadata equivalent — externalReference is the only free-text
      // field this resource carries; our checkout_ref_id (the reconciliation
      // anchor commercial-platform needs) is packed in here as JSON, same
      // role Stripe's `metadata` object plays.
      externalReference: JSON.stringify({
        product: params.product,
        plan: params.planKey,
        ...params.metadata,
      }),
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
      .select("stripe_subscription_id")
      .eq("id", subscriptionId)
      .maybeSingle();
    if (!sub?.stripe_subscription_id) throw new Error("Subscription has no gateway id");
    // Same "gateway confirms, then we sync" posture as Stripe: DB status
    // only changes when the SUBSCRIPTION_DELETED/INACTIVATED webhook fires.
    await this.request("DELETE", `/subscriptions/${sub.stripe_subscription_id}`);
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
      .select("stripe_subscription_id")
      .eq("id", subscriptionId)
      .maybeSingle();
    if (!sub?.stripe_subscription_id) throw new Error("Subscription has no gateway id");

    // UNVERIFIED field name (see file header) -- Fase A's live sandbox
    // test must confirm `value` actually changes the charge amount before
    // this is trusted with a real subscription.
    await this.request("PUT", `/subscriptions/${sub.stripe_subscription_id}`, {
      value: params.amountCents / 100,
    });
  }

  async syncWebhook(_rawBody: string, signature: string): Promise<SyncWebhookResult> {
    if (!this.webhookAuthToken) throw new Error("ASAAS_WEBHOOK_AUTH_TOKEN not configured");
    // Asaas's webhook auth is a static shared-secret header comparison
    // (asaas-access-token), not an HMAC over the body — confirmed against
    // docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook.
    // Timing-safe compare, same discipline as the fleet-location webhook's
    // HMAC check elsewhere in this codebase.
    if (!timingSafeEqual(signature, this.webhookAuthToken)) {
      throw new Error("Invalid Asaas webhook token");
    }
    // Fase B wires this into applyBillingEvent() via the normalized event
    // mapper -- left unimplemented here on purpose so Fase A's scope
    // (customer/checkout/cancel/update against the real sandbox) can ship
    // and be verified independently of the webhook/idempotency work.
    throw new Error("AsaasBillingProvider.syncWebhook not implemented yet (Fase B)");
  }
}
