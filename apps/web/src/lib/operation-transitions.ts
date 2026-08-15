import type { SupabaseClient } from "@supabase/supabase-js";

// Single source of truth for the operation status state machine — used by
// both the mutation route (api/operations/[id]) and the mobile detail
// endpoint's allowedActions computation (api/mobile/operations/[id]).
// Previously only existed inline in the PATCH handler; extracted so the two
// can never drift, per the "mobile never decides transitions, only mirrors
// what the server would allow" requirement — allowedActions is always
// derived from this exact map, and the server always re-validates it here
// again at mutation time regardless of what was shown.
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled", "failed"],
};

// The customer-side contract linked to an operation, if any — same lookup
// used by the PATCH route's OperationContractGate check and by the mobile
// detail endpoint's allowedActions preview, extracted so both always agree
// on which contract governs a given operation.
export async function resolveOperationContractId(
  db: SupabaseClient,
  operationId: string,
): Promise<string | null> {
  const { data } = await db
    .from("tenant_contract_requirements")
    .select("contract_id")
    .eq("operation_id", operationId)
    .eq("party_type", "customer")
    .order("resolved_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.contract_id ?? null;
}
