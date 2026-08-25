import type { HydratedInspectionTemplate, InspectionResponse } from "./types.js";

export interface ComparisonInput {
  template: HydratedInspectionTemplate;
  beforeResponses: InspectionResponse[];
  afterResponses: InspectionResponse[];
}

export interface ComputedComparison {
  itemId: string;
  itemKey: string;
  beforeValue: unknown;
  afterValue: unknown;
  differs: boolean;
}

function extractValue(response: InspectionResponse | undefined): unknown {
  if (!response) return null;
  if (response.valueBoolean !== null) return response.valueBoolean;
  if (response.valueNumber !== null) return response.valueNumber;
  if (response.valueJson !== null) return response.valueJson;
  return response.valueText;
}

function valuesDiffer(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

// Pure BEFORE×AFTER comparison (item 8 of the spec) — walks every item on
// the shared template (check-in and check-out resolve to the same
// template per blueprint_inspection_mappings, which is what makes an
// item-by-item comparison meaningful instead of comparing apples to
// oranges) and reports which ones changed. Items with no response on
// either side compare as null vs null (never differs) — that's a missing-
// data problem for checkTemplateCompletion() to catch, not a comparison
// finding.
export function computeComparisons(input: ComparisonInput): ComputedComparison[] {
  const { template, beforeResponses, afterResponses } = input;
  const beforeByItemId = new Map(beforeResponses.map((r) => [r.itemId, r]));
  const afterByItemId = new Map(afterResponses.map((r) => [r.itemId, r]));

  const results: ComputedComparison[] = [];
  for (const section of template.sections) {
    for (const item of section.items) {
      const beforeValue = extractValue(beforeByItemId.get(item.id));
      const afterValue = extractValue(afterByItemId.get(item.id));
      results.push({
        itemId: item.id,
        itemKey: item.key,
        beforeValue,
        afterValue,
        differs: valuesDiffer(beforeValue, afterValue),
      });
    }
  }
  return results;
}
