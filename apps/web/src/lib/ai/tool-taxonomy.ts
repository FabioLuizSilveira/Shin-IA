// Agent Runtime Architecture v2, Wave 1 — small, extensible taxonomy for
// Tool Registry v2 metadata (spec sections 4-6). Deliberately NOT
// exhaustive: domains/intents are added as tools are migrated to carry
// metadata (spec section 52 — "adaptar tools progressivamente", legacy
// tools without metadata keep working, just aren't candidates for
// domain-based filtering until annotated). This file is the single source
// of truth for both enums so a typo in a tool file is a type error, not a
// silent no-op filter.

// One tool can plausibly belong to more than one domain reading (e.g. a
// tracking tool touching a towing resource) — kept singular per tool for
// now, per spec section 5's "não precisa ser 1:1 com módulos visuais";
// revisit if a real tool needs multi-domain tagging once more are
// annotated in a later wave.
export type ToolDomain =
  | "ORGANIZATION" // spec section 18: Customer is a role/type of Organization, not a
  // separate entity — this repo has no Person table (organizations.document
  // holds either CNPJ or CPF), confirmed by a real audit of
  // 20260006000000_organizations.sql before writing this.
  | "ASSET"
  | "CONTRACT"
  | "MAINTENANCE"
  | "INSPECTION"
  | "INFRACTION"
  | "TRACKING"
  | "BILLING"
  | "REPORTING"
  | "KNOWLEDGE"
  | "INTELLIGENCE"
  | "PLATFORM_HELP"
  | "OPERATION"
  | "NOTIFICATION"
  // Agent Runtime v3, Wave 2 — distinct from the generic "OPERATION"
  // domain above (which stays unused so far): Towing and Passenger
  // Transport are real, purpose-built business processes with their own
  // domain services (towing-service.ts, trip-service.ts), not a generic
  // scheduled task. Kept as their own domains for clarity, matching how
  // the master prompt itself treats them as distinct goal domains.
  | "TOWING"
  | "PASSENGER_TRANSPORT"
  // Agent Runtime v3, Wave 3 — Rental now has a real domain (Wave 2.5:
  // rental-service.ts, operations type="vehicle_rental") to wire the
  // agent to. Distinct from CONTRACT (a rental produces a Contract as
  // one of its outputs, but the goal/tool itself is about the rental
  // operation, matching the TOWING/PASSENGER_TRANSPORT precedent).
  | "RENTAL";

export type ToolIntent =
  | "SEARCH"
  | "LIST"
  | "GET"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "EXPLAIN"
  | "NAVIGATE"
  | "ANALYZE"
  | "MANAGE";

export const TOOL_DOMAINS: readonly ToolDomain[] = [
  "ORGANIZATION",
  "ASSET",
  "CONTRACT",
  "MAINTENANCE",
  "INSPECTION",
  "INFRACTION",
  "TRACKING",
  "BILLING",
  "REPORTING",
  "KNOWLEDGE",
  "INTELLIGENCE",
  "PLATFORM_HELP",
  "OPERATION",
  "NOTIFICATION",
  "TOWING",
  "PASSENGER_TRANSPORT",
  "RENTAL",
];

export const TOOL_INTENTS: readonly ToolIntent[] = [
  "SEARCH",
  "LIST",
  "GET",
  "CREATE",
  "UPDATE",
  "DELETE",
  "EXPLAIN",
  "NAVIGATE",
  "ANALYZE",
  "MANAGE",
];
