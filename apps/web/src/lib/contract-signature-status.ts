import type { SupabaseClient } from "@supabase/supabase-js";
import type { SignatureStatus, SignerRole, SignerStatus } from "@shina/signature-platform";

export interface ContractSignatureSigner {
  role: SignerRole;
  name: string;
  status: SignerStatus;
}

export interface ContractSignatureStatus {
  id: string;
  provider: string;
  status: SignatureStatus;
  signers: ContractSignatureSigner[];
}

// One query, reused by 3 read paths (tenant contract-detail, customer
// portal, mobile contract-detail) — avoids triplicating the same
// signature_requests/signature_signers join. Returns only the LATEST
// request for the contract (a contract could in principle have an old
// cancelled request followed by a fresh one — callers only ever care
// about the current one). Never leaks a provider's own nomenclature —
// only canonical fields.
export async function getSignatureStatusForContract(
  db: SupabaseClient,
  contractId: string,
): Promise<ContractSignatureStatus | null> {
  const { data: request } = await db
    .from("signature_requests")
    .select("id, provider, status")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!request) return null;

  const { data: signers } = await db
    .from("signature_signers")
    .select("role, name, status")
    .eq("signature_request_id", request.id);

  return {
    id: request.id,
    provider: request.provider,
    status: request.status,
    signers: (signers ?? []) as ContractSignatureSigner[],
  };
}
