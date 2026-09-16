-- Agent Runtime Architecture v2, Wave 3 ("Safe Actions") -- adds the
-- payload_hash column the Wave 1 audit flagged as missing vs. the master
-- prompt's conceptual AgentActionDraft (agent_action_plans already covers
-- everything else: status machine, expiry, confirmed_by/at). Extends the
-- existing table, does not create a parallel one.
--
-- payload_hash is a content signature (sha256 of tool_name + tenant_id +
-- canonicalized args), computed server-side in mutation-registry.ts's
-- propose(). Used for real duplicate detection across separate requests
-- (a user re-pasting the same screenshot in a new message while an
-- identical plan is still pending, a client retry) -- distinct from
-- route.ts's existing seenCalls guard, which only catches duplicate tool
-- calls within the SAME turn loop of a single request.
alter table agent_action_plans add column if not exists payload_hash text;

-- Partial index (pending plans only) backing the duplicate lookup in
-- propose() -- same check-before-insert posture as
-- packages/ai-gateway/src/gateway.ts's idempotency_key check, no DB-level
-- unique constraint (this codebase's established rigor level for this
-- kind of dedupe, not a financial ledger operation).
create index if not exists agent_action_plans_dedupe_idx
  on agent_action_plans (tenant_id, tool_name, payload_hash)
  where status = 'pending';
