-- Fase I bug fix (found live during CSV import verification, not a
-- theoretical concern): infractions_fallback_dedup_idx
-- (auto_number, plate, occurred_at, authority_code) where external_id is
-- null -- as declared in 20260105000000 -- never caught a real duplicate
-- whenever auto_number AND authority_code were both null (the common
-- case for a CSV row or a manual entry with no auto/órgão number typed
-- in), because a standard Postgres unique index treats every NULL as
-- distinct from every other NULL. Re-importing the exact same CSV twice
-- created two infractions instead of deduplicating to one -- confirmed
-- live against production before this fix (see docs/architecture/
-- INFRACTIONS_ENGINE.md fase i).
--
-- NULLS NOT DISTINCT (Postgres 15+) makes NULL = NULL for uniqueness
-- purposes without changing the columns' nullable semantics or any
-- existing read path -- auto_number/authority_code stay genuinely NULL
-- (not coerced to '') everywhere they're displayed.

drop index if exists infractions_fallback_dedup_idx;

create unique index infractions_fallback_dedup_idx
  on infractions (auto_number, plate, occurred_at, authority_code) nulls not distinct
  where external_id is null;
