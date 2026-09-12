import type { SupabaseClient } from "@supabase/supabase-js";

// WAVE 2 — Usage Metering (spec section 24). Read-only aggregation over
// messaging_usage_events, already written by outbound.ts's sendOutboundText.
// No PricingPolicy engine yet (PASS_THROUGH/MARKUP/INCLUDED_QUOTA/PACKAGE/
// HYBRID) — that's real product/billing work for a later wave; this is
// just the observability surface spec section 30 asks for.

export interface UsageSummary {
  totalMessages: number;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
}

export async function getUsageSummary(
  db: SupabaseClient,
  tenantId: string,
  since?: string,
): Promise<UsageSummary> {
  let query = db
    .from("messaging_usage_events")
    .select("category, message_type")
    .eq("tenant_id", tenantId);
  if (since) query = query.gte("occurred_at", since);
  const { data, error } = await query;
  if (error) throw error;

  const byCategory: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const row of data ?? []) {
    const category = (row.category as string | null) ?? "uncategorized";
    const type = (row.message_type as string | null) ?? "unknown";
    byCategory[category] = (byCategory[category] ?? 0) + 1;
    byType[type] = (byType[type] ?? 0) + 1;
  }

  return { totalMessages: data?.length ?? 0, byCategory, byType };
}
