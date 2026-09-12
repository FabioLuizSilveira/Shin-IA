import type { MessagingProvider } from "./types.js";
import { FakeMessagingProvider } from "./providers/fake.js";
import { MetaWhatsAppProvider } from "./providers/meta-whatsapp.js";

// Provider selection via MESSAGING_PROVIDER — no default/fallback, same
// discipline as @shina/signature-platform's createSignatureProvider(): an
// unset env var is a configuration bug, never silently routed to a real
// (or fake) gateway.
export function createMessagingProvider(
  getAccessToken: (messagingChannelId: string) => Promise<string>,
): MessagingProvider {
  const provider = process.env.MESSAGING_PROVIDER;

  switch (provider) {
    case "fake":
      return new FakeMessagingProvider();

    case "whatsapp": {
      const appSecret = process.env.META_APP_SECRET;
      const webhookVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
      if (!appSecret || !webhookVerifyToken) {
        throw new Error(
          "MESSAGING_PROVIDER=whatsapp requires META_APP_SECRET and META_WEBHOOK_VERIFY_TOKEN — " +
            "no real WhatsApp connection can be made without them (blocked, per spec section 38, " +
            "not a silent fallback).",
        );
      }
      return new MetaWhatsAppProvider({
        appSecret,
        webhookVerifyToken,
        graphApiVersion: process.env.META_GRAPH_API_VERSION ?? "v26.0",
        getAccessToken,
      });
    }

    default:
      throw new Error(
        "MESSAGING_PROVIDER is not set — no silent default for messaging providers " +
          '(see create-provider.ts). Set it to "fake" (tests/sandbox) or "whatsapp" (real, ' +
          "requires META_APP_SECRET + META_WEBHOOK_VERIFY_TOKEN).",
      );
  }
}
