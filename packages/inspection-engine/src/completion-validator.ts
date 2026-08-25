import { evaluateCondition } from "./evaluate-condition.js";
import type { HydratedInspectionTemplate, InspectionResponse, SelectOption } from "./types.js";

export interface CompletionCheckInput {
  template: HydratedInspectionTemplate;
  responses: InspectionResponse[];
  // item_id -> number of inspection_media rows captured for that item.
  mediaCountByItemId: Map<string, number>;
}

export interface PhotoCountViolation {
  itemId: string;
  itemKey: string;
  required: number;
  actual: number;
}

export interface GateFailure {
  itemId: string;
  itemKey: string;
  reason: string;
}

export interface CompletionCheckResult {
  canComplete: boolean;
  missingRequiredItems: { itemId: string; itemKey: string }[];
  photoCountViolations: PhotoCountViolation[];
  // Items with approvalGate=true whose answer indicates a problem — these
  // don't block saving a response, but do block moving the inspection to
  // pending_review/completed without a finding recorded against them
  // (item 4 of the spec: "aprovação/reprovação" per item).
  gateFailures: GateFailure[];
}

function isPhotoType(fieldType: string): boolean {
  return fieldType === "photo" || fieldType === "multi_photo";
}

function responseIndicatesFailure(response: InspectionResponse | undefined): string | null {
  if (!response) return "sem resposta registrada";
  if (response.valueBoolean === false) return "marcado como reprovado";
  const selected = response.valueJson;
  const options: SelectOption[] = Array.isArray(selected) ? selected : selected ? [selected] : [];
  const flagged = options.find((o) => o.severity);
  if (flagged) return `opção selecionada indica severidade "${flagged.severity}"`;
  return null;
}

// Pure — no DB access. Walks every visible item (condition evaluated
// against the OTHER responses already given, same evaluator the template
// builder's conditional fields use) and reports what's missing/failing.
// Never decides pass/fail on its own for a gate item — it only surfaces
// GateFailure entries; the caller (the completion API route) decides
// whether that blocks the transition or just requires a linked Finding.
export function checkTemplateCompletion(input: CompletionCheckInput): CompletionCheckResult {
  const { template, responses, mediaCountByItemId } = input;
  const responseByItemId = new Map(responses.map((r) => [r.itemId, r]));

  const allItems = template.sections.flatMap((s) => s.items);
  const itemByKey = new Map(allItems.map((i) => [i.key, i]));

  // Flat field-value context for condition evaluation — built from
  // whichever primitive value is set on each response.
  const context: Record<string, unknown> = {};
  for (const item of allItems) {
    const response = responseByItemId.get(item.id);
    if (!response) continue;
    context[item.key] =
      response.valueBoolean ?? response.valueNumber ?? response.valueText ?? response.valueJson;
  }
  void itemByKey; // reserved for condition-by-key lookups if the grammar grows

  const missingRequiredItems: CompletionCheckResult["missingRequiredItems"] = [];
  const photoCountViolations: PhotoCountViolation[] = [];
  const gateFailures: GateFailure[] = [];

  for (const section of template.sections) {
    for (const item of section.items) {
      if (item.condition && !evaluateCondition(item.condition, context)) continue; // hidden by a condition, not required

      const response = responseByItemId.get(item.id);

      if (isPhotoType(item.fieldType)) {
        const count = mediaCountByItemId.get(item.id) ?? 0;
        // minPhotos on an OPTIONAL item only kicks in once the user has
        // started uploading for it (partial-capture validation, e.g.
        // "you added 1 photo of the trunk but the template wants 2") —
        // zero photos on an optional item is just "skipped it", not a
        // violation. A required item always enforces its floor (default
        // 1) even with zero photos. Caught live against real seed data:
        // "roof"/"dashboard"/"trunk" are optional but have minPhotos set,
        // and were being flagged as missing even when never touched.
        const min = item.required ? (item.minPhotos ?? 1) : count > 0 ? (item.minPhotos ?? 1) : 0;
        if (count < min) {
          photoCountViolations.push({
            itemId: item.id,
            itemKey: item.key,
            required: min,
            actual: count,
          });
        }
      } else if (item.required && !response) {
        missingRequiredItems.push({ itemId: item.id, itemKey: item.key });
      }

      if (item.approvalGate) {
        const failureReason = responseIndicatesFailure(response);
        if (failureReason) {
          gateFailures.push({ itemId: item.id, itemKey: item.key, reason: failureReason });
        }
      }
    }
  }

  return {
    canComplete: missingRequiredItems.length === 0 && photoCountViolations.length === 0,
    missingRequiredItems,
    photoCountViolations,
    gateFailures,
  };
}
