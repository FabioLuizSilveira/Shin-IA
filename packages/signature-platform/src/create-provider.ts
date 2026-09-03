import { FakeSignatureProvider } from "./providers/fake.js";
import { ClicksignProvider } from "./providers/clicksign.js";
import type { SignatureProvider } from "./types.js";

// Provider selection via SIGNATURE_PROVIDER — no default/fallback (unlike
// createBillingProvider's `?? "asaas"`): a signature provider carries real
// legal consequences (spec section 29's per-request provider immutability,
// section 31's explicit no-auto-fallback rule), so the resolver forces an
// explicit choice rather than silently picking one. Only "fake" is
// implemented in P0 — "clicksign" (P1) throws until its adapter exists.
export function createSignatureProvider(): SignatureProvider {
  const provider = process.env.SIGNATURE_PROVIDER;
  if (!provider) {
    throw new Error(
      "SIGNATURE_PROVIDER is not set — no silent default for signature providers (see create-provider.ts)",
    );
  }
  switch (provider) {
    case "fake":
      return new FakeSignatureProvider("fake");
    case "clicksign": {
      // Sandbox only — see clicksign.ts's own header comment. No env var
      // here selects sandbox vs production; that branch doesn't exist in
      // the code at all yet (spec section 51).
      const apiKey = process.env.CLICKSIGN_API_KEY;
      const webhookSecret = process.env.CLICKSIGN_WEBHOOK_SECRET;
      if (!apiKey) throw new Error("CLICKSIGN_API_KEY is not set");
      if (!webhookSecret) throw new Error("CLICKSIGN_WEBHOOK_SECRET is not set");
      return new ClicksignProvider({ apiKey, webhookSecret });
    }
    default:
      throw new Error(`Unsupported or not-yet-implemented SIGNATURE_PROVIDER: ${provider}`);
  }
}
