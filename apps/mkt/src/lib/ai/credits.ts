import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CreditEventType =
  | "CREDIT_GRANT"
  | "AI_USAGE"
  | "CREDIT_PURCHASE"
  | "PLAN_RENEWAL"
  | "ADJUSTMENT"
  | "REFUND"
  | "EXPIRATION";

/** Read-only pre-check — never mutates the ledger. */
export async function getCreditBalance(workspaceId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mkt_ai_credit_balances")
    .select("balance")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return data?.balance ?? 0;
}

export class InsufficientCreditsError extends Error {
  constructor(
    public required: number,
    public available: number,
  ) {
    super(
      `Créditos Shinã insuficientes: necessário ${required.toFixed(2)}, disponível ${available.toFixed(2)}.`,
    );
  }
}

/**
 * Applies a signed credit delta atomically via mkt_apply_ai_credit_event()
 * (security-definer Postgres function — see the AI gateway migration).
 * Positive delta = grant, negative = usage/debit. Rejects (raises
 * insufficient_credits) if a debit would take the balance negative.
 */
async function applyCreditEvent(
  supabase: SupabaseClient,
  input: {
    workspaceId: string;
    tenantId: string;
    eventType: CreditEventType;
    delta: number;
    usageId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<number> {
  const { data, error } = await supabase.rpc("mkt_apply_ai_credit_event", {
    p_workspace_id: input.workspaceId,
    p_tenant_id: input.tenantId,
    p_event_type: input.eventType,
    p_delta: input.delta,
    p_usage_id: input.usageId ?? null,
    p_metadata: input.metadata ?? {},
  });
  if (error) {
    if (error.message.includes("insufficient_credits")) {
      const available = await getCreditBalance(input.workspaceId);
      throw new InsufficientCreditsError(-input.delta, available);
    }
    throw error;
  }
  return data as number;
}

export async function consumeCredits(input: {
  workspaceId: string;
  tenantId: string;
  credits: number;
  usageId: string;
  metadata?: Record<string, unknown>;
}): Promise<number> {
  const supabase = await createClient();
  return applyCreditEvent(supabase, {
    workspaceId: input.workspaceId,
    tenantId: input.tenantId,
    eventType: "AI_USAGE",
    delta: -Math.abs(input.credits),
    usageId: input.usageId,
    metadata: input.metadata,
  });
}

export async function grantCredits(input: {
  workspaceId: string;
  tenantId: string;
  credits: number;
  eventType?: Extract<
    CreditEventType,
    "CREDIT_GRANT" | "CREDIT_PURCHASE" | "PLAN_RENEWAL" | "ADJUSTMENT" | "REFUND"
  >;
  metadata?: Record<string, unknown>;
}): Promise<number> {
  const supabase = await createClient();
  return applyCreditEvent(supabase, {
    workspaceId: input.workspaceId,
    tenantId: input.tenantId,
    eventType: input.eventType ?? "CREDIT_GRANT",
    delta: Math.abs(input.credits),
    metadata: input.metadata,
  });
}
