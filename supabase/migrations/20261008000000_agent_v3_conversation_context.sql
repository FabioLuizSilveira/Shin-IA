-- Agent Runtime v3, Wave 1 ("Goal Resolution + Entity Context") -- fixes
-- the real reported bug: the Shinã Agent's web chat sends NO conversation
-- history and no session identity at all today (confirmed by reading
-- shina-drawer.tsx's fetch body and route.ts's `messages` array, which is
-- always initialized fresh with just the current message) -- so a
-- customer created two messages ago is completely invisible to the next
-- request. This migration introduces the minimum real persistence needed
-- to fix that: a conversation identity, and a place to remember which
-- entities were created/resolved within it.
--
-- Audited first (REUSE > EXTEND > CREATE, spec section 3): the generic
-- @shina/workflow-engine package was actually DELETED from the repo on
-- 2026-07-31 (git ls-files returns zero tracked files for it -- only a
-- stale, gitignored dist/ leftover remains on disk, which is what an
-- earlier audit mistook for "still exists unwired"). @shina/messaging-
-- platform's conversations table is a different domain (WhatsApp contact
-- threads) with no tenant-internal-staff-chat use case. Nothing existing
-- covers "remember what this internal chat session has established" --
-- CREATE is the right call here, not EXTEND.

create table if not exists agent_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);
create index if not exists agent_conversations_tenant_user_idx
  on agent_conversations (tenant_id, user_id, last_active_at desc);

alter table agent_conversations enable row level security;
-- Same posture as agent_action_plans: RLS is the backstop, never the
-- primary mechanism -- no `authenticated` policy, only server-side
-- tenant-scoped code paths touch this table.

-- ConversationEntityReference (spec section 7) -- entityType intentionally
-- reuses the existing ToolDomain values (ORGANIZATION, ASSET, CONTRACT...)
-- from tool-taxonomy.ts instead of a parallel enum: one taxonomy, not two.
create table if not exists agent_conversation_entities (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references agent_conversations(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  display_name text not null,
  relation text not null
    check (relation in (
      'CURRENT_CUSTOMER', 'CURRENT_ASSET', 'CURRENT_CONTRACT',
      'CURRENT_TRIP', 'CURRENT_SERVICE_REQUEST'
    )),
  source text not null
    check (source in (
      'CREATED_IN_CONVERSATION', 'SELECTED_BY_USER', 'MENTIONED_BY_USER',
      'RESOLVED_BY_SEARCH', 'WORKFLOW_RESULT'
    )),
  referenced_at timestamptz not null default now()
);
-- Most-recent-per-relation is the real access pattern (EntityResolver
-- asks "what's the CURRENT_CUSTOMER right now", never a full history).
create index if not exists agent_conversation_entities_lookup_idx
  on agent_conversation_entities (conversation_id, relation, referenced_at desc);

alter table agent_conversation_entities enable row level security;

-- AgentGoal (spec section 4) -- created now (Wave 1) so the shape exists,
-- but NOT yet driving real orchestration logic -- that's Wave 2's job
-- (AgentWorkflowOrchestrator). Goal never stores domain business rules,
-- only a reference to the real process (workflow_instance_id is a plain
-- text/uuid slot for whatever Wave 2 finds is the real per-domain
-- mechanism -- there is no generic WorkflowInstance table to reference
-- today, see this wave's report).
create table if not exists agent_goals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null,
  conversation_id uuid not null references agent_conversations(id) on delete cascade,
  type text not null,
  domain text not null,
  operation_id uuid,
  status text not null default 'ACTIVE'
    check (status in (
      'ACTIVE', 'WAITING_USER', 'WAITING_CONFIRMATION', 'EXECUTING',
      'COMPLETED', 'CANCELLED', 'FAILED'
    )),
  workflow_instance_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists agent_goals_conversation_idx
  on agent_goals (conversation_id, status);

alter table agent_goals enable row level security;

-- Wave 1 -- lets the confirm route (api/ai/agent/actions/[id]/confirm)
-- know which conversation a just-executed mutation belongs to, so a
-- created entity (e.g. a new Organization) can be recorded as a
-- ConversationEntityReference the moment it starts existing. Nullable:
-- existing/older rows and any caller that doesn't yet send a
-- conversationId keep working exactly as before (additive, no behavior
-- change for those).
alter table agent_action_plans add column if not exists conversation_id uuid
  references agent_conversations(id) on delete set null;
