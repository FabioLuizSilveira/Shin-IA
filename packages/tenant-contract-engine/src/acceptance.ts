import type { SupabaseClient } from "@supabase/supabase-js";
import type { PartyType, RecordAcceptanceInput } from "./types.js";

export interface RecordAcceptanceResult {
  acceptanceId: string;
}

// accepted_at/ip_address/user_agent always come from the request context
// passed by the caller (server-side), never from a client-controlled body —
// same rule already applied to commercial_flow's recordContractAcceptance.
export async function recordContractAcceptance(
  db: SupabaseClient,
  input: RecordAcceptanceInput,
): Promise<RecordAcceptanceResult> {
  if (input.partyType === "customer" && !input.customerId) {
    throw new Error("customerId is required when partyType is customer");
  }
  if (input.partyType === "operator" && !input.operatorId) {
    throw new Error("operatorId is required when partyType is operator");
  }

  // Never trust that contractVersionId/snapshotId presented by the caller
  // actually belong to this contract — re-derive from the contract row
  // itself and compare, so a client can't accept against a version/snapshot
  // that was never actually presented for this contract (item 29's
  // "plan_version_id divergente" check, applied here).
  const { data: contract, error: contractError } = await db
    .from("contracts")
    .select("template_version_id, snapshot_id")
    .eq("id", input.contractId)
    .single();
  if (contractError || !contract) {
    throw new Error(`acceptance rejected: contract ${input.contractId} not found`);
  }
  if (contract.template_version_id !== input.contractVersionId) {
    throw new Error(
      `acceptance rejected: contractVersionId does not match the version resolved for this contract`,
    );
  }
  if (contract.snapshot_id !== input.snapshotId) {
    throw new Error(
      `acceptance rejected: snapshotId does not match the snapshot generated for this contract`,
    );
  }

  const { data, error } = await db
    .from("tenant_contract_acceptances")
    .insert({
      tenant_id: input.tenantId,
      party_type: input.partyType,
      customer_id: input.customerId ?? null,
      operator_id: input.operatorId ?? null,
      user_id: input.userId,
      operation_id: input.operationId ?? null,
      contract_id: input.contractId,
      contract_version_id: input.contractVersionId,
      snapshot_id: input.snapshotId,
      ip_address: input.request.ipAddress ?? null,
      user_agent: input.request.userAgent ?? null,
      session_id: input.request.sessionId ?? null,
      document_hash: input.documentHash,
      acceptance_method: input.acceptanceMethod,
      consented_data_processing: input.consentedDataProcessing ?? false,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`acceptance insert failed: ${error?.message}`);
  return { acceptanceId: data.id };
}

export async function hasAcceptedContract(
  db: SupabaseClient,
  input: {
    contractId: string;
    partyType: PartyType;
    customerId?: string | null;
    operatorId?: string | null;
  },
): Promise<boolean> {
  let query = db
    .from("tenant_contract_acceptances")
    .select("id")
    .eq("contract_id", input.contractId)
    .eq("party_type", input.partyType);

  query =
    input.partyType === "customer"
      ? query.eq("customer_id", input.customerId ?? "")
      : query.eq("operator_id", input.operatorId ?? "");

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new Error(`acceptance lookup failed: ${error.message}`);
  return !!data;
}
