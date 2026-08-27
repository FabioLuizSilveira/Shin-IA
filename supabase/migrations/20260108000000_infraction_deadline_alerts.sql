-- Fase E — tracks which alert thresholds (7/3/1 days) have already fired
-- for a deadline, so the daily sweep never re-notifies for the same
-- crossing. Dedicated column, not overloading the human-facing `notes`
-- text field with machine state.
alter table infraction_deadlines
  add column alerted_thresholds jsonb not null default '[]';
