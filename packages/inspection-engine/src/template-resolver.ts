import type { InspectionTemplateRepository } from "./repositories.js";
import type { HydratedInspectionTemplate, InspectionPurpose } from "./types.js";

// Thrown instead of falling back to a default/universal template — same
// principle as packages/tenant-contract-engine's
// TenantContractRequirementResolver: a blueprint with no mapping is a
// real configuration gap that must surface as an error, never a silent
// fallback (item 30 of the spec: config-driven, not hardcoded, and a
// missing config entry is a bug to fix, not a default to paper over).
export class InspectionTemplateResolutionError extends Error {
  constructor(
    public readonly blueprintId: string,
    public readonly purpose: InspectionPurpose,
    message: string,
  ) {
    super(message);
    this.name = "InspectionTemplateResolutionError";
  }
}

export async function resolveInspectionTemplate(
  repo: InspectionTemplateRepository,
  blueprintId: string,
  purpose: InspectionPurpose,
): Promise<HydratedInspectionTemplate> {
  const mapping = await repo.getBlueprintMapping(blueprintId, purpose);
  if (!mapping) {
    throw new InspectionTemplateResolutionError(
      blueprintId,
      purpose,
      `no inspection template mapped for blueprint "${blueprintId}" / purpose "${purpose}"`,
    );
  }

  const template = await repo.getHydratedTemplateById(mapping.templateId);
  if (!template) {
    throw new InspectionTemplateResolutionError(
      blueprintId,
      purpose,
      `blueprint_inspection_mappings points at template "${mapping.templateId}", which does not exist`,
    );
  }

  return template;
}
