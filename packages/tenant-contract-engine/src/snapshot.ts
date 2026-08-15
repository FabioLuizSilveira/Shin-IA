import type { SupabaseClient } from "@supabase/supabase-js";

export interface CreateSnapshotInput {
  tenantId: string;
  contractId: string;
  templateVersionId: string;
  renderedContent: string;
  contentHash: string;
}

export interface ContractSnapshot {
  id: string;
}

// Immutable — insert only, mirrors commercial_terms_snapshots' discipline of
// never re-deriving what was actually presented at acceptance time.
export async function createContractSnapshot(
  db: SupabaseClient,
  input: CreateSnapshotInput,
): Promise<ContractSnapshot> {
  const { data, error } = await db
    .from("tenant_contract_snapshots")
    .insert({
      tenant_id: input.tenantId,
      contract_id: input.contractId,
      template_version_id: input.templateVersionId,
      rendered_content: input.renderedContent,
      content_hash: input.contentHash,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`snapshot insert failed: ${error?.message}`);
  return data;
}
