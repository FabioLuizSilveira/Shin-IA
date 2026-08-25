import type { InspectionStatus } from "./types.js";

// Mirrors apps/web/src/lib/operation-transitions.ts's shape exactly — a
// plain transition map, not a state-machine library, matching the house
// pattern confirmed live across operations/contracts/reservations (see
// docs/architecture/INSPECTION_ENGINE.md Fase A §1/§2). Terminal states
// (completed, rejected, abandoned) have no key, so ALLOWED_TRANSITIONS[x]
// is undefined for them — callers must treat "no entry" as "no further
// transitions allowed", same as the operations map does.
export const ALLOWED_TRANSITIONS: Record<InspectionStatus, InspectionStatus[]> = {
  draft: ["in_progress", "abandoned"],
  in_progress: ["pending_review", "abandoned"],
  pending_review: ["completed", "rejected"],
  completed: [],
  rejected: [],
  abandoned: [],
};

export function canTransition(from: InspectionStatus, to: InspectionStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
