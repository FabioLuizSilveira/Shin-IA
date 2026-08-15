import type { SupabaseClient } from "@supabase/supabase-js";
import type { PartyType } from "./types.js";

export interface DocumentRequirement {
  id: string;
  key: string;
  label: string;
  isMandatory: boolean;
}

export async function resolveRequiredDocuments(
  db: SupabaseClient,
  templateId: string,
): Promise<DocumentRequirement[]> {
  const { data, error } = await db
    .from("contract_document_requirements")
    .select("id, key, label, is_mandatory")
    .eq("template_id", templateId);
  if (error) throw new Error(`failed to load document requirements: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    isMandatory: row.is_mandatory,
  }));
}

export async function hasApprovedDocuments(
  db: SupabaseClient,
  input: {
    contractId: string;
    templateId: string;
    partyType: PartyType;
    customerId?: string | null;
    operatorId?: string | null;
  },
): Promise<boolean> {
  const required = await resolveRequiredDocuments(db, input.templateId);
  const mandatory = required.filter((r) => r.isMandatory);
  if (mandatory.length === 0) return true;

  let query = db
    .from("contract_documents")
    .select("requirement_id, status")
    .eq("contract_id", input.contractId)
    .eq("party_type", input.partyType)
    .eq("status", "approved");
  query =
    input.partyType === "customer"
      ? query.eq("customer_id", input.customerId ?? "")
      : query.eq("operator_id", input.operatorId ?? "");

  const { data, error } = await query;
  if (error) throw new Error(`failed to load contract documents: ${error.message}`);

  const approvedRequirementIds = new Set((data ?? []).map((row) => row.requirement_id));
  return mandatory.every((req) => approvedRequirementIds.has(req.id));
}
