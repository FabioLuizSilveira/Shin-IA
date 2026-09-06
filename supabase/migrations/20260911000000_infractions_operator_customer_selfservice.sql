-- Closes 2 of the 3 deliberately-deferred gaps documented in
-- docs/architecture/INFRACTIONS_ENGINE.md: operator self-service
-- (acknowledge/dispute a driver identification pointed at them) and a
-- customer-facing view + dispute path. The third gap (official Senatran/
-- RENAINF/DETRAN integration) stays exactly as documented — no
-- credential/convênio exists yet, confirmed with the user 2026-09-05 —
-- nothing in this migration touches that.

-- Operator's own acknowledgment of a driver identification pointed at
-- them ("sim, eu estava dirigindo" / "não fui eu"). Deliberately
-- separate from the existing `status` column (pending/ready/submitted/
-- accepted/rejected/expired), which tracks the STAFF-managed official
-- protocol workflow — this tracks what the operator themselves said,
-- independent of whether staff has protocolled anything yet.
alter table infraction_driver_identifications
  add column if not exists operator_acknowledgment text
    check (operator_acknowledgment in ('confirmed', 'disputed')),
  add column if not exists operator_acknowledged_at timestamptz,
  add column if not exists operator_notes text;
