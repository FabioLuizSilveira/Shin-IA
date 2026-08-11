-- Free-text field for staff to record what was actually done on an
-- operation (e.g. notes on a maintenance/inspection outcome) — separate
-- from `type`, which only categorizes the operation, not describes it.
alter table operations add column if not exists description text;
