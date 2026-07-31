import type { SupabaseClient } from "@supabase/supabase-js";
import { StripeBillingProvider } from "./providers/stripe.js";
import type { BillingProvider } from "./types.js";

// Gateway selection via BILLING_PROVIDER. Only "stripe" exists today; a
// MercadoPago implementation would be added here (MERCADOPAGO_ACCESS_TOKEN
// is already reserved in .env.example for it) without touching call sites.
export function createBillingProvider(db: SupabaseClient): BillingProvider {
  const provider = process.env.BILLING_PROVIDER ?? "stripe";
  switch (provider) {
    case "stripe":
      return new StripeBillingProvider({
        secretKey: process.env.STRIPE_SECRET_KEY ?? "",
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
        db,
      });
    default:
      throw new Error(`Unsupported BILLING_PROVIDER: ${provider}`);
  }
}
