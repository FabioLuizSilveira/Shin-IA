import type { DraftAction, DraftEntityType, MktDraft } from "../types.js";

// The safety layer's core invariant: no action reaches an ad platform without
// passing through a draft that a human approved. These are the pure policy
// rules; persistence and platform calls live in the app layer.

export interface DraftRequest {
  entityType: DraftEntityType;
  action: DraftAction;
  payload: Record<string, unknown>;
  requestedBy: string;
  agentId?: string;
}

export interface BudgetPolicy {
  /** Max daily budget a draft may propose without extra review, in workspace currency. */
  maxDailyBudget: number;
  /** Max total budget a draft may propose. */
  maxTotalBudget: number;
}

export const DEFAULT_BUDGET_POLICY: BudgetPolicy = {
  maxDailyBudget: 5_000,
  maxTotalBudget: 100_000,
};

export type DraftValidation = { ok: true } | { ok: false; reason: string };

export function validateDraftRequest(
  request: DraftRequest,
  policy: BudgetPolicy = DEFAULT_BUDGET_POLICY,
): DraftValidation {
  const daily = numberField(request.payload, "budget_daily");
  if (daily !== undefined && daily > policy.maxDailyBudget) {
    return {
      ok: false,
      reason: `daily budget ${daily} exceeds workspace policy limit ${policy.maxDailyBudget}`,
    };
  }

  const total = numberField(request.payload, "budget_total");
  if (total !== undefined && total > policy.maxTotalBudget) {
    return {
      ok: false,
      reason: `total budget ${total} exceeds workspace policy limit ${policy.maxTotalBudget}`,
    };
  }

  if (request.action === "publish" && !request.payload["creative_url"]) {
    if (request.entityType === "ad") {
      return { ok: false, reason: "publish requires a creative preview (creative_url)" };
    }
  }

  return { ok: true };
}

export function canTransition(draft: MktDraft, next: MktDraft["status"]): boolean {
  const transitions: Record<MktDraft["status"], MktDraft["status"][]> = {
    pending: ["approved", "rejected"],
    approved: ["applied"],
    applied: ["rolled_back"],
    rejected: [],
    rolled_back: [],
  };
  return transitions[draft.status].includes(next);
}

function numberField(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  return typeof value === "number" ? value : undefined;
}
