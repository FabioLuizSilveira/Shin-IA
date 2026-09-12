import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createMessagingProvider,
  getAccessTokenForChannel,
  type MessagingProvider,
} from "@shina/messaging-platform";

// WAVE 1 — wires @shina/messaging-platform's env-driven provider resolver
// to this app's DB for per-channel access-token resolution. Mirrors
// blueprint-runtime-factory.ts's own role: the package stays framework/DB-
// agnostic, this file is the one place that connects it to a real
// Supabase client.
export function createConfiguredMessagingProvider(db: SupabaseClient): MessagingProvider {
  return createMessagingProvider((channelId) => getAccessTokenForChannel(db, channelId));
}
