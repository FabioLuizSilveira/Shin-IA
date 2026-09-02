import type { SupabaseClient } from "@supabase/supabase-js";
import { AsaasBillingProvider } from "./providers/asaas.js";
import type { BillingProvider } from "./types.js";

// Gateway selection via BILLING_PROVIDER. Fase F of the Stripe -> Asaas
// migration removed the "stripe" branch for real: zero active Stripe-backed
// platform_subscriptions confirmed beforehand (see the migration plan's own
// Fase F gate), StripeBillingProvider deleted along with it. "asaas" is now
// the only supported value — MERCADOPAGO_ACCESS_TOKEN stays reserved for a
// possible future provider, same as before.
export function createBillingProvider(db: SupabaseClient): BillingProvider {
  const provider = process.env.BILLING_PROVIDER ?? "asaas";
  switch (provider) {
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
