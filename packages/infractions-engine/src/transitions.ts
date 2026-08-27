import type { InfractionCaseStatus } from "./types.js";

// Same house pattern as apps/web/src/lib/operation-transitions.ts /
// packages/inspection-engine/src/transitions.ts — a plain transition map,
// no state-machine package (rule-engine/workflow-engine are confirmed
// dead in this repo). Encodes the lifecycle from item 15 of the spec plus
// its branches (item 15: UNMATCHED/DISPUTED/DRIVER_IDENTIFICATION_PENDING/
// DRIVER_IDENTIFIED/DEFENSE_PENDING/APPEALED/CANCELLED/OVERDUE/WAIVED).
export const ALLOWED_CASE_TRANSITIONS: Record<InfractionCaseStatus, InfractionCaseStatus[]> = {
  received: ["matching", "cancelled"],
  matching: ["matched", "unmatched", "cancelled"],
  unmatched: ["matching", "cancelled"],
  matched: ["responsibility_pending", "cancelled"],
  responsibility_pending: ["responsibility_suggested", "responsibility_confirmed", "cancelled"],
  responsibility_suggested: ["responsibility_confirmed", "responsibility_pending", "cancelled"],
  // "responsibility_pending" is reachable from confirmed too — a
  // confirmed responsibility can be walked back (item 22's dispute flow,
  // or a reviewer catching a mistake after the fact), not just from the
  // suggested state.
  responsibility_confirmed: ["notified", "disputed", "responsibility_pending", "cancelled"],
  disputed: ["responsibility_pending", "responsibility_confirmed", "cancelled"],
  notified: ["action_pending", "driver_identification_pending", "cancelled"],
  driver_identification_pending: ["driver_identified", "action_pending", "cancelled"],
  driver_identified: ["action_pending", "defense_pending"],
  action_pending: ["defense_pending", "payment_pending", "waived", "cancelled"],
  defense_pending: ["appealed", "payment_pending", "waived", "cancelled"],
  appealed: ["payment_pending", "waived", "cancelled"],
  payment_pending: ["paid", "overdue", "waived", "cancelled"],
  overdue: ["payment_pending", "paid", "waived", "cancelled"],
  paid: ["closed"],
  waived: ["closed"],
  cancelled: ["closed"],
  closed: [],
};

export function canTransitionCase(from: InfractionCaseStatus, to: InfractionCaseStatus): boolean {
  return ALLOWED_CASE_TRANSITIONS[from]?.includes(to) ?? false;
}
