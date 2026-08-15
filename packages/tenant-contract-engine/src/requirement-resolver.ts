import type { SupabaseClient } from "@supabase/supabase-js";
import { ContractTemplateEngine } from "./template-engine.js";
import type { RequirementResolutionInput, RequirementResolutionResult } from "./types.js";

export class NoContractMappingError extends Error {
  constructor(blueprintId: string, partyType: string) {
    super(
      `No contract template mapped for blueprint "${blueprintId}" (party_type: ${partyType}) — ` +
        `never falls back to a universal contract, add a blueprint_contract_mappings row instead`,
    );
    this.name = "NoContractMappingError";
  }
}

async function resolveTemplateForTenant(
  db: SupabaseClient,
  input: { tenantId: string; templateKey: string; partyType: string },
) {
  const { data: tenantTemplate } = await db
    .from("tenant_contract_templates")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("key", input.templateKey)
    .eq("party_type", input.partyType)
    .eq("status", "active")
    .maybeSingle();
  if (tenantTemplate) return tenantTemplate;

  const { data: globalTemplate } = await db
    .from("tenant_contract_templates")
    .select("id")
    .is("tenant_id", null)
    .eq("key", input.templateKey)
    .eq("party_type", input.partyType)
    .eq("status", "active")
    .maybeSingle();
  return globalTemplate;
}

// The single entry point that decides which contract applies to an
// operation — never a universal contract, always resolved from
// Tenant/Blueprint/Asset Type/Operation context (item 7/princípio central).
export const TenantContractRequirementResolver = {
  async resolve(
    db: SupabaseClient,
    input: RequirementResolutionInput,
  ): Promise<RequirementResolutionResult> {
    const { data: mappings, error: mappingError } = await db
      .from("blueprint_contract_mappings")
      .select("contract_template_key, is_default")
      .eq("blueprint_id", input.blueprintId)
      .order("is_default", { ascending: false });
    if (mappingError) throw new Error(`failed to load blueprint mapping: ${mappingError.message}`);
    if (!mappings || mappings.length === 0) {
      throw new NoContractMappingError(input.blueprintId, input.partyType);
    }

    let template: { id: string } | null = null;
    for (const mapping of mappings) {
      template = await resolveTemplateForTenant(db, {
        tenantId: input.tenantId,
        templateKey: mapping.contract_template_key,
        partyType: input.partyType,
      });
      if (template) break;
    }
    if (!template) {
      throw new NoContractMappingError(input.blueprintId, input.partyType);
    }

    const { data: version, error: versionError } = await db
      .from("tenant_contract_versions")
      .select("id")
      .eq("template_id", template.id)
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (versionError) throw new Error(`failed to load contract version: ${versionError.message}`);
    if (!version) {
      throw new Error(`Contract template ${template.id} has no published version`);
    }

    const consumerRelationship = input.consumerRelationship ?? "undetermined";
    const dataProcessingLegalBasis = input.dataProcessingLegalBasis ?? null;

    const rendered = await ContractTemplateEngine.render(db, {
      templateId: template.id,
      context: {
        operatorIncluded: input.operatorIncluded,
        operatorRequired: input.operatorRequired,
        trackingEnabled: input.trackingEnabled,
        insuranceIncluded: !!input.insuranceType,
        insuranceType: input.insuranceType ?? null,
        consumerRelationship,
      },
    });

    const { data: requirement, error: insertError } = await db
      .from("tenant_contract_requirements")
      .insert({
        tenant_id: input.tenantId,
        operation_id: input.operationId ?? null,
        contract_id: input.contractId ?? null,
        party_type: input.partyType,
        customer_id: input.customerId ?? null,
        operator_id: input.operatorId ?? null,
        blueprint_id: input.blueprintId,
        asset_type_id: input.assetTypeId ?? null,
        operation_type: input.operationType ?? null,
        operator_required: input.operatorRequired,
        operator_included: input.operatorIncluded,
        tracking_enabled: input.trackingEnabled,
        insurance_type: input.insuranceType ?? null,
        pricing_model: input.pricingModel ?? null,
        jurisdiction: input.jurisdiction ?? null,
        consumer_relationship: consumerRelationship,
        data_processing_legal_basis: dataProcessingLegalBasis,
        resolved_template_id: template.id,
        resolved_version_id: version.id,
        required_clause_keys: rendered.includedClauseKeys,
      })
      .select("id")
      .single();
    if (insertError || !requirement) {
      throw new Error(`failed to record contract requirement: ${insertError?.message}`);
    }

    return {
      requirementId: requirement.id,
      templateId: template.id,
      versionId: version.id,
      requiredClauseKeys: rendered.includedClauseKeys,
      consumerRelationship,
      dataProcessingLegalBasis,
    };
  },
};
