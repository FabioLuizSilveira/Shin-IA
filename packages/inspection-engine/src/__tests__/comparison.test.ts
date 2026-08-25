import { describe, it, expect } from "vitest";
import { computeComparisons } from "../comparison.js";
import type { HydratedInspectionTemplate, InspectionResponse } from "../types.js";

const template: HydratedInspectionTemplate = {
  id: "tmpl-1",
  tenantId: null,
  key: "test",
  name: "Test",
  assetTypeId: null,
  status: "published",
  version: 1,
  sections: [
    {
      id: "sec-1",
      templateId: "tmpl-1",
      key: "identification",
      title: "Identification",
      instructions: null,
      sortOrder: 1,
      items: [
        {
          id: "item-fuel",
          sectionId: "sec-1",
          templateId: "tmpl-1",
          key: "fuel_level",
          label: "Fuel",
          fieldType: "percentage",
          required: true,
          instructions: null,
          referenceImageUrl: null,
          minPhotos: null,
          maxPhotos: null,
          selectOptions: null,
          condition: null,
          approvalGate: false,
          sortOrder: 1,
        },
        {
          id: "item-tires",
          sectionId: "sec-1",
          templateId: "tmpl-1",
          key: "tires",
          label: "Tires",
          fieldType: "condition",
          required: true,
          instructions: null,
          referenceImageUrl: null,
          minPhotos: null,
          maxPhotos: null,
          selectOptions: null,
          condition: null,
          approvalGate: false,
          sortOrder: 2,
        },
      ],
    },
  ],
};

function response(itemId: string, partial: Partial<InspectionResponse>): InspectionResponse {
  return {
    id: `resp-${itemId}`,
    tenantId: "t1",
    inspectionId: "insp-1",
    itemId,
    valueText: null,
    valueNumber: null,
    valueBoolean: null,
    valueJson: null,
    notes: null,
    ...partial,
  };
}

describe("computeComparisons", () => {
  it("reports fuel dropping from 100% to 62% as differing", () => {
    const result = computeComparisons({
      template,
      beforeResponses: [response("item-fuel", { valueNumber: 100 })],
      afterResponses: [response("item-fuel", { valueNumber: 62 })],
    });
    const fuel = result.find((r) => r.itemKey === "fuel_level")!;
    expect(fuel.beforeValue).toBe(100);
    expect(fuel.afterValue).toBe(62);
    expect(fuel.differs).toBe(true);
  });

  it("reports an identical select answer as not differing", () => {
    const ok = { value: "ok", label: "OK" };
    const result = computeComparisons({
      template,
      beforeResponses: [response("item-tires", { valueJson: ok })],
      afterResponses: [response("item-tires", { valueJson: { ...ok } })],
    });
    const tires = result.find((r) => r.itemKey === "tires")!;
    expect(tires.differs).toBe(false);
  });

  it("reports a changed condition (OK -> DANIFICADO) as differing", () => {
    const result = computeComparisons({
      template,
      beforeResponses: [response("item-tires", { valueJson: { value: "ok", label: "OK" } })],
      afterResponses: [
        response("item-tires", {
          valueJson: { value: "damaged", label: "Danificado", severity: "high" },
        }),
      ],
    });
    const tires = result.find((r) => r.itemKey === "tires")!;
    expect(tires.differs).toBe(true);
  });

  it("compares missing-on-both-sides as null vs null, never differs", () => {
    const result = computeComparisons({ template, beforeResponses: [], afterResponses: [] });
    expect(result.every((r) => r.differs === false)).toBe(true);
  });
});
