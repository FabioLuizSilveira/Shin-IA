import type { MaintenanceOrderStatus } from "./types.js";

// Same plain-transition-map house pattern as every other engine in this
// monorepo (operation-transitions.ts, inspection-engine, infractions-engine,
// crm-engine) — no rule/workflow engine (confirmed dead/archived). A
// maintenance order's *initial* status is an app-level decision (an
// emergency repair can start directly at "in_progress", a routine
// preventive at "scheduled") -- this map only governs what a real,
// already-created order can move to next.
export const ALLOWED_ORDER_TRANSITIONS: Record<MaintenanceOrderStatus, MaintenanceOrderStatus[]> = {
  scheduled: ["awaiting_approval", "approved", "in_progress", "cancelled"],
  awaiting_approval: ["approved", "cancelled"],
  approved: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  // "completed" -> "in_progress" covers a real correction (closed too
  // early, a part still needs replacing) -- same precedent as the
  // infractions engine's "won -> negotiation" walk-back.
  completed: ["in_progress"],
  // "cancelled" -> "scheduled" covers reinstating an order that was
  // cancelled by mistake -- same precedent as "lost -> contacted".
  cancelled: ["scheduled"],
};

export function canTransitionOrder(
  from: MaintenanceOrderStatus,
  to: MaintenanceOrderStatus,
): boolean {
  return ALLOWED_ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}
