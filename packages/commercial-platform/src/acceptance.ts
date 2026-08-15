import type { SupabaseClient } from "@supabase/supabase-js";
import { hashContent } from "./hash.js";
import { resolvePlanVersion, resolveRequiredContract } from "./contract-requirement.js";
import { createCommercialTermsSnapshot } from "./snapshot.js";
import type { AcceptContractInput, Product } from "./types.js";

export interface AcceptContractResult {
  contractAcceptanceId: string;
  commercialTermsSnapshotId: string;
  planVersionId: string;
  contractVersionId: string;
}

// The single write path for a contract acceptance — accepted_at/ip/user_agent
// always come from the server request context passed in here, never from a
// client-controlled body field (item 9: "timestamp somente do backend").
export async function recordContractAcceptance(
  db: SupabaseClient,
  input: AcceptContractInput,
): Promise<AcceptContractResult> {
  if (!input.representative.declaredAuthority) {
    throw new Error("representative did not declare authority to accept on behalf of the tenant");
  }

  const contractVersion = await resolveRequiredContract(db, input.product);
  const planVersion = await resolvePlanVersion(db, input.planVersionId);
  if (planVersion.plans?.product !== input.product) {
    throw new Error(
      `plan version ${input.planVersionId} does not belong to product "${input.product}"`,
    );
  }

  const documentHash = await hashContent(contractVersion.content);

  const snapshot = await createCommercialTermsSnapshot(db, {
    tenantId: input.tenantId,
    userId: input.userId,
    product: input.product,
    planVersionId: input.planVersionId,
    contractVersion,
  });

  const { data: acceptance, error } = await db
    .from("contract_acceptances")
    .insert({
      tenant_id: input.tenantId,
      user_id: input.userId,
      product: input.product,
      plan_id: planVersion.plan_id,
      plan_version_id: input.planVersionId,
      commercial_terms_snapshot_id: snapshot.id,
      contract_version_id: contractVersion.id,
      ip_address: input.request.ipAddress,
      user_agent: input.request.userAgent,
      session_id: input.request.sessionId ?? null,
      document_hash: documentHash,
      representative_name: input.representative.name,
      representative_role: input.representative.role,
      representative_document: input.representative.document ?? null,
      declared_authority: input.representative.declaredAuthority,
    })
    .select("id")
    .single();
  if (error || !acceptance) throw new Error(`acceptance insert failed: ${error?.message}`);

  return {
    contractAcceptanceId: acceptance.id,
    commercialTermsSnapshotId: snapshot.id,
    planVersionId: input.planVersionId,
    contractVersionId: contractVersion.id,
  };
}

// Has this tenant (or, for a tenant-less MKT-only buyer, this user)
// accepted the currently-published contract version for this product? Used
// both to gate checkout and to render "pending acceptance" UI.
export async function hasAcceptedCurrentContract(
  db: SupabaseClient,
  input: { tenantId: string | null; userId: string; product: Product },
): Promise<boolean> {
  const currentVersion = await resolveRequiredContract(db, input.product).catch(() => null);
  if (!currentVersion) return false;

  let query = db
    .from("contract_acceptances")
    .select("id")
    .eq("product", input.product)
    .eq("contract_version_id", currentVersion.id);
  query = input.tenantId
    ? query.eq("tenant_id", input.tenantId)
    : query.eq("user_id", input.userId).is("tenant_id", null);

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new Error(`acceptance lookup failed: ${error.message}`);

  return !!data;
}
