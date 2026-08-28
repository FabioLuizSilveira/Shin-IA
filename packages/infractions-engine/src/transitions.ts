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
  // "responsibility_suggested" reachable directly from "matched" too --
  // POST .../responsibility/suggest is the real, only code path that
  // starts the responsibility workflow (found live: nothing ever writes
  // the literal "matched" -> "responsibility_pending" step on its own,
  // that state exists for display/filtering but suggest is what actually
  // advances a fresh case).
  matched: ["responsibility_pending", "responsibility_suggested", "cancelled"],
  responsibility_pending: ["responsibility_suggested", "responsibility_confirmed", "cancelled"],
  // Self-loop: suggest is idempotent/re-runnable (e.g. new tracking
  // evidence landed since the first run) -- re-suggesting while already
  // in this state is not a workflow error.
  responsibility_suggested: [
    "responsibility_confirmed",
    "responsibility_pending",
    "responsibility_suggested",
    "cancelled",
  ],
  // "responsibility_pending" is reachable from confirmed too — a
  // confirmed responsibility can be walked back (item 22's dispute flow,
  // or a reviewer catching a mistake after the fact), not just from the
  // suggested state.
  //
  // Also direct edges to driver_identification_pending/defense_pending/
  // paid: found live while E2E-testing the happy path -- "notified" and
  // "action_pending" are real enum values but no route ever writes them
  // (no notification-sent tracking or a distinct "action pending" step
  // was ever built). Without these direct edges every route past
  // confirmation (driver-identification POST, defense POST, payment)
  // silently failed its canTransitionCase check on any case that took
  // the real, only path that exists in the app -- registering the
  // sub-resource (driver id / defense / payment) always succeeded, but
  // the case's own status silently never advanced. These are additive:
  // the notified/action_pending/payment_pending path stays valid too,
  // for whenever/if that tracking is built.
  responsibility_confirmed: [
    "notified",
    "disputed",
    "responsibility_pending",
    "driver_identification_pending",
    "defense_pending",
    "paid",
    "cancelled",
  ],
  disputed: ["responsibility_pending", "responsibility_confirmed", "cancelled"],
  notified: ["action_pending", "driver_identification_pending", "cancelled"],
  driver_identification_pending: ["driver_identified", "action_pending", "paid", "cancelled"],
  driver_identified: ["action_pending", "defense_pending", "paid"],
  action_pending: ["defense_pending", "payment_pending", "waived", "cancelled"],
  defense_pending: ["appealed", "payment_pending", "paid", "waived", "cancelled"],
  appealed: ["payment_pending", "paid", "waived", "cancelled"],
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
