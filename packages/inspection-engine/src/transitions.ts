import type { InspectionFindingStatus, InspectionStatus } from "./types.js";

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

// Same map+guard pattern for InspectionFinding — the exact flow suggested
// in item 9 of the spec. CHARGEABLE and WAIVED are alternate outcomes of
// a confirmed finding (a confirmed finding either gets billed or
// forgiven, never both), and both can end in RESOLVED once the follow-up
// (repair, charge, waiver) is actually done. REJECTED is terminal — a
// rejected finding was a false positive, it doesn't get revisited.
export const FINDING_ALLOWED_TRANSITIONS: Record<
  InspectionFindingStatus,
  InspectionFindingStatus[]
> = {
  detected: ["under_review", "rejected"],
  under_review: ["confirmed", "rejected"],
  confirmed: ["chargeable", "waived"],
  rejected: [],
  chargeable: ["resolved"],
  waived: ["resolved"],
  resolved: [],
};

export function canTransitionFinding(
  from: InspectionFindingStatus,
  to: InspectionFindingStatus,
): boolean {
  return FINDING_ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
