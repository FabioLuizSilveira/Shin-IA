-- Wave 5 of the Shinã Agent Platform: "Tenant Knowledge" (RAG). Confirmed
-- via a real audit (2026-09-05) that ZERO vector/RAG infrastructure exists
-- anywhere in this repo -- no pgvector extension, no embedding column, no
-- chunk table, no chunking logic. This migration builds that layer from
-- scratch rather than retrofitting the three existing, unrelated document
-- silos (maintenance_documents, inspection_media, contract_documents),
-- which are transactional records tied to a specific order/inspection/
-- contract, not a general-purpose knowledge base -- conflating them would
-- have meant a polymorphic parent reference the audit flagged as an open
-- design question, not something the existing schema dictates.
create extension if not exists vector with schema extensions;

-- A tenant's own uploaded/ingested knowledge source (policy docs, manuals,
-- procedures...). Wave 5's first cut only ingests plain text (no OCR/PDF
-- pipeline yet -- that's a real, separate lift, tracked as an open gap in
-- the final report rather than silently assumed away). trust_level is the
-- taint/provenance primitive the spec's "Wave 5" section requires: content
-- a tenant admin typed/pasted themselves is trusted_staff_upload; anything
-- ingested from an untrusted source in a later wave (customer text, OCR,
-- an integration) would get its own trust_level value here -- the column
-- exists now so Wave 6's taint/exfiltration policy has something real to
-- check, even though nothing consumes it yet (no external-action tool
-- exists before Wave 6).
create table if not exists tenant_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  trust_level text not null default 'trusted_staff_upload'
    check (trust_level in ('trusted_staff_upload', 'untrusted_external')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed')),
  content_char_count integer,
  error text,
  created_by uuid not null references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists tenant_knowledge_documents_tenant_id_idx
  on tenant_knowledge_documents (tenant_id);

create table if not exists tenant_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  document_id uuid not null references tenant_knowledge_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  -- Denormalized from the parent document at write time rather than joined
  -- at query time -- the retriever's hot path (similarity search) filters
  -- directly on this column, never trusting a join to enforce isolation.
  trust_level text not null,
  embedding extensions.vector(1536),
  token_count integer,
  created_at timestamptz not null default now()
);
create index if not exists tenant_knowledge_chunks_tenant_id_idx
  on tenant_knowledge_chunks (tenant_id);
create index if not exists tenant_knowledge_chunks_document_id_idx
  on tenant_knowledge_chunks (document_id);
-- ivfflat needs rows to train on; fine to create empty (Postgres just skips
-- the training step until ANALYZE finds data) -- this is the standard
-- pgvector cosine-distance index.
create index if not exists tenant_knowledge_chunks_embedding_idx
  on tenant_knowledge_chunks using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 100);

alter table tenant_knowledge_documents enable row level security;
alter table tenant_knowledge_chunks enable row level security;
-- RLS is the backstop, never the primary mechanism (same posture as every
-- other tenant table -- requireTenantScope()'s service-role client is the
-- real gate, matching tenant-context.ts's own documented model). No
-- `authenticated`-role policy is defined here on purpose: nothing queries
-- these tables except via the service-role admin client from server-side
-- tenant-scoped code paths.

-- The actual isolation boundary for the retriever: tenant_id is a
-- parameter, never trusted from the embedding alone, and every returned
-- row is filtered by it before any similarity ranking happens -- a plain
-- SQL `where`, not something a crafted query embedding could bypass.
create or replace function match_tenant_knowledge_chunks(
  p_tenant_id uuid,
  p_query_embedding extensions.vector(1536),
  p_match_count integer default 5
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  chunk_index integer,
  content text,
  trust_level text,
  similarity real
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    c.id as chunk_id,
    c.document_id,
    d.title as document_title,
    c.chunk_index,
    c.content,
    c.trust_level,
    1 - (c.embedding <=> p_query_embedding) as similarity
  from tenant_knowledge_chunks c
  join tenant_knowledge_documents d on d.id = c.document_id
  where c.tenant_id = p_tenant_id
    and d.tenant_id = p_tenant_id
    and d.deleted_at is null
    and d.status = 'ready'
  order by c.embedding <=> p_query_embedding
  limit least(p_match_count, 20);
$$;

insert into tenant_permissions (key, resource, action, name, is_system)
select v.key, v.resource, v.action, v.name, true
from (
  values
    ('tenant.knowledge.view', 'knowledge', 'view', 'Ver base de conhecimento'),
    ('tenant.knowledge.manage', 'knowledge', 'manage', 'Gerenciar base de conhecimento')
) as v (key, resource, action, name)
where not exists (
  select 1 from tenant_permissions where key = v.key and deleted_at is null
);

insert into tenant_role_permissions (role_id, permission_id)
select tr.id, tp.id
from tenant_roles tr
cross join tenant_permissions tp
where tr.key in ('tenant_owner', 'tenant_admin')
  and tp.key in ('tenant.knowledge.view', 'tenant.knowledge.manage')
  and not exists (
    select 1 from tenant_role_permissions
    where role_id = tr.id and permission_id = tp.id
  );

-- Real OpenAI text-embedding-3-small price, confirmed live 2026-09
-- (developers.openai.com/api/docs/pricing): $0.02 per 1M tokens, input
-- only (embeddings have no output-token cost). Same credit_multiplier
-- convention as every other cost-policy row (1000, ~1 credit ≈ $0.001).
insert into ai_gateway_model_cost_policy (provider, model, capability, cost_basis, credit_multiplier, status)
values (
  'openai', 'text-embedding-3-small', 'embedding',
  '{"inputPerMTokUsd": 0.02, "outputPerMTokUsd": 0, "note": "real openai list price, embeddings have no output-token cost"}',
  1000, 'published'
);
