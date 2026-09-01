import type { SupabaseClient } from "@supabase/supabase-js";
import { StripeBillingProvider } from "./providers/stripe.js";
import { AsaasBillingProvider } from "./providers/asaas.js";
import type { BillingProvider } from "./types.js";

// Gateway selection via BILLING_PROVIDER — this is the seam the Stripe ->
// Asaas migration plan hangs the whole cutover on. "stripe" stays the
// default until Fase F confirms zero active Stripe-backed subscriptions
// remain (see the migration plan's Fase F) and the Stripe branch is
// removed for real.
export function createBillingProvider(db: SupabaseClient): BillingProvider {
  const provider = process.env.BILLING_PROVIDER ?? "stripe";
  switch (provider) {
    case "stripe":
      return new StripeBillingProvider({
        secretKey: process.env.STRIPE_SECRET_KEY ?? "",
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
        db,
      });
    case "asaas":
      return new AsaasBillingProvider({
        apiKey: process.env.ASAAS_API_KEY ?? "",
        env: process.env.ASAAS_ENV === "production" ? "production" : "sandbox",
        webhookAuthToken: process.env.ASAAS_WEBHOOK_AUTH_TOKEN,
        db,
      });
    default:
      throw new Error(`Unsupported BILLING_PROVIDER: ${provider}`);
  }
}
