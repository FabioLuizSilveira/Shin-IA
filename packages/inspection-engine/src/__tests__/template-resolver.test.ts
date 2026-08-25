import { describe, it, expect } from "vitest";
import {
  resolveInspectionTemplate,
  InspectionTemplateResolutionError,
} from "../template-resolver.js";
import type { InspectionTemplateRepository } from "../repositories.js";
import type { HydratedInspectionTemplate } from "../types.js";

const fakeTemplate: HydratedInspectionTemplate = {
  id: "tmpl-1",
  tenantId: null,
  key: "vehicle_standard_v1",
  name: "Vehicle",
  assetTypeId: null,
  status: "published",
  version: 1,
  sections: [],
};

function makeRepo(
  overrides: Partial<InspectionTemplateRepository> = {},
): InspectionTemplateRepository {
  return {
    getHydratedTemplateById: async (id) => (id === "tmpl-1" ? fakeTemplate : null),
    getBlueprintMapping: async (blueprintId, purpose) =>
      blueprintId === "rental-cars" && purpose === "check_in"
        ? {
            id: "map-1",
            blueprintId: "rental-cars",
            purpose: "check_in",
            templateId: "tmpl-1",
            isDefault: true,
            required: true,
            aiDamageDetectionEnabled: false,
            aiRequiresHumanApproval: true,
          }
        : null,
    ...overrides,
  };
}

describe("resolveInspectionTemplate", () => {
  it("resolves the mapped template for a known blueprint/purpose pair", async () => {
    const template = await resolveInspectionTemplate(makeRepo(), "rental-cars", "check_in");
    expect(template.key).toBe("vehicle_standard_v1");
  });

  it("throws InspectionTemplateResolutionError for an unmapped blueprint — never a silent default", async () => {
    await expect(
      resolveInspectionTemplate(makeRepo(), "unknown-blueprint", "check_in"),
    ).rejects.toBeInstanceOf(InspectionTemplateResolutionError);
  });

  it("throws when the mapping points at a template that no longer exists", async () => {
    const repo = makeRepo({ getHydratedTemplateById: async () => null });
    await expect(resolveInspectionTemplate(repo, "rental-cars", "check_in")).rejects.toThrow(
      /does not exist/,
    );
  });
});
