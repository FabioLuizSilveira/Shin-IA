// Regenerated 2026-07-31 via `supabase gen types typescript --linked` — the
// previous file predated most of the schema built this year (zero mention of
// rental_customers/commission_plans/impersonation_sessions) and this
// package has no consumers yet (see packages/ audit), so the old
// hand-maintained named enum aliases (TenantPlan, ContractStatus, etc.) were
// dropped rather than guessed back in — re-add them here if/when a real
// consumer needs the ergonomics; the generic Tables<>/Enums<> helpers below
// cover every table and enum in the current schema either way.
export type {
  Json,
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  CompositeTypes,
} from "./supabase.types.js";
