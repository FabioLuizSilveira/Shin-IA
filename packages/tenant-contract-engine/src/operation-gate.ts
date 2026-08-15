import type { SupabaseClient } from "@supabase/supabase-js";
import { hasAcceptedContract } from "./acceptance.js";
import { hasApprovedDocuments } from "./document-requirements.js";
import { isBillingSatisfied } from "./billing-requirement.js";
import type { OperationGateResult } from "./types.js";

// Blocks release of an operation until its required contract (customer
// side only — an operator is typically the tenant's own employee or the
// equipment owner, so operator acceptance is record-keeping, never a
// release precondition, per explicit product decision) has been accepted,
// its mandatory documents approved, and its billing requirement satisfied.
export const OperationContractGate = {
  async check(
    db: SupabaseClient,
    input: { contractId: string | null },
  ): Promise<OperationGateResult> {
    if (!input.contractId) {
      return { blocked: false, reasons: [] };
    }

    const { data: contract, error } = await db
      .from("contracts")
      .select("id, template_id, billing_requirement")
      .eq("id", input.contractId)
      .single();
    if (error || !contract) {
      return { blocked: true, reasons: ["contract_not_found"] };
    }
    if (!contract.template_id) {
      // No dynamic contract requirement resolved for this contract — nothing
      // to gate on.
      return { blocked: false, reasons: [] };
    }

    const { data: acceptanceRow } = await db
      .from("tenant_contract_acceptances")
      .select("customer_id")
      .eq("contract_id", input.contractId)
      .eq("party_type", "customer")
      .limit(1)
      .maybeSingle();

    const reasons: string[] = [];

    if (!acceptanceRow) {
      reasons.push("contract_not_accepted");
    } else {
      const documentsOk = await hasApprovedDocuments(db, {
        contractId: input.contractId,
        templateId: contract.template_id,
        partyType: "customer",
        customerId: acceptanceRow.customer_id,
      });
      if (!documentsOk) reasons.push("required_documents_not_approved");
    }

    const billingOk = await isBillingSatisfied(db, input.contractId);
    if (!billingOk) reasons.push("billing_requirement_not_satisfied");

    return { blocked: reasons.length > 0, reasons };
  },
};

export { hasAcceptedContract };
