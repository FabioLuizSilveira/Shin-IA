import { describe, it, expect } from "vitest";
import { checkTemplateCompletion } from "../completion-validator.js";
import type { HydratedInspectionTemplate, InspectionResponse } from "../types.js";

function makeTemplate(): HydratedInspectionTemplate {
  return {
    id: "tmpl-1",
    tenantId: null,
    key: "test",
    name: "Test template",
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
            id: "item-plate",
            sectionId: "sec-1",
            templateId: "tmpl-1",
            key: "plate",
            label: "Plate",
            fieldType: "text",
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
            id: "item-front-photo",
            sectionId: "sec-1",
            templateId: "tmpl-1",
            key: "front",
            label: "Front",
            fieldType: "photo",
            required: true,
            instructions: null,
            referenceImageUrl: null,
            minPhotos: 2,
            maxPhotos: 4,
            selectOptions: null,
            condition: null,
            approvalGate: false,
            sortOrder: 2,
          },
          {
            id: "item-safety",
            sectionId: "sec-1",
            templateId: "tmpl-1",
            key: "safety_devices",
            label: "Safety devices",
            fieldType: "boolean",
            required: true,
            instructions: null,
            referenceImageUrl: null,
            minPhotos: null,
            maxPhotos: null,
            selectOptions: null,
            condition: null,
            approvalGate: true,
            sortOrder: 3,
          },
          {
            id: "item-fuel-policy",
            sectionId: "sec-1",
            templateId: "tmpl-1",
            key: "fuel_policy_note",
            label: "Fuel policy note",
            fieldType: "text",
            required: true,
            instructions: null,
            referenceImageUrl: null,
            minPhotos: null,
            maxPhotos: null,
            selectOptions: null,
            condition: { field: "fuel_policy_applies", op: "eq", value: true },
            approvalGate: false,
            sortOrder: 4,
          },
        ],
      },
    ],
  };
}

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

describe("checkTemplateCompletion", () => {
  it("reports a required text item with no response as missing", () => {
    const result = checkTemplateCompletion({
      template: makeTemplate(),
      responses: [],
      mediaCountByItemId: new Map(),
    });
    expect(result.canComplete).toBe(false);
    expect(result.missingRequiredItems.map((m) => m.itemKey)).toContain("plate");
  });

  it("reports a photo item below minPhotos as a violation, not a missing item", () => {
    const result = checkTemplateCompletion({
      template: makeTemplate(),
      responses: [response("item-plate", { valueText: "ABC-1234" })],
      mediaCountByItemId: new Map([["item-front-photo", 1]]),
    });
    expect(result.canComplete).toBe(false);
    expect(result.photoCountViolations).toEqual([
      { itemId: "item-front-photo", itemKey: "front", required: 2, actual: 1 },
    ]);
    expect(result.missingRequiredItems.some((m) => m.itemKey === "front")).toBe(false);
  });

  it("flags a gate item answered false as a gate failure without blocking canComplete by itself", () => {
    const result = checkTemplateCompletion({
      template: makeTemplate(),
      responses: [
        response("item-plate", { valueText: "ABC-1234" }),
        response("item-safety", { valueBoolean: false }),
      ],
      mediaCountByItemId: new Map([["item-front-photo", 2]]),
    });
    expect(result.gateFailures).toEqual([
      { itemId: "item-safety", itemKey: "safety_devices", reason: "marcado como reprovado" },
    ]);
  });

  it("skips a conditional item entirely when its condition is false", () => {
    const result = checkTemplateCompletion({
      template: makeTemplate(),
      responses: [
        response("item-plate", { valueText: "ABC-1234" }),
        response("item-safety", { valueBoolean: true }),
      ],
      mediaCountByItemId: new Map([["item-front-photo", 2]]),
    });
    // fuel_policy_note's condition (fuel_policy_applies === true) is never
    // set in the context built from these responses, so it must not be
    // reported as missing even though it's marked required.
    expect(result.missingRequiredItems.some((m) => m.itemKey === "fuel_policy_note")).toBe(false);
    expect(result.canComplete).toBe(true);
  });

  it("includes a conditional item once the driving field is answered true", () => {
    const template = makeTemplate();
    const responses = [
      response("item-plate", { valueText: "ABC-1234" }),
      response("item-safety", { valueBoolean: true }),
      // Nothing sets fuel_policy_applies directly since no item has that
      // key in this fixture — simulate it by aliasing the safety item's
      // key isn't right; instead add a dedicated item for it.
    ];
    // Extend the template with the field the condition reads.
    template.sections[0].items.push({
      id: "item-fuel-applies",
      sectionId: "sec-1",
      templateId: "tmpl-1",
      key: "fuel_policy_applies",
      label: "Fuel policy applies?",
      fieldType: "boolean",
      required: false,
      instructions: null,
      referenceImageUrl: null,
      minPhotos: null,
      maxPhotos: null,
      selectOptions: null,
      condition: null,
      approvalGate: false,
      sortOrder: 5,
    });
    responses.push(response("item-fuel-applies", { valueBoolean: true }));

    const result = checkTemplateCompletion({
      template,
      responses,
      mediaCountByItemId: new Map([["item-front-photo", 2]]),
    });
    expect(result.missingRequiredItems.some((m) => m.itemKey === "fuel_policy_note")).toBe(true);
    expect(result.canComplete).toBe(false);
  });
});
